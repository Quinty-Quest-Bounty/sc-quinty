// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQuinty {
    function getBounty(uint256 _id) external view returns (
        address creator,
        string memory description,
        uint256 amount,
        uint256 deadline,
        bool allowMultipleWinners,
        uint256[] memory winnerShares,
        bool resolved,
        uint256 slashPercent,
        address[] memory winners,
        bool slashed
    );

    function getSubmissionCount(uint256 _bountyId) external view returns (uint256);

    function getSubmission(uint256 _bountyId, uint256 _subId) external view returns (
        uint256 bountyId,
        address solver,
        string memory blindedIpfsCid,
        uint256 deposit,
        string[] memory replies,
        string memory revealIpfsCid,
        uint256 timestamp
    );
}

contract DisputeResolver is Ownable, ReentrancyGuard {

    struct Vote {
        address voter;
        uint256 stake; // 0.0001 STT
        uint256[] rankedSubIds; // 1-3 ranks
        uint256 timestamp;
    }

    struct Dispute {
        uint256 bountyId;
        bool isExpiry; // Expiry vs pengadilan
        uint256 amount; // Slash or full bounty
        uint256 votingEnd;
        Vote[] votes;
        bool resolved;
        uint256[] finalRanking; // Top 3 submission IDs
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;
    uint256 public constant MIN_STAKE = 0.0001 ether; // 0.0001 STT
    uint256 public constant VOTING_DURATION = 3 days;
    address public quintyAddress;

    event DisputeInitiated(uint256 indexed disputeId, uint256 bountyId, bool isExpiry, uint256 amount);
    event VoteCast(uint256 indexed disputeId, address voter, uint256[] rankedSubIds, uint256 stake);
    event DisputeResolved(uint256 indexed disputeId, uint256[] topRanks, uint256[] distributions);
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);

    modifier onlyQuinty() {
        require(msg.sender == quintyAddress, "Only Quinty contract");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setQuintyAddress(address _quintyAddress) external onlyOwner {
        quintyAddress = _quintyAddress;
    }

    function initiateExpiryVote(uint256 _bountyId, uint256 _slashAmount) external onlyQuinty {
        disputeCounter++;
        uint256 disputeId = disputeCounter;

        Dispute storage dispute = disputes[disputeId];
        dispute.bountyId = _bountyId;
        dispute.isExpiry = true;
        dispute.amount = _slashAmount;
        dispute.votingEnd = block.timestamp + VOTING_DURATION;
        dispute.resolved = false;

        emit DisputeInitiated(disputeId, _bountyId, true, _slashAmount);
    }

    function initiatePengadilanDispute(uint256 _bountyId) external {
        // Get bounty info from Quinty contract
        (address creator, , uint256 amount, , , , bool resolved, , , ) = IQuinty(quintyAddress).getBounty(_bountyId);
        require(msg.sender == creator, "Only creator can dispute");
        require(resolved, "Bounty not resolved");

        disputeCounter++;
        uint256 disputeId = disputeCounter;

        Dispute storage dispute = disputes[disputeId];
        dispute.bountyId = _bountyId;
        dispute.isExpiry = false;
        dispute.amount = amount;
        dispute.votingEnd = block.timestamp + VOTING_DURATION;
        dispute.resolved = false;

        emit DisputeInitiated(disputeId, _bountyId, false, amount);
    }

    function vote(uint256 _disputeId, uint256[] memory _rankedSubIds) external payable nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        require(!dispute.resolved && block.timestamp <= dispute.votingEnd, "Dispute inactive");
        require(msg.value >= MIN_STAKE, "Minimum 0.0001 STT stake required");
        require(_rankedSubIds.length == 3, "Must rank exactly 3 submissions");
        require(!dispute.hasVoted[msg.sender], "Already voted");

        // Validate submission IDs exist
        uint256 subCount = IQuinty(quintyAddress).getSubmissionCount(dispute.bountyId);
        for (uint i = 0; i < 3; i++) {
            require(_rankedSubIds[i] < subCount, "Invalid submission ID");
        }

        // Ensure no duplicate rankings
        for (uint i = 0; i < 3; i++) {
            for (uint j = i + 1; j < 3; j++) {
                require(_rankedSubIds[i] != _rankedSubIds[j], "Duplicate rankings not allowed");
            }
        }

        dispute.votes.push(Vote({
            voter: msg.sender,
            stake: msg.value,
            rankedSubIds: _rankedSubIds,
            timestamp: block.timestamp
        }));

        dispute.hasVoted[msg.sender] = true;

        emit VoteCast(_disputeId, msg.sender, _rankedSubIds, msg.value);
    }

    function resolveDispute(uint256 _disputeId) external nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        require(block.timestamp > dispute.votingEnd && !dispute.resolved, "Not resolvable");
        require(dispute.votes.length > 0, "No votes cast");

        uint256[] memory topRanks = _tallyRanks(dispute);
        dispute.finalRanking = topRanks;
        uint256[] memory distributions = new uint256[](topRanks.length);

        if (dispute.isExpiry) {
            _resolveExpiryDispute(dispute, topRanks, distributions);
        } else {
            _resolvePengadilanDispute(dispute, topRanks, distributions);
        }

        dispute.resolved = true;
        emit DisputeResolved(_disputeId, topRanks, distributions);
    }

    function _resolveExpiryDispute(
        Dispute storage dispute,
        uint256[] memory topRanks,
        uint256[] memory distributions
    ) internal {
        // For expiry: 10% to top non-winner solver, 5% to correct voters
        uint256 topSolverReward = dispute.amount / 10; // 10%
        uint256 voterPoolReward = dispute.amount / 20; // 5%
        uint256 remaining = dispute.amount - topSolverReward - voterPoolReward;

        // Reward top solver (assuming they weren't originally selected as winner)
        if (topRanks.length > 0) {
            (, address topSolver, , , , , ) = IQuinty(quintyAddress).getSubmission(dispute.bountyId, topRanks[0]);
            (bool success, ) = payable(topSolver).call{value: topSolverReward}("");
            if (success) {
                emit RewardDistributed(topSolver, topSolverReward, "Top non-winner solver reward");
                distributions[0] = topSolverReward;
            }
        }

        // Distribute voter pool to voters who correctly ranked the top submission
        _distributeToCorrectVoters(dispute, topRanks, voterPoolReward);

        // Send remaining back to contract or burn
        if (remaining > 0) {
            // Keep in contract for future rewards or governance decisions
        }
    }

    function _resolvePengadilanDispute(
        Dispute storage dispute,
        uint256[] memory topRanks,
        uint256[] memory distributions
    ) internal {
        // Check if community wants to overturn the decision
        bool shouldOverturn = _shouldOverturn(dispute);

        if (shouldOverturn) {
            // 80% refund to creator, 10% to voters, 10% to original winner
            (address creator, , , , , , , , , ) = IQuinty(quintyAddress).getBounty(dispute.bountyId);

            uint256 creatorRefund = (dispute.amount * 80) / 100;
            uint256 voterReward = dispute.amount / 10;
            uint256 solverKeep = dispute.amount / 10;

            // Refund creator
            (bool success, ) = payable(creator).call{value: creatorRefund}("");
            if (success) {
                emit RewardDistributed(creator, creatorRefund, "Pengadilan creator refund");
            }

            // Reward voters who voted to overturn
            _distributeToCorrectVoters(dispute, topRanks, voterReward);

            // Original winner keeps 10% (handled elsewhere or kept in contract)
        } else {
            // If not overturned, return stakes to voters
            _refundAllVoters(dispute);
        }
    }

    function _tallyRanks(Dispute storage dispute) internal view returns (uint256[] memory) {
        if (dispute.votes.length == 0) {
            return new uint256[](0);
        }

        uint256 subCount = IQuinty(quintyAddress).getSubmissionCount(dispute.bountyId);
        uint256[] memory scores = new uint256[](subCount);

        // Weighted scoring: 1st place = 3 points, 2nd = 2 points, 3rd = 1 point
        // Weight by stake amount
        for (uint i = 0; i < dispute.votes.length; i++) {
            Vote storage currentVote = dispute.votes[i];
            for (uint j = 0; j < currentVote.rankedSubIds.length; j++) {
                uint256 subId = currentVote.rankedSubIds[j];
                uint256 points = (3 - j); // 3, 2, 1 points
                uint256 weightedPoints = (points * currentVote.stake) / MIN_STAKE;
                scores[subId] += weightedPoints;
            }
        }

        // Find top 3 submissions
        uint256[] memory topRanks = new uint256[](3);
        uint256[] memory topScores = new uint256[](3);

        for (uint256 i = 0; i < subCount; i++) {
            for (uint256 j = 0; j < 3; j++) {
                if (scores[i] > topScores[j]) {
                    // Shift lower ranks down
                    for (uint256 k = 2; k > j; k--) {
                        topScores[k] = topScores[k-1];
                        topRanks[k] = topRanks[k-1];
                    }
                    topScores[j] = scores[i];
                    topRanks[j] = i;
                    break;
                }
            }
        }

        // Filter out zero scores
        uint256 validCount = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (topScores[i] > 0) validCount++;
        }

        uint256[] memory result = new uint256[](validCount);
        for (uint256 i = 0; i < validCount; i++) {
            result[i] = topRanks[i];
        }

        return result;
    }

    function _shouldOverturn(Dispute storage dispute) internal view returns (bool) {
        // Simple majority vote for overturn in pengadilan disputes
        // In a real implementation, this could be more sophisticated
        uint256 overturnVotes = 0;
        uint256 totalStake = 0;
        uint256 overturnStake = 0;

        for (uint256 i = 0; i < dispute.votes.length; i++) {
            Vote storage currentVote = dispute.votes[i];
            totalStake += currentVote.stake;

            // Assume first ranked submission indicates overturn preference
            // This is simplified - real implementation would need clearer voting mechanism
            if (currentVote.rankedSubIds.length > 0) {
                overturnVotes++;
                overturnStake += currentVote.stake;
            }
        }

        // Require both majority of votes AND majority of stake
        return (overturnVotes * 2 > dispute.votes.length) &&
               (overturnStake * 2 > totalStake);
    }

    function _distributeToCorrectVoters(
        Dispute storage dispute,
        uint256[] memory topRanks,
        uint256 poolAmount
    ) internal {
        if (topRanks.length == 0 || poolAmount == 0) return;

        uint256 correctVoterStake = 0;
        uint256 topSubmissionId = topRanks[0];

        // Calculate total stake of voters who correctly ranked the top submission first
        for (uint256 i = 0; i < dispute.votes.length; i++) {
            Vote storage currentVote = dispute.votes[i];
            if (currentVote.rankedSubIds.length > 0 && currentVote.rankedSubIds[0] == topSubmissionId) {
                correctVoterStake += currentVote.stake;
            }
        }

        if (correctVoterStake == 0) return;

        // Distribute proportionally to correct voters
        for (uint256 i = 0; i < dispute.votes.length; i++) {
            Vote storage currentVote = dispute.votes[i];
            if (currentVote.rankedSubIds.length > 0 && currentVote.rankedSubIds[0] == topSubmissionId) {
                uint256 reward = (poolAmount * currentVote.stake) / correctVoterStake;
                if (reward > 0) {
                    (bool success, ) = payable(currentVote.voter).call{value: reward}("");
                    if (success) {
                        emit RewardDistributed(currentVote.voter, reward, "Correct voter reward");
                    }
                }
            }
        }
    }

    function _refundAllVoters(Dispute storage dispute) internal {
        for (uint256 i = 0; i < dispute.votes.length; i++) {
            Vote storage currentVote = dispute.votes[i];
            if (currentVote.stake > 0) {
                (bool success, ) = payable(currentVote.voter).call{value: currentVote.stake}("");
                if (success) {
                    emit RewardDistributed(currentVote.voter, currentVote.stake, "Stake refund");
                }
            }
        }
    }

    function getDispute(uint256 _disputeId) external view returns (
        uint256 bountyId,
        bool isExpiry,
        uint256 amount,
        uint256 votingEnd,
        bool resolved,
        uint256 voteCount
    ) {
        Dispute storage dispute = disputes[_disputeId];
        return (
            dispute.bountyId,
            dispute.isExpiry,
            dispute.amount,
            dispute.votingEnd,
            dispute.resolved,
            dispute.votes.length
        );
    }

    function getVote(uint256 _disputeId, uint256 _voteIndex) external view returns (
        address voter,
        uint256 stake,
        uint256[] memory rankedSubIds,
        uint256 timestamp
    ) {
        require(_voteIndex < disputes[_disputeId].votes.length, "Invalid vote index");
        Vote storage currentVote = disputes[_disputeId].votes[_voteIndex];
        return (currentVote.voter, currentVote.stake, currentVote.rankedSubIds, currentVote.timestamp);
    }

    function hasVoted(uint256 _disputeId, address _voter) external view returns (bool) {
        return disputes[_disputeId].hasVoted[_voter];
    }

    receive() external payable {}
}