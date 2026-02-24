// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Quest
 * @notice Social quest/promotion tasks with fixed ETH rewards
 *
 * Flow:
 * 1. Creator creates quest with escrow (perQualifier * maxQualifiers)
 * 2. Users submit entries with IPFS proof
 * 3. Creator approves entries -> immediate payout
 * 4. Quest finalizes when max qualifiers reached or deadline passes
 */
contract Quest is Ownable, ReentrancyGuard {

    enum VerificationStatus { Pending, Approved, Rejected }

    struct QuestData {
        address creator;
        string title;
        string description;
        uint256 totalAmount;      // ETH escrowed
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
        string ipfsProofCid;      // IPFS CID with proof (screenshot, link)
        uint256 timestamp;
        VerificationStatus status;
        string feedback;          // Optional feedback from verifier
    }

    mapping(uint256 => QuestData) public quests;
    mapping(uint256 => Entry[]) public entries;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(uint256 => mapping(address => uint256)) public userSubmissionIndex;

    uint256 public questCounter;

    event QuestCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
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

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Create a new quest with ETH escrow
     * @param _title Quest title
     * @param _description Quest description
     * @param _perQualifier Reward per approved qualifier
     * @param _maxQualifiers Maximum number of qualifiers
     * @param _deadline Deadline timestamp
     * @param _requirements IPFS CID with detailed requirements
     */
    function createQuest(
        string memory _title,
        string memory _description,
        uint256 _perQualifier,
        uint256 _maxQualifiers,
        uint256 _deadline,
        string memory _requirements
    ) external payable nonReentrant {
        require(msg.value == _perQualifier * _maxQualifiers, "Must escrow full amount");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_deadline <= block.timestamp + 365 days, "Deadline too far");
        require(_maxQualifiers > 0 && _maxQualifiers <= 10000, "Invalid max qualifiers");
        require(_perQualifier > 0, "Invalid reward amount");
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_requirements).length > 0, "Requirements required");

        questCounter++;

        quests[questCounter] = QuestData({
            creator: msg.sender,
            title: _title,
            description: _description,
            totalAmount: msg.value,
            perQualifier: _perQualifier,
            maxQualifiers: _maxQualifiers,
            qualifiersCount: 0,
            deadline: _deadline,
            createdAt: block.timestamp,
            resolved: false,
            cancelled: false,
            requirements: _requirements
        });

        emit QuestCreated(questCounter, msg.sender, _title, _perQualifier, _maxQualifiers, _deadline);
    }

    /**
     * @notice Submit an entry to a quest
     * @param _id Quest ID
     * @param _ipfsProofCid IPFS CID containing proof of completion
     */
    function submitEntry(
        uint256 _id,
        string memory _ipfsProofCid
    ) external validQuest(_id) questActive(_id) nonReentrant {
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

        emit EntrySubmitted(_id, msg.sender, _ipfsProofCid);
    }

    /**
     * @notice Verify a single entry (approve or reject)
     * @param _questId Quest ID
     * @param _entryId Entry ID
     * @param _status Verification status (1=Approved, 2=Rejected)
     * @param _feedback Optional feedback message
     */
    function verifyEntry(
        uint256 _questId,
        uint256 _entryId,
        VerificationStatus _status,
        string memory _feedback
    ) external onlyCreator(_questId) validQuest(_questId) nonReentrant {
        require(_entryId < entries[_questId].length, "Invalid entry");
        require(_status != VerificationStatus.Pending, "Must approve or reject");

        Entry storage entry = entries[_questId][_entryId];
        require(entry.status == VerificationStatus.Pending, "Already verified");

        entry.status = _status;
        entry.feedback = _feedback;

        emit EntryVerified(_questId, _entryId, msg.sender, _status);

        QuestData storage quest = quests[_questId];
        if (!quest.resolved && _status == VerificationStatus.Approved) {
            quest.qualifiersCount++;

            // Pay the approved entry immediately
            (bool success, ) = payable(entry.solver).call{value: quest.perQualifier}("");
            require(success, "Payment failed");

            // Auto-finalize if max qualifiers reached
            if (quest.qualifiersCount >= quest.maxQualifiers) {
                _finalizeQuest(_questId);
            }
        }
    }

    /**
     * @notice Verify multiple entries at once
     * @param _questId Quest ID
     * @param _entryIds Array of entry IDs
     * @param _statuses Array of verification statuses
     * @param _feedbacks Array of feedback messages
     */
    function verifyMultipleEntries(
        uint256 _questId,
        uint256[] memory _entryIds,
        VerificationStatus[] memory _statuses,
        string[] memory _feedbacks
    ) external onlyCreator(_questId) validQuest(_questId) nonReentrant {
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

            entry.status = _statuses[i];
            entry.feedback = _feedbacks[i];

            if (_statuses[i] == VerificationStatus.Approved) {
                newApprovals++;
                // Pay approved entry
                (bool success, ) = payable(entry.solver).call{value: quest.perQualifier}("");
                require(success, "Payment failed");
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
     * @param _id Quest ID
     */
    function finalizeQuest(uint256 _id) external validQuest(_id) nonReentrant {
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

        // Calculate unused amount (already paid out during verification)
        uint256 paidOut = quest.qualifiersCount * quest.perQualifier;
        uint256 unusedAmount = quest.totalAmount - paidOut;

        // Refund unused amount to creator
        if (unusedAmount > 0) {
            (bool success, ) = payable(quest.creator).call{value: unusedAmount}("");
            require(success, "Refund failed");
        }

        quest.resolved = true;

        // Collect qualifier addresses for event
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
     * @param _id Quest ID
     */
    function cancelQuest(uint256 _id) external validQuest(_id) onlyCreator(_id) nonReentrant {
        QuestData storage quest = quests[_id];
        require(!quest.resolved && !quest.cancelled, "Cannot cancel");
        require(quest.qualifiersCount == 0, "Has approved entries");

        quest.cancelled = true;

        // Refund creator
        (bool success, ) = payable(quest.creator).call{value: quest.totalAmount}("");
        require(success, "Refund failed");

        emit QuestCancelled(_id, quest.totalAmount);
    }

    // ============ VIEW FUNCTIONS ============

    function getQuest(uint256 _id) external view validQuest(_id) returns (
        address creator,
        string memory title,
        string memory description,
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
            quest.creator,
            quest.title,
            quest.description,
            quest.totalAmount,
            quest.perQualifier,
            quest.maxQualifiers,
            quest.qualifiersCount,
            quest.deadline,
            quest.createdAt,
            quest.resolved,
            quest.cancelled,
            quest.requirements
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
        return (
            entry.solver,
            entry.ipfsProofCid,
            entry.timestamp,
            entry.status,
            entry.feedback
        );
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

    receive() external payable {}
}
