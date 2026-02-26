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
}

/**
 * @title Quest V2
 * @notice Social quest/promotion tasks with ERC-20 support, pull-based withdrawals,
 *         delegated verifiers, reputation integration, and emergency pause.
 *
 * Flow:
 * 1. Creator creates quest with ETH/ERC-20 escrow (perQualifier * maxQualifiers)
 * 2. Users submit entries with IPFS proof
 * 3. Creator or delegated verifier approves entries -> reward credited
 * 4. Quest finalizes when max qualifiers reached or deadline passes
 * 5. Users withdraw credited funds via pull pattern
 */
contract Quest is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum VerificationStatus { Pending, Approved, Rejected }

    struct QuestData {
        address creator;
        string title;
        string description;
        address token;            // address(0) for ETH, token address for ERC-20
        uint256 totalAmount;      // Total escrowed
        uint256 perQualifier;     // Reward per approved entry
        uint256 maxQualifiers;    // Max number of rewards
        uint256 qualifiersCount;  // Current approved count
        uint256 deadline;
        uint256 createdAt;
        bool resolved;
        bool cancelled;
        string requirements;      // IPFS CID with detailed requirements
    }

    struct Entry {
        address solver;
        string ipfsProofCid;
        uint256 timestamp;
        VerificationStatus status;
        string feedback;
    }

    mapping(uint256 => QuestData) public quests;
    mapping(uint256 => Entry[]) public entries;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(uint256 => mapping(address => uint256)) public userSubmissionIndex;

    // Delegated verifiers per quest
    mapping(uint256 => mapping(address => bool)) public questVerifiers;

    // Pull-based withdrawals: token => user => amount
    mapping(address => mapping(address => uint256)) public pendingWithdrawals;
    mapping(address => uint256) public totalEscrowed;

    // Token whitelist
    mapping(address => bool) public allowedTokens;

    uint256 public questCounter;

    address public reputationAddress;

    // Events
    event QuestCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        address token,
        uint256 perQualifier,
        uint256 maxQualifiers,
        uint256 deadline
    );
    event EntrySubmitted(
        uint256 indexed id,
        address indexed solver,
        string ipfsProofCid
    );
    event EntryVerified(
        uint256 indexed questId,
        uint256 indexed entryId,
        address indexed verifier,
        VerificationStatus status
    );
    event QuestFinalized(uint256 indexed id, address[] qualifiers, uint256 totalDistributed);
    event QuestCancelled(uint256 indexed id, uint256 refundAmount);
    event VerifierAdded(uint256 indexed questId, address indexed verifier);
    event VerifierRemoved(uint256 indexed questId, address indexed verifier);
    event FundsCredited(address indexed token, address indexed recipient, uint256 amount);
    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
    event TokenAllowed(address indexed token);
    event TokenRevoked(address indexed token);

    modifier validQuest(uint256 _id) {
        require(_id > 0 && _id <= questCounter, "Invalid quest ID");
        _;
    }

    modifier questActive(uint256 _id) {
        QuestData storage quest = quests[_id];
        require(
            block.timestamp <= quest.deadline &&
            !quest.resolved &&
            !quest.cancelled,
            "Quest inactive"
        );
        _;
    }

    modifier onlyCreator(uint256 _id) {
        require(msg.sender == quests[_id].creator, "Not quest creator");
        _;
    }

    modifier onlyQuestVerifier(uint256 _id) {
        require(
            msg.sender == quests[_id].creator ||
            questVerifiers[_id][msg.sender],
            "Not authorized verifier"
        );
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

    function rescueERC20(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(0), "Cannot rescue ETH");
        uint256 contractBalance = IERC20(_token).balanceOf(address(this));
        uint256 escrowed = totalEscrowed[_token];
        require(_amount <= contractBalance - escrowed, "Cannot drain escrow");
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    // ============ VERIFIER MANAGEMENT ============

    function addVerifier(uint256 _questId, address _verifier) external onlyCreator(_questId) {
        require(_verifier != address(0), "Zero address");
        questVerifiers[_questId][_verifier] = true;
        emit VerifierAdded(_questId, _verifier);
    }

    function removeVerifier(uint256 _questId, address _verifier) external onlyCreator(_questId) {
        questVerifiers[_questId][_verifier] = false;
        emit VerifierRemoved(_questId, _verifier);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Create a new quest with ETH or ERC-20 escrow
     */
    function createQuest(
        string memory _title,
        string memory _description,
        uint256 _perQualifier,
        uint256 _maxQualifiers,
        uint256 _deadline,
        string memory _requirements,
        address _token
    ) external payable whenNotPaused nonReentrant onlyAllowedToken(_token) {
        uint256 total = _perQualifier * _maxQualifiers;
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_deadline <= block.timestamp + 365 days, "Deadline too far");
        require(_maxQualifiers > 0 && _maxQualifiers <= 10000, "Invalid max qualifiers");
        require(_perQualifier > 0, "Invalid reward amount");
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_requirements).length > 0, "Requirements required");

        if (_token == address(0)) {
            require(msg.value == total, "Must escrow full amount");
        } else {
            require(msg.value == 0, "Do not send ETH for token quest");
            IERC20(_token).safeTransferFrom(msg.sender, address(this), total);
        }

        totalEscrowed[_token] += total;

        questCounter++;

        quests[questCounter] = QuestData({
            creator: msg.sender,
            title: _title,
            description: _description,
            token: _token,
            totalAmount: total,
            perQualifier: _perQualifier,
            maxQualifiers: _maxQualifiers,
            qualifiersCount: 0,
            deadline: _deadline,
            createdAt: block.timestamp,
            resolved: false,
            cancelled: false,
            requirements: _requirements
        });

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
        }

        emit QuestCreated(questCounter, msg.sender, _title, _token, _perQualifier, _maxQualifiers, _deadline);
    }

    /**
     * @notice Submit an entry to a quest
     */
    function submitEntry(
        uint256 _id,
        string memory _ipfsProofCid
    ) external validQuest(_id) questActive(_id) whenNotPaused nonReentrant {
        require(bytes(_ipfsProofCid).length > 0, "Invalid proof CID");
        require(!hasSubmitted[_id][msg.sender], "Already submitted");

        QuestData storage quest = quests[_id];
        require(entries[_id].length < quest.maxQualifiers * 3, "Too many submissions");

        uint256 entryIndex = entries[_id].length;
        entries[_id].push(Entry({
            solver: msg.sender,
            ipfsProofCid: _ipfsProofCid,
            timestamp: block.timestamp,
            status: VerificationStatus.Pending,
            feedback: ""
        }));

        hasSubmitted[_id][msg.sender] = true;
        userSubmissionIndex[_id][msg.sender] = entryIndex;

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
        }

        emit EntrySubmitted(_id, msg.sender, _ipfsProofCid);
    }

    /**
     * @notice Verify a single entry (approve or reject)
     */
    function verifyEntry(
        uint256 _questId,
        uint256 _entryId,
        VerificationStatus _status,
        string memory _feedback
    ) external onlyQuestVerifier(_questId) validQuest(_questId) whenNotPaused nonReentrant {
        require(_entryId < entries[_questId].length, "Invalid entry");
        require(_status != VerificationStatus.Pending, "Must approve or reject");

        Entry storage entry = entries[_questId][_entryId];
        require(entry.status == VerificationStatus.Pending, "Already verified");
        require(msg.sender != entry.solver, "Cannot verify own entry");

        entry.status = _status;
        entry.feedback = _feedback;

        emit EntryVerified(_questId, _entryId, msg.sender, _status);

        QuestData storage quest = quests[_questId];
        if (!quest.resolved && _status == VerificationStatus.Approved) {
            quest.qualifiersCount++;

            // Credit the approved entry via pull pattern
            _credit(quest.token, entry.solver, quest.perQualifier);
            totalEscrowed[quest.token] -= quest.perQualifier;

            if (quest.qualifiersCount >= quest.maxQualifiers) {
                _finalizeQuest(_questId);
            }
        }
    }

    /**
     * @notice Verify multiple entries at once
     */
    function verifyMultipleEntries(
        uint256 _questId,
        uint256[] memory _entryIds,
        VerificationStatus[] memory _statuses,
        string[] memory _feedbacks
    ) external onlyQuestVerifier(_questId) validQuest(_questId) whenNotPaused nonReentrant {
        require(
            _entryIds.length == _statuses.length &&
            _statuses.length == _feedbacks.length,
            "Array length mismatch"
        );
        require(_entryIds.length <= 50, "Too many entries at once");

        QuestData storage quest = quests[_questId];
        uint256 newApprovals = 0;

        for (uint i = 0; i < _entryIds.length; i++) {
            uint256 entryId = _entryIds[i];
            require(entryId < entries[_questId].length, "Invalid entry");

            Entry storage entry = entries[_questId][entryId];
            require(entry.status == VerificationStatus.Pending, "Already verified");
            require(msg.sender != entry.solver, "Cannot verify own entry");

            entry.status = _statuses[i];
            entry.feedback = _feedbacks[i];

            if (_statuses[i] == VerificationStatus.Approved) {
                newApprovals++;
                _credit(quest.token, entry.solver, quest.perQualifier);
                totalEscrowed[quest.token] -= quest.perQualifier;
            }

            emit EntryVerified(_questId, entryId, msg.sender, _statuses[i]);
        }

        if (!quest.resolved) {
            quest.qualifiersCount += newApprovals;

            if (quest.qualifiersCount >= quest.maxQualifiers) {
                _finalizeQuest(_questId);
            }
        }
    }

    /**
     * @notice Finalize quest and refund unused funds
     */
    function finalizeQuest(uint256 _id) external validQuest(_id) whenNotPaused nonReentrant {
        QuestData storage quest = quests[_id];
        require(
            msg.sender == quest.creator ||
            msg.sender == owner() ||
            block.timestamp > quest.deadline,
            "Not authorized to finalize"
        );
        require(!quest.resolved && !quest.cancelled, "Already finalized");

        _finalizeQuest(_id);
    }

    function _finalizeQuest(uint256 _id) internal {
        QuestData storage quest = quests[_id];

        uint256 paidOut = quest.qualifiersCount * quest.perQualifier;
        uint256 unusedAmount = quest.totalAmount - paidOut;

        if (unusedAmount > 0) {
            _credit(quest.token, quest.creator, unusedAmount);
            totalEscrowed[quest.token] -= unusedAmount;
        }

        quest.resolved = true;

        address[] memory qualifiers = new address[](quest.qualifiersCount);
        uint256 qualifierIndex = 0;
        for (uint i = 0; i < entries[_id].length && qualifierIndex < quest.qualifiersCount; i++) {
            if (entries[_id][i].status == VerificationStatus.Approved) {
                qualifiers[qualifierIndex] = entries[_id][i].solver;
                qualifierIndex++;
            }
        }

        emit QuestFinalized(_id, qualifiers, paidOut);
    }

    /**
     * @notice Cancel quest and refund creator (only if no approvals yet)
     *         Available during pause since it's a refund.
     */
    function cancelQuest(uint256 _id) external validQuest(_id) onlyCreator(_id) nonReentrant {
        QuestData storage quest = quests[_id];
        require(!quest.resolved && !quest.cancelled, "Cannot cancel");
        require(quest.qualifiersCount == 0, "Has approved entries");

        quest.cancelled = true;

        _credit(quest.token, quest.creator, quest.totalAmount);
        totalEscrowed[quest.token] -= quest.totalAmount;

        emit QuestCancelled(_id, quest.totalAmount);
    }

    // ============ WITHDRAWAL FUNCTIONS ============

    function withdrawETH() external nonReentrant {
        uint256 amount = pendingWithdrawals[address(0)][msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[address(0)][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit Withdrawn(address(0), msg.sender, amount);
    }

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

    function getQuest(uint256 _id) external view validQuest(_id) returns (
        address creator,
        string memory title,
        string memory description,
        address token,
        uint256 totalAmount,
        uint256 perQualifier,
        uint256 maxQualifiers,
        uint256 qualifiersCount,
        uint256 deadline,
        uint256 createdAt,
        bool resolved,
        bool cancelled,
        string memory requirements
    ) {
        QuestData storage quest = quests[_id];
        return (
            quest.creator, quest.title, quest.description, quest.token,
            quest.totalAmount, quest.perQualifier, quest.maxQualifiers,
            quest.qualifiersCount, quest.deadline, quest.createdAt,
            quest.resolved, quest.cancelled, quest.requirements
        );
    }

    function getEntry(uint256 _questId, uint256 _entryId) external view returns (
        address solver,
        string memory ipfsProofCid,
        uint256 timestamp,
        VerificationStatus status,
        string memory feedback
    ) {
        require(_entryId < entries[_questId].length, "Invalid entry");
        Entry storage entry = entries[_questId][_entryId];
        return (entry.solver, entry.ipfsProofCid, entry.timestamp, entry.status, entry.feedback);
    }

    function getEntryCount(uint256 _questId) external view validQuest(_questId) returns (uint256) {
        return entries[_questId].length;
    }

    function getUserSubmission(uint256 _questId, address _user) external view returns (
        bool hasSubmittedEntry,
        uint256 submissionIndex,
        VerificationStatus status
    ) {
        hasSubmittedEntry = hasSubmitted[_questId][_user];
        if (hasSubmittedEntry) {
            submissionIndex = userSubmissionIndex[_questId][_user];
            status = entries[_questId][submissionIndex].status;
        } else {
            submissionIndex = 0;
            status = VerificationStatus.Pending;
        }
    }

    function getQuestStats(uint256 _questId) external view validQuest(_questId) returns (
        uint256 totalEntries,
        uint256 pendingEntries,
        uint256 approvedEntries,
        uint256 rejectedEntries,
        uint256 remainingSlots
    ) {
        QuestData storage quest = quests[_questId];
        totalEntries = entries[_questId].length;

        for (uint i = 0; i < totalEntries; i++) {
            VerificationStatus status = entries[_questId][i].status;
            if (status == VerificationStatus.Pending) pendingEntries++;
            else if (status == VerificationStatus.Approved) approvedEntries++;
            else rejectedEntries++;
        }

        remainingSlots = quest.maxQualifiers > approvedEntries ?
            quest.maxQualifiers - approvedEntries : 0;
    }

    function pendingBalance(address _token, address _user) external view returns (uint256) {
        return pendingWithdrawals[_token][_user];
    }

    receive() external payable {}
}
