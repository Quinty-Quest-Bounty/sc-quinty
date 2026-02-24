// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for Reputation updates
interface IQuintyReputation {
    function recordBountyCreation(address _user) external;
    function recordSubmission(address _user) external;
    function recordWin(address _user) external;
}

/**
 * @title Quinty
 * @notice Bounty contract with 1% deposit, slash mechanism, and social verification
 * 
 * Flow:
 * 1. Creator creates bounty with ETH escrow + phase deadlines + slash percentage
 * 2. OPEN PHASE: Submitters pay 1% deposit and provide social handle
 * 3. JUDGING PHASE: After openDeadline, creator judges submissions
 * 4. RESOLVED: Creator selects winner before judgingDeadline, prize sent
 * 5. SLASHED: If creator doesn't select winner by judgingDeadline, slash distributed to submitters
 * 
 * NO CANCELLATION allowed once created
 */
contract Quinty is Ownable, ReentrancyGuard {

    enum BountyStatus { OPEN, JUDGING, RESOLVED, SLASHED }

    struct Submission {
        address submitter;
        string ipfsCid;           // IPFS CID with work proof
        string socialHandle;      // X/Twitter handle for credibility verification
        uint256 deposit;          // 1% deposit amount
        uint256 timestamp;
    }

    struct Bounty {
        address creator;
        string title;
        string description;
        uint256 amount;           // ETH escrowed
        uint256 openDeadline;     // Deadline for submissions (end of OPEN phase)
        uint256 judgingDeadline;  // Deadline to select winner (end of JUDGING phase)
        uint256 slashPercent;     // Slash percentage (in basis points, e.g., 2500 = 25%)
        BountyStatus status;
        Submission[] submissions;
        address selectedWinner;
        uint256 selectedSubmissionId;
        uint256 totalDeposits;    // Sum of all submission deposits
    }

    // Social account registry - maps wallet address to social handles
    struct SocialAccount {
        string xHandle;           // X/Twitter handle
        string email;             // Email for verification (optional)
        uint256 linkedAt;
        bool verified;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(address => SocialAccount) public socialAccounts;
    
    uint256 public bountyCounter;
    uint256 public constant DEPOSIT_PERCENT = 100; // 1% = 100 basis points

    address public reputationAddress;

    constructor() Ownable(msg.sender) {}

    event BountyCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        uint256 amount,
        uint256 openDeadline,
        uint256 judgingDeadline,
        uint256 slashPercent
    );
    event SubmissionCreated(
        uint256 indexed bountyId,
        uint256 submissionId,
        address indexed submitter,
        string ipfsCid,
        string socialHandle,
        uint256 deposit
    );
    event BountyMovedToJudging(uint256 indexed bountyId);
    event WinnerSelected(
        uint256 indexed bountyId,
        address indexed winner,
        uint256 submissionId,
        uint256 reward
    );
    event BountySlashed(
        uint256 indexed bountyId,
        uint256 slashAmount,
        uint256 refundToCreator
    );
    event DepositsRefunded(uint256 indexed bountyId, uint256 totalRefunded);
    event SocialAccountLinked(address indexed wallet, string xHandle, string email);

    modifier onlyCreator(uint256 _bountyId) {
        require(msg.sender == bounties[_bountyId].creator, "Not bounty creator");
        _;
    }

    modifier validBounty(uint256 _bountyId) {
        require(_bountyId > 0 && _bountyId <= bountyCounter, "Invalid bounty ID");
        _;
    }

    /**
     * @notice Link social account to wallet address (stored on-chain)
     * @param _xHandle X/Twitter handle
     * @param _email Email address (optional)
     */
    function linkSocialAccount(string memory _xHandle, string memory _email) external {
        require(bytes(_xHandle).length > 0, "X handle required");
        
        socialAccounts[msg.sender] = SocialAccount({
            xHandle: _xHandle,
            email: _email,
            linkedAt: block.timestamp,
            verified: false
        });
        
        emit SocialAccountLinked(msg.sender, _xHandle, _email);
    }

    /**
     * @notice Set the reputation contract address
     * @param _repAddress Reputation contract address
     */
    function setReputationAddress(address _repAddress) external onlyOwner {
        reputationAddress = _repAddress;
    }

    /**
     * @notice Create a new bounty with ETH escrow and phase deadlines (NO CANCELLATION)
     * @param _title Bounty title
     * @param _description Bounty description (can include IPFS metadata CID)
     * @param _openDeadline Deadline for submissions (end of OPEN phase)
     * @param _judgingDeadline Deadline to select winner (end of JUDGING phase)
     * @param _slashPercent Slash percentage in basis points (2500-5000 = 25%-50%)
     */
    function createBounty(
        string memory _title,
        string memory _description,
        uint256 _openDeadline,
        uint256 _judgingDeadline,
        uint256 _slashPercent
    ) external payable nonReentrant {
        require(msg.value > 0, "Escrow required");
        require(_openDeadline > block.timestamp, "Invalid open deadline");
        require(_judgingDeadline > _openDeadline, "Judging deadline must be after open deadline");
        require(_judgingDeadline <= block.timestamp + 365 days, "Deadline too far");
        require(bytes(_title).length > 0, "Title required");
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash must be 25-50%");

        bountyCounter++;
        Bounty storage bounty = bounties[bountyCounter];
        bounty.creator = msg.sender;
        bounty.title = _title;
        bounty.description = _description;
        bounty.amount = msg.value;
        bounty.openDeadline = _openDeadline;
        bounty.judgingDeadline = _judgingDeadline;
        bounty.slashPercent = _slashPercent;
        bounty.status = BountyStatus.OPEN;

        emit BountyCreated(bountyCounter, msg.sender, _title, msg.value, _openDeadline, _judgingDeadline, _slashPercent);

        // Update reputation
        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
        }
    }

    /**
     * @notice Submit work to a bounty with 1% deposit (only during OPEN phase)
     * @param _bountyId Bounty ID
     * @param _ipfsCid IPFS CID containing work proof
     * @param _socialHandle Social media handle for verification
     */
    function submitToBounty(
        uint256 _bountyId,
        string memory _ipfsCid,
        string memory _socialHandle
    ) external payable validBounty(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPEN, "Bounty not open for submissions");
        require(block.timestamp <= bounty.openDeadline, "Submission deadline passed");
        require(bytes(_ipfsCid).length > 0, "IPFS CID required");
        require(bytes(_socialHandle).length > 0, "Social handle required");
        require(!hasSubmitted[_bountyId][msg.sender], "Already submitted");
        require(msg.sender != bounty.creator, "Creator cannot submit");

        // Calculate 1% deposit
        uint256 depositAmount = (bounty.amount * DEPOSIT_PERCENT) / 10000;
        require(msg.value == depositAmount, "Incorrect deposit amount (1% required)");

        hasSubmitted[_bountyId][msg.sender] = true;
        bounty.totalDeposits += depositAmount;

        // Store social account on-chain if not already linked
        if (bytes(socialAccounts[msg.sender].xHandle).length == 0) {
            socialAccounts[msg.sender] = SocialAccount({
                xHandle: _socialHandle,
                email: "",
                linkedAt: block.timestamp,
                verified: false
            });
        }

        bounty.submissions.push(Submission({
            submitter: msg.sender,
            ipfsCid: _ipfsCid,
            socialHandle: _socialHandle,
            deposit: depositAmount,
            timestamp: block.timestamp
        }));

        uint256 subId = bounty.submissions.length - 1;

        emit SubmissionCreated(_bountyId, subId, msg.sender, _ipfsCid, _socialHandle, depositAmount);

        // Update reputation
        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
        }
    }

    /**
     * @notice Move bounty to JUDGING phase (auto-triggered when openDeadline passes)
     * @param _bountyId Bounty ID
     */
    function moveToJudging(uint256 _bountyId) external validBounty(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPEN, "Bounty not open");
        require(block.timestamp > bounty.openDeadline, "Open phase not ended");

        bounty.status = BountyStatus.JUDGING;
        emit BountyMovedToJudging(_bountyId);
    }

    /**
     * @notice Select winner and pay out escrow + winner's deposit refund
     * @param _bountyId Bounty ID
     * @param _submissionId Winning submission ID
     */
    function selectWinner(
        uint256 _bountyId,
        uint256 _submissionId
    ) external validBounty(_bountyId) onlyCreator(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        
        // Auto-move to judging if open deadline passed
        if (bounty.status == BountyStatus.OPEN && block.timestamp > bounty.openDeadline) {
            bounty.status = BountyStatus.JUDGING;
            emit BountyMovedToJudging(_bountyId);
        }
        
        require(bounty.status == BountyStatus.JUDGING, "Not in judging phase");
        require(block.timestamp <= bounty.judgingDeadline, "Judging deadline passed - call triggerSlash");
        require(_submissionId < bounty.submissions.length, "Invalid submission ID");

        Submission storage winner = bounty.submissions[_submissionId];

        // Update bounty state
        bounty.status = BountyStatus.RESOLVED;
        bounty.selectedWinner = winner.submitter;
        bounty.selectedSubmissionId = _submissionId;

        // Pay winner: escrow + their deposit back
        uint256 reward = bounty.amount + winner.deposit;
        (bool success, ) = payable(winner.submitter).call{value: reward}("");
        require(success, "Payment to winner failed");

        // Refund deposits to non-winners
        uint256 refundedDeposits = 0;
        for (uint i = 0; i < bounty.submissions.length; i++) {
            if (i != _submissionId && bounty.submissions[i].deposit > 0) {
                uint256 depositToRefund = bounty.submissions[i].deposit;
                (bool refundSuccess, ) = payable(bounty.submissions[i].submitter).call{value: depositToRefund}("");
                if (refundSuccess) {
                    refundedDeposits += depositToRefund;
                    bounty.submissions[i].deposit = 0;
                }
            }
        }

        emit WinnerSelected(_bountyId, winner.submitter, _submissionId, reward);
        emit DepositsRefunded(_bountyId, refundedDeposits);

        // Update reputation
        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordWin(winner.submitter);
        }
    }

    /**
     * @notice Trigger slash if creator didn't select winner before judging deadline
     * @param _bountyId Bounty ID
     */
    function triggerSlash(uint256 _bountyId) external validBounty(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        
        // Auto-move to judging if needed
        if (bounty.status == BountyStatus.OPEN && block.timestamp > bounty.openDeadline) {
            bounty.status = BountyStatus.JUDGING;
        }
        
        require(bounty.status == BountyStatus.JUDGING, "Not in judging phase");
        require(block.timestamp > bounty.judgingDeadline, "Judging deadline not passed");
        require(bounty.submissions.length > 0, "No submissions - creator can claim refund");

        bounty.status = BountyStatus.SLASHED;

        // Calculate slash amount
        uint256 slashAmount = (bounty.amount * bounty.slashPercent) / 10000;
        uint256 refundToCreator = bounty.amount - slashAmount;

        // Distribute slash amount equally to all submitters + refund their deposits
        uint256 submitterCount = bounty.submissions.length;
        uint256 slashPerSubmitter = slashAmount / submitterCount;

        for (uint i = 0; i < submitterCount; i++) {
            Submission storage sub = bounty.submissions[i];
            uint256 payout = slashPerSubmitter + sub.deposit; // Slash share + deposit refund
            (bool success, ) = payable(sub.submitter).call{value: payout}("");
            if (success) {
                sub.deposit = 0;
            }
        }

        // Refund remaining to creator
        if (refundToCreator > 0) {
            (bool creatorSuccess, ) = payable(bounty.creator).call{value: refundToCreator}("");
            require(creatorSuccess, "Creator refund failed");
        }

        emit BountySlashed(_bountyId, slashAmount, refundToCreator);
    }

    /**
     * @notice Refund bounty if no submissions after judging deadline (only case where creator gets full refund)
     * @param _bountyId Bounty ID
     */
    function refundNoSubmissions(uint256 _bountyId) external validBounty(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp > bounty.openDeadline, "Open phase not ended");
        require(bounty.submissions.length == 0, "Has submissions - use triggerSlash or selectWinner");
        require(msg.sender == bounty.creator || msg.sender == owner(), "Not authorized");
        require(bounty.status == BountyStatus.OPEN || bounty.status == BountyStatus.JUDGING, "Already resolved");

        bounty.status = BountyStatus.RESOLVED;

        // Full refund to creator (no submissions = no slash)
        (bool success, ) = payable(bounty.creator).call{value: bounty.amount}("");
        require(success, "Refund failed");

        emit WinnerSelected(_bountyId, address(0), 0, 0); // No winner event
    }

    // ============ VIEW FUNCTIONS ============

    function getBounty(uint256 _bountyId) external view validBounty(_bountyId) returns (
        address creator,
        string memory title,
        string memory description,
        uint256 amount,
        uint256 openDeadline,
        uint256 judgingDeadline,
        uint256 slashPercent,
        BountyStatus status,
        address selectedWinner,
        uint256 selectedSubmissionId,
        uint256 submissionCount,
        uint256 totalDeposits
    ) {
        Bounty storage bounty = bounties[_bountyId];
        return (
            bounty.creator,
            bounty.title,
            bounty.description,
            bounty.amount,
            bounty.openDeadline,
            bounty.judgingDeadline,
            bounty.slashPercent,
            bounty.status,
            bounty.selectedWinner,
            bounty.selectedSubmissionId,
            bounty.submissions.length,
            bounty.totalDeposits
        );
    }

    function getSubmission(uint256 _bountyId, uint256 _subId) external view validBounty(_bountyId) returns (
        address submitter,
        string memory ipfsCid,
        string memory socialHandle,
        uint256 deposit,
        uint256 timestamp
    ) {
        require(_subId < bounties[_bountyId].submissions.length, "Invalid submission ID");
        Submission storage sub = bounties[_bountyId].submissions[_subId];
        return (sub.submitter, sub.ipfsCid, sub.socialHandle, sub.deposit, sub.timestamp);
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

    function getSocialAccount(address _wallet) external view returns (
        string memory xHandle,
        string memory email,
        uint256 linkedAt,
        bool verified
    ) {
        SocialAccount storage account = socialAccounts[_wallet];
        return (account.xHandle, account.email, account.linkedAt, account.verified);
    }

    function getRequiredDeposit(uint256 _bountyId) external view validBounty(_bountyId) returns (uint256) {
        return (bounties[_bountyId].amount * DEPOSIT_PERCENT) / 10000;
    }

    function getCurrentPhase(uint256 _bountyId) external view validBounty(_bountyId) returns (string memory) {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.status == BountyStatus.RESOLVED) return "RESOLVED";
        if (bounty.status == BountyStatus.SLASHED) return "SLASHED";
        if (block.timestamp <= bounty.openDeadline) return "OPEN";
        if (block.timestamp <= bounty.judgingDeadline) return "JUDGING";
        return "SLASH_PENDING";
    }

    receive() external payable {}
}
