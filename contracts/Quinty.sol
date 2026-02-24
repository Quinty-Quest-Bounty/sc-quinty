// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IQuintyReputation {
    function recordBountyCreation(address _user) external;
    function recordSubmission(address _user) external;
    function recordWin(address _user) external;
}

/**
 * @title Quinty V3
 * @notice Multi-winner bounty system with ERC-20 support, pull-based withdrawals,
 *         1% deposit, slash mechanism, and emergency pause.
 *
 * Flow:
 * 1. Creator creates bounty with ETH/ERC-20 escrow + prize tiers + phase deadlines
 * 2. OPEN PHASE: Submitters pay 1% deposit
 * 3. JUDGING PHASE: After openDeadline, creator selects winners (multi-winner)
 * 4. RESOLVED: Winners credited prizes + deposits, non-winners get deposits back
 * 5. SLASHED: If creator misses judgingDeadline, slash distributed to submitters
 *
 * All payouts use pull-based withdrawals for safety.
 */
contract Quinty is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum BountyStatus { OPEN, JUDGING, RESOLVED, SLASHED }

    struct Submission {
        address submitter;
        string ipfsCid;
        uint256 deposit;
        uint256 timestamp;
    }

    struct Bounty {
        address creator;
        string title;
        string description;
        address token;            // address(0) for ETH, token address for ERC-20
        uint256[] prizes;         // [rank1Amount, rank2Amount, ...]
        uint256 totalAmount;      // sum of prizes
        uint256 openDeadline;
        uint256 judgingDeadline;
        uint256 slashPercent;     // basis points (2500-5000 = 25%-50%)
        BountyStatus status;
        Submission[] submissions;
        uint256 totalDeposits;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    // Pull-based withdrawals: token => user => amount
    mapping(address => mapping(address => uint256)) public pendingWithdrawals;
    // Track total escrowed per token (for safe rescueERC20)
    mapping(address => uint256) public totalEscrowed;

    // Token whitelist (address(0) = ETH is always allowed)
    mapping(address => bool) public allowedTokens;

    uint256 public bountyCounter;
    uint256 public constant DEPOSIT_PERCENT = 100; // 1% = 100 basis points

    address public reputationAddress;

    // Events
    event BountyCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        address token,
        uint256 totalAmount,
        uint256 openDeadline,
        uint256 judgingDeadline,
        uint256 slashPercent
    );
    event SubmissionCreated(
        uint256 indexed bountyId,
        uint256 submissionId,
        address indexed submitter,
        string ipfsCid,
        uint256 deposit
    );
    event BountyMovedToJudging(uint256 indexed bountyId);
    event WinnersSelected(
        uint256 indexed bountyId,
        address[] winners,
        uint256[] submissionIds
    );
    event BountySlashed(
        uint256 indexed bountyId,
        uint256 slashAmount,
        uint256 refundToCreator
    );
    event FundsCredited(address indexed token, address indexed recipient, uint256 amount);
    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
    event TokenAllowed(address indexed token);
    event TokenRevoked(address indexed token);

    modifier onlyCreator(uint256 _bountyId) {
        require(msg.sender == bounties[_bountyId].creator, "Not bounty creator");
        _;
    }

    modifier validBounty(uint256 _bountyId) {
        require(_bountyId > 0 && _bountyId <= bountyCounter, "Invalid bounty ID");
        _;
    }

    modifier onlyAllowedToken(address _token) {
        require(_token == address(0) || allowedTokens[_token], "Token not allowed");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ============ ADMIN FUNCTIONS ============

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setReputationAddress(address _repAddress) external onlyOwner {
        reputationAddress = _repAddress;
    }

    function allowToken(address _token) external onlyOwner {
        require(_token != address(0), "Use address(0) for ETH");
        allowedTokens[_token] = true;
        emit TokenAllowed(_token);
    }

    function revokeToken(address _token) external onlyOwner {
        allowedTokens[_token] = false;
        emit TokenRevoked(_token);
    }

    /// @notice Rescue accidentally sent ERC-20 tokens (cannot drain active escrow)
    function rescueERC20(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(0), "Cannot rescue ETH");
        uint256 contractBalance = IERC20(_token).balanceOf(address(this));
        uint256 escrowed = totalEscrowed[_token];
        require(_amount <= contractBalance - escrowed, "Cannot drain escrow");
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Create a bounty with ETH or ERC-20 escrow and multi-winner prize tiers
     * @param _title Bounty title
     * @param _description Bounty description
     * @param _openDeadline End of submission phase
     * @param _judgingDeadline End of judging phase
     * @param _slashPercent Slash percentage in basis points (2500-5000)
     * @param _prizes Array of prize amounts by rank [1st, 2nd, ...]
     * @param _token Token address (address(0) for ETH)
     */
    function createBounty(
        string memory _title,
        string memory _description,
        uint256 _openDeadline,
        uint256 _judgingDeadline,
        uint256 _slashPercent,
        uint256[] calldata _prizes,
        address _token
    ) external payable whenNotPaused nonReentrant onlyAllowedToken(_token) {
        require(bytes(_title).length > 0, "Empty title");
        require(_prizes.length > 0, "No prizes");
        require(_prizes.length <= 10, "Max 10 winners");
        require(_openDeadline > block.timestamp, "Open deadline must be future");
        require(_judgingDeadline > _openDeadline, "Judging must be after open");
        require(_judgingDeadline <= block.timestamp + 365 days, "Max 365 days");
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash 25-50%");

        uint256 total = 0;
        for (uint256 i = 0; i < _prizes.length; ) {
            require(_prizes[i] > 0, "Prize must be > 0");
            total += _prizes[i];
            unchecked { ++i; }
        }

        // Receive payment
        if (_token == address(0)) {
            require(msg.value == total, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "Do not send ETH for token bounty");
            IERC20(_token).safeTransferFrom(msg.sender, address(this), total);
        }

        totalEscrowed[_token] += total;

        bountyCounter++;
        Bounty storage b = bounties[bountyCounter];
        b.creator = msg.sender;
        b.title = _title;
        b.description = _description;
        b.token = _token;
        b.totalAmount = total;
        b.openDeadline = _openDeadline;
        b.judgingDeadline = _judgingDeadline;
        b.slashPercent = _slashPercent;
        b.status = BountyStatus.OPEN;

        for (uint256 i = 0; i < _prizes.length; ) {
            b.prizes.push(_prizes[i]);
            unchecked { ++i; }
        }

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
        }

        emit BountyCreated(bountyCounter, msg.sender, _title, _token, total, _openDeadline, _judgingDeadline, _slashPercent);
    }

    /**
     * @notice Submit work to a bounty with 1% deposit
     * @param _bountyId Bounty ID
     * @param _ipfsCid IPFS CID containing work proof
     */
    function submitToBounty(
        uint256 _bountyId,
        string memory _ipfsCid
    ) external payable validBounty(_bountyId) whenNotPaused nonReentrant {
        Bounty storage b = bounties[_bountyId];
        require(b.status == BountyStatus.OPEN, "Not open");
        require(block.timestamp <= b.openDeadline, "Submissions closed");
        require(bytes(_ipfsCid).length > 0, "Empty IPFS CID");
        require(!hasSubmitted[_bountyId][msg.sender], "Already submitted");
        require(msg.sender != b.creator, "Creator cannot submit");

        uint256 deposit = b.totalAmount * DEPOSIT_PERCENT / 10000;

        if (b.token == address(0)) {
            require(msg.value == deposit, "Incorrect deposit");
        } else {
            require(msg.value == 0, "Do not send ETH");
            IERC20(b.token).safeTransferFrom(msg.sender, address(this), deposit);
        }

        totalEscrowed[b.token] += deposit;
        b.totalDeposits += deposit;
        hasSubmitted[_bountyId][msg.sender] = true;

        b.submissions.push(Submission({
            submitter: msg.sender,
            ipfsCid: _ipfsCid,
            deposit: deposit,
            timestamp: block.timestamp
        }));

        uint256 subId = b.submissions.length - 1;

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
        }

        emit SubmissionCreated(_bountyId, subId, msg.sender, _ipfsCid, deposit);
    }

    /**
     * @notice Move bounty to JUDGING phase after openDeadline
     */
    function moveToJudging(uint256 _bountyId) external validBounty(_bountyId) whenNotPaused {
        Bounty storage b = bounties[_bountyId];
        require(b.status == BountyStatus.OPEN, "Not open");
        require(block.timestamp > b.openDeadline, "Open phase not ended");

        b.status = BountyStatus.JUDGING;
        emit BountyMovedToJudging(_bountyId);
    }

    /**
     * @notice Select multiple winners. submissionIds ordered by rank (index 0 = rank 1).
     *         Fewer winners than prize slots: unused prizes refunded to creator.
     */
    function selectWinners(
        uint256 _bountyId,
        uint256[] calldata _submissionIds
    ) external validBounty(_bountyId) onlyCreator(_bountyId) whenNotPaused nonReentrant {
        Bounty storage b = bounties[_bountyId];

        if (b.status == BountyStatus.OPEN && block.timestamp > b.openDeadline) {
            b.status = BountyStatus.JUDGING;
            emit BountyMovedToJudging(_bountyId);
        }

        require(b.status == BountyStatus.JUDGING, "Not in judging");
        require(block.timestamp <= b.judgingDeadline, "Judging deadline passed");
        require(_submissionIds.length > 0, "No winners");
        require(_submissionIds.length <= b.prizes.length, "Too many winners");

        // Validate no duplicates
        for (uint256 i = 0; i < _submissionIds.length; ) {
            require(_submissionIds[i] < b.submissions.length, "Invalid submission ID");
            for (uint256 j = 0; j < i; ) {
                require(_submissionIds[i] != _submissionIds[j], "Duplicate winner");
                unchecked { ++j; }
            }
            unchecked { ++i; }
        }

        b.status = BountyStatus.RESOLVED;

        address[] memory winners = new address[](_submissionIds.length);
        uint256 usedPrizes = 0;

        // Credit prize + deposit to each winner
        for (uint256 i = 0; i < _submissionIds.length; ) {
            Submission storage sub = b.submissions[_submissionIds[i]];
            winners[i] = sub.submitter;

            uint256 prize = b.prizes[i];
            uint256 creditAmount = prize + sub.deposit;
            _credit(b.token, sub.submitter, creditAmount);
            totalEscrowed[b.token] -= creditAmount;
            usedPrizes += prize;
            sub.deposit = 0;

            if (reputationAddress != address(0)) {
                IQuintyReputation(reputationAddress).recordWin(sub.submitter);
            }

            unchecked { ++i; }
        }

        // Refund deposits to non-winners
        for (uint256 i = 0; i < b.submissions.length; ) {
            Submission storage sub = b.submissions[i];
            if (sub.deposit > 0) {
                _credit(b.token, sub.submitter, sub.deposit);
                totalEscrowed[b.token] -= sub.deposit;
                sub.deposit = 0;
            }
            unchecked { ++i; }
        }

        // Refund unused prize tiers to creator
        uint256 unusedPrizes = b.totalAmount - usedPrizes;
        if (unusedPrizes > 0) {
            _credit(b.token, b.creator, unusedPrizes);
            totalEscrowed[b.token] -= unusedPrizes;
        }

        emit WinnersSelected(_bountyId, winners, _submissionIds);
    }

    /**
     * @notice Slash creator for missing judging deadline
     */
    function triggerSlash(uint256 _bountyId) external validBounty(_bountyId) whenNotPaused nonReentrant {
        Bounty storage b = bounties[_bountyId];

        if (b.status == BountyStatus.OPEN && block.timestamp > b.openDeadline) {
            b.status = BountyStatus.JUDGING;
            emit BountyMovedToJudging(_bountyId);
        }

        require(b.status == BountyStatus.JUDGING, "Not in judging");
        require(block.timestamp > b.judgingDeadline, "Deadline not passed");
        require(b.submissions.length > 0, "No submissions");

        b.status = BountyStatus.SLASHED;

        uint256 slashAmount = b.totalAmount * b.slashPercent / 10000;
        uint256 refundToCreator = b.totalAmount - slashAmount;
        uint256 submitterCount = b.submissions.length;
        uint256 slashPerSubmitter = slashAmount / submitterCount;
        uint256 remainder = slashAmount - (slashPerSubmitter * submitterCount);

        for (uint256 i = 0; i < submitterCount; ) {
            Submission storage sub = b.submissions[i];
            uint256 payout = slashPerSubmitter + sub.deposit;

            // Last submitter gets the dust remainder
            if (i == submitterCount - 1) {
                payout += remainder;
            }

            _credit(b.token, sub.submitter, payout);
            totalEscrowed[b.token] -= payout;
            sub.deposit = 0;

            unchecked { ++i; }
        }

        // Credit creator refund
        if (refundToCreator > 0) {
            _credit(b.token, b.creator, refundToCreator);
            totalEscrowed[b.token] -= refundToCreator;
        }

        emit BountySlashed(_bountyId, slashAmount, refundToCreator);
    }

    /**
     * @notice Refund bounty if no submissions after open deadline
     */
    function refundNoSubmissions(uint256 _bountyId) external validBounty(_bountyId) nonReentrant {
        Bounty storage b = bounties[_bountyId];
        require(block.timestamp > b.openDeadline, "Open phase not ended");
        require(b.submissions.length == 0, "Has submissions");
        require(msg.sender == b.creator || msg.sender == owner(), "Not authorized");
        require(b.status == BountyStatus.OPEN || b.status == BountyStatus.JUDGING, "Already resolved");

        b.status = BountyStatus.RESOLVED;

        _credit(b.token, b.creator, b.totalAmount);
        totalEscrowed[b.token] -= b.totalAmount;
    }

    // ============ WITHDRAWAL FUNCTIONS ============

    /// @notice Withdraw ETH credited to msg.sender (works during pause)
    function withdrawETH() external nonReentrant {
        uint256 amount = pendingWithdrawals[address(0)][msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[address(0)][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit Withdrawn(address(0), msg.sender, amount);
    }

    /// @notice Withdraw ERC-20 credited to msg.sender (works during pause)
    function withdrawToken(address _token) external nonReentrant {
        require(_token != address(0), "Use withdrawETH");

        uint256 amount = pendingWithdrawals[_token][msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[_token][msg.sender] = 0;

        IERC20(_token).safeTransfer(msg.sender, amount);

        emit Withdrawn(_token, msg.sender, amount);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _credit(address _token, address _recipient, uint256 _amount) internal {
        pendingWithdrawals[_token][_recipient] += _amount;
        emit FundsCredited(_token, _recipient, _amount);
    }

    // ============ VIEW FUNCTIONS ============

    function getBounty(uint256 _bountyId) external view validBounty(_bountyId) returns (
        address creator,
        string memory title,
        string memory description,
        address token,
        uint256 totalAmount,
        uint256[] memory prizes,
        uint256 openDeadline,
        uint256 judgingDeadline,
        uint256 slashPercent,
        BountyStatus status,
        uint256 submissionCount,
        uint256 totalDeposits
    ) {
        Bounty storage b = bounties[_bountyId];
        return (
            b.creator, b.title, b.description, b.token, b.totalAmount,
            b.prizes, b.openDeadline, b.judgingDeadline, b.slashPercent,
            b.status, b.submissions.length, b.totalDeposits
        );
    }

    function getSubmission(uint256 _bountyId, uint256 _subId) external view validBounty(_bountyId) returns (
        address submitter,
        string memory ipfsCid,
        uint256 deposit,
        uint256 timestamp
    ) {
        require(_subId < bounties[_bountyId].submissions.length, "Invalid submission ID");
        Submission storage sub = bounties[_bountyId].submissions[_subId];
        return (sub.submitter, sub.ipfsCid, sub.deposit, sub.timestamp);
    }

    function getSubmissionCount(uint256 _bountyId) external view validBounty(_bountyId) returns (uint256) {
        return bounties[_bountyId].submissions.length;
    }

    function hasUserSubmitted(uint256 _bountyId, address _user) external view returns (bool) {
        return hasSubmitted[_bountyId][_user];
    }

    function getAllSubmissions(uint256 _bountyId) external view validBounty(_bountyId) returns (Submission[] memory) {
        return bounties[_bountyId].submissions;
    }

    function getRequiredDeposit(uint256 _bountyId) external view validBounty(_bountyId) returns (uint256) {
        return bounties[_bountyId].totalAmount * DEPOSIT_PERCENT / 10000;
    }

    function getCurrentPhase(uint256 _bountyId) external view validBounty(_bountyId) returns (string memory) {
        Bounty storage b = bounties[_bountyId];
        if (b.status == BountyStatus.RESOLVED) return "RESOLVED";
        if (b.status == BountyStatus.SLASHED) return "SLASHED";
        if (block.timestamp <= b.openDeadline) return "OPEN";
        if (block.timestamp <= b.judgingDeadline) return "JUDGING";
        return "SLASH_PENDING";
    }

    function pendingBalance(address _token, address _user) external view returns (uint256) {
        return pendingWithdrawals[_token][_user];
    }

    receive() external payable {}
}
