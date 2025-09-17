// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AirdropBounty is Ownable, ReentrancyGuard {

    enum VerificationStatus { Pending, Approved, Rejected }

    struct Airdrop {
        address creator;
        string title;
        string description;
        uint256 totalAmount; // STT escrowed
        uint256 perQualifier; // e.g., 10 STT per person
        uint256 maxQualifiers; // e.g., 100 people max
        uint256 qualifiersCount;
        uint256 deadline;
        uint256 createdAt;
        bool resolved;
        bool cancelled;
        string requirements; // IPFS CID with detailed requirements
    }

    struct Entry {
        address solver;
        string ipfsProofCid; // X post link/screenshot via IPFS
        uint256 timestamp;
        VerificationStatus status;
        string feedback; // Optional feedback from verifiers
    }

    mapping(uint256 => Airdrop) public airdrops;
    mapping(uint256 => Entry[]) public entries;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(uint256 => mapping(address => uint256)) public userSubmissionIndex;
    uint256 public airdropCounter;

    // Verification system
    mapping(address => bool) public verifiers;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public verifierApprovals;

    event AirdropCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        uint256 perQualifier,
        uint256 maxQualifiers,
        uint256 deadline
    );
    event EntrySubmitted(uint256 indexed id, address indexed solver, string ipfsProofCid);
    event EntryVerified(uint256 indexed airdropId, uint256 indexed entryId, address indexed verifier, VerificationStatus status);
    event QualifiedAndDistributed(uint256 indexed id, address[] qualifiers, uint256 totalDistributed);
    event AirdropCancelled(uint256 indexed id, uint256 refundAmount);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized verifier");
        _;
    }

    modifier validAirdrop(uint256 _id) {
        require(_id > 0 && _id <= airdropCounter, "Invalid airdrop ID");
        _;
    }

    modifier airdropActive(uint256 _id) {
        Airdrop storage airdrop = airdrops[_id];
        require(
            block.timestamp <= airdrop.deadline &&
            !airdrop.resolved &&
            !airdrop.cancelled,
            "Airdrop inactive"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    function addVerifier(address _verifier) external onlyOwner {
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }

    function removeVerifier(address _verifier) external onlyOwner {
        verifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }

    function createAirdrop(
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

        airdropCounter++;

        airdrops[airdropCounter] = Airdrop({
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

        emit AirdropCreated(airdropCounter, msg.sender, _title, _perQualifier, _maxQualifiers, _deadline);
    }

    function submitEntry(uint256 _id, string memory _ipfsProofCid)
        external
        validAirdrop(_id)
        airdropActive(_id)
        nonReentrant
    {
        require(bytes(_ipfsProofCid).length > 0, "Invalid proof CID");
        require(!hasSubmitted[_id][msg.sender], "Already submitted");

        Airdrop storage airdrop = airdrops[_id];
        require(entries[_id].length < airdrop.maxQualifiers * 3, "Too many submissions"); // Allow 3x buffer

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

    function verifyEntry(
        uint256 _airdropId,
        uint256 _entryId,
        VerificationStatus _status,
        string memory _feedback
    ) external onlyVerifier validAirdrop(_airdropId) nonReentrant {
        require(_entryId < entries[_airdropId].length, "Invalid entry");
        require(_status != VerificationStatus.Pending, "Must approve or reject");

        Entry storage entry = entries[_airdropId][_entryId];
        require(entry.status == VerificationStatus.Pending, "Already verified");

        entry.status = _status;
        entry.feedback = _feedback;
        verifierApprovals[_airdropId][_entryId][msg.sender] = (_status == VerificationStatus.Approved);

        emit EntryVerified(_airdropId, _entryId, msg.sender, _status);

        // Auto-distribute if we have enough approved entries
        Airdrop storage airdrop = airdrops[_airdropId];
        if (!airdrop.resolved && _status == VerificationStatus.Approved) {
            airdrop.qualifiersCount++;

            if (airdrop.qualifiersCount >= airdrop.maxQualifiers) {
                _finalizeAirdrop(_airdropId);
            }
        }
    }

    function verifyMultipleEntries(
        uint256 _airdropId,
        uint256[] memory _entryIds,
        VerificationStatus[] memory _statuses,
        string[] memory _feedbacks
    ) external onlyVerifier validAirdrop(_airdropId) nonReentrant {
        require(
            _entryIds.length == _statuses.length &&
            _statuses.length == _feedbacks.length,
            "Array length mismatch"
        );
        require(_entryIds.length <= 50, "Too many entries at once");

        uint256 newApprovals = 0;

        for (uint i = 0; i < _entryIds.length; i++) {
            uint256 entryId = _entryIds[i];
            require(entryId < entries[_airdropId].length, "Invalid entry");

            Entry storage entry = entries[_airdropId][entryId];
            require(entry.status == VerificationStatus.Pending, "Already verified");

            entry.status = _statuses[i];
            entry.feedback = _feedbacks[i];
            verifierApprovals[_airdropId][entryId][msg.sender] = (_statuses[i] == VerificationStatus.Approved);

            if (_statuses[i] == VerificationStatus.Approved) {
                newApprovals++;
            }

            emit EntryVerified(_airdropId, entryId, msg.sender, _statuses[i]);
        }

        // Update counter and check for auto-finalization
        Airdrop storage airdrop = airdrops[_airdropId];
        if (!airdrop.resolved) {
            airdrop.qualifiersCount += newApprovals;

            if (airdrop.qualifiersCount >= airdrop.maxQualifiers) {
                _finalizeAirdrop(_airdropId);
            }
        }
    }

    function finalizeAirdrop(uint256 _id) external validAirdrop(_id) nonReentrant {
        Airdrop storage airdrop = airdrops[_id];
        require(
            msg.sender == airdrop.creator ||
            msg.sender == owner() ||
            block.timestamp > airdrop.deadline,
            "Not authorized to finalize"
        );
        require(!airdrop.resolved && !airdrop.cancelled, "Already finalized");

        _finalizeAirdrop(_id);
    }

    function _finalizeAirdrop(uint256 _id) internal {
        Airdrop storage airdrop = airdrops[_id];

        // Get all approved entries
        address[] memory qualifiers = new address[](airdrop.qualifiersCount);
        uint256 qualifierIndex = 0;
        uint256 actualDistributed = 0;

        for (uint i = 0; i < entries[_id].length && qualifierIndex < airdrop.maxQualifiers; i++) {
            if (entries[_id][i].status == VerificationStatus.Approved) {
                qualifiers[qualifierIndex] = entries[_id][i].solver;

                // Distribute reward
                (bool success, ) = payable(entries[_id][i].solver).call{value: airdrop.perQualifier}("");
                if (success) {
                    actualDistributed += airdrop.perQualifier;
                    qualifierIndex++;
                }
            }
        }

        // Refund unused amount to creator
        uint256 unusedAmount = airdrop.totalAmount - actualDistributed;
        if (unusedAmount > 0) {
            (bool success, ) = payable(airdrop.creator).call{value: unusedAmount}("");
            require(success, "Refund failed");
        }

        airdrop.resolved = true;
        airdrop.qualifiersCount = qualifierIndex;

        // Trim qualifiers array to actual size
        address[] memory actualQualifiers = new address[](qualifierIndex);
        for (uint i = 0; i < qualifierIndex; i++) {
            actualQualifiers[i] = qualifiers[i];
        }

        emit QualifiedAndDistributed(_id, actualQualifiers, actualDistributed);
    }

    function cancelAirdrop(uint256 _id) external validAirdrop(_id) nonReentrant {
        Airdrop storage airdrop = airdrops[_id];
        require(msg.sender == airdrop.creator, "Only creator can cancel");
        require(!airdrop.resolved && !airdrop.cancelled, "Cannot cancel");
        require(airdrop.qualifiersCount == 0, "Has approved entries");

        airdrop.cancelled = true;

        // Refund creator
        (bool success, ) = payable(airdrop.creator).call{value: airdrop.totalAmount}("");
        require(success, "Refund failed");

        emit AirdropCancelled(_id, airdrop.totalAmount);
    }

    function getAirdrop(uint256 _id) external view validAirdrop(_id) returns (
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
        Airdrop storage airdrop = airdrops[_id];
        return (
            airdrop.creator,
            airdrop.title,
            airdrop.description,
            airdrop.totalAmount,
            airdrop.perQualifier,
            airdrop.maxQualifiers,
            airdrop.qualifiersCount,
            airdrop.deadline,
            airdrop.createdAt,
            airdrop.resolved,
            airdrop.cancelled,
            airdrop.requirements
        );
    }

    function getEntry(uint256 _airdropId, uint256 _entryId) external view returns (
        address solver,
        string memory ipfsProofCid,
        uint256 timestamp,
        VerificationStatus status,
        string memory feedback
    ) {
        require(_entryId < entries[_airdropId].length, "Invalid entry");
        Entry storage entry = entries[_airdropId][_entryId];
        return (entry.solver, entry.ipfsProofCid, entry.timestamp, entry.status, entry.feedback);
    }

    function getEntryCount(uint256 _airdropId) external view validAirdrop(_airdropId) returns (uint256) {
        return entries[_airdropId].length;
    }

    function getUserSubmission(uint256 _airdropId, address _user) external view returns (
        bool hasSubmittedEntry,
        uint256 submissionIndex,
        VerificationStatus status
    ) {
        hasSubmittedEntry = hasSubmitted[_airdropId][_user];
        if (hasSubmittedEntry) {
            submissionIndex = userSubmissionIndex[_airdropId][_user];
            status = entries[_airdropId][submissionIndex].status;
        } else {
            submissionIndex = 0;
            status = VerificationStatus.Pending;
        }
    }

    function getAirdropStats(uint256 _airdropId) external view validAirdrop(_airdropId) returns (
        uint256 totalEntries,
        uint256 pendingEntries,
        uint256 approvedEntries,
        uint256 rejectedEntries,
        uint256 remainingSlots
    ) {
        Airdrop storage airdrop = airdrops[_airdropId];
        totalEntries = entries[_airdropId].length;

        for (uint i = 0; i < totalEntries; i++) {
            VerificationStatus status = entries[_airdropId][i].status;
            if (status == VerificationStatus.Pending) pendingEntries++;
            else if (status == VerificationStatus.Approved) approvedEntries++;
            else rejectedEntries++;
        }

        remainingSlots = airdrop.maxQualifiers > approvedEntries ?
            airdrop.maxQualifiers - approvedEntries : 0;
    }

    function isVerifier(address _address) external view returns (bool) {
        return verifiers[_address];
    }

    receive() external payable {}
}