// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Quinty.sol";

contract DisputeResolver is Ownable, ReentrancyGuard {

    struct Vote {
        address voter;
        uint256 stake;
        uint256[] rankedSubIds;
    }

    struct Dispute {
        uint256 bountyId;
        address initiatedBy;
        bool isExpiryVote;
        uint256 amount;
        uint256 votingEnd;
        Vote[] votes;
        bool resolved;
        mapping(address => bool) hasVoted;
    }

    Quinty private quintyContract;
    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;

    uint256 public constant MIN_VOTING_STAKE = 0.0001 ether;
    uint256 public constant DISPUTE_STAKE_BPS = 1000; // 10% of bounty amount
    uint256 public constant VOTING_DURATION = 3 days;

    event DisputeInitiated(uint256 indexed disputeId, uint256 indexed bountyId, address indexed initiatedBy, bool isExpiryVote);
    event VoteCast(uint256 indexed disputeId, address indexed voter, uint256 stake);
    event DisputeResolved(uint256 indexed disputeId, uint256[] winningSubmissionIds);

    constructor(address _quintyAddress) Ownable(msg.sender) {
        quintyContract = Quinty(_quintyAddress);
    }

    function initiateExpiryVote(uint256 _bountyId, uint256 _slashAmount) external {
        require(msg.sender == address(quintyContract), "Only Quinty contract can initiate expiry vote");
        disputeCounter++;
        Dispute storage d = disputes[disputeCounter];
        d.bountyId = _bountyId;
        (address creator,,,,,,) = quintyContract.bounties(_bountyId);
        d.initiatedBy = creator;
        d.isExpiryVote = true;
        d.amount = _slashAmount;
        d.votingEnd = block.timestamp + VOTING_DURATION;

        emit DisputeInitiated(disputeCounter, _bountyId, d.initiatedBy, true);
    }

    function initiatePengadilanDispute(uint256 _bountyId) external payable {
        (address creator,,uint256 amount,,,Quinty.BountyStatus status,) = quintyContract.bounties(_bountyId);
        require(status == Quinty.BountyStatus.PENDING_REVEAL, "Dispute only for bounties pending reveal");
        require(msg.sender == creator, "Only bounty creator can initiate pengadilan dispute");

        // Check if there's already an active dispute for this bounty
        for (uint256 i = 1; i <= disputeCounter; i++) {
            if (disputes[i].bountyId == _bountyId && !disputes[i].resolved) {
                revert("Bounty already has an active dispute");
            }
        }

        uint256 requiredStake = (amount * DISPUTE_STAKE_BPS) / 10000;
        require(msg.value >= requiredStake, "Insufficient stake to raise dispute");

        disputeCounter++;
        Dispute storage d = disputes[disputeCounter];
        d.bountyId = _bountyId;
        d.initiatedBy = msg.sender;
        d.isExpiryVote = false;
        d.amount = amount; // The whole bounty amount is at stake
        d.votingEnd = block.timestamp + VOTING_DURATION;

        // Refund excess payment if any
        if (msg.value > requiredStake) {
            payable(msg.sender).transfer(msg.value - requiredStake);
        }

        emit DisputeInitiated(disputeCounter, _bountyId, msg.sender, false);
    }

    function vote(uint256 _disputeId, uint256[] memory _rankedSubIds) external payable {
        Dispute storage d = disputes[_disputeId];
        require(block.timestamp <= d.votingEnd, "Voting has ended");
        require(!d.hasVoted[msg.sender], "Already voted");
        require(msg.value >= MIN_VOTING_STAKE, "Insufficient stake");
        require(_rankedSubIds.length == 3, "Must rank exactly 3 submissions");

        d.votes.push(Vote({voter: msg.sender, stake: msg.value, rankedSubIds: _rankedSubIds}));
        d.hasVoted[msg.sender] = true;

        emit VoteCast(_disputeId, msg.sender, msg.value);
    }

    function resolveDispute(uint256 _disputeId) external nonReentrant {
        Dispute storage d = disputes[_disputeId];
        require(block.timestamp > d.votingEnd, "Voting not ended");
        require(!d.resolved, "Dispute already resolved");

        d.resolved = true;

        // Simple majority tally for POC, can be expanded to weighted
        // This logic is complex and would require a more detailed implementation
        // For now, we assume a resolution path and emit event
        uint256[] memory winningIds = new uint256[](1);
        if (d.votes.length > 0) {
            winningIds[0] = d.votes[0].rankedSubIds[0];
        }

        // Payout logic would go here
        // e.g., distribute d.amount to voters, refund stakes, pay new winner etc.

        emit DisputeResolved(_disputeId, winningIds);
    }

    // Helper functions for frontend
    function getDispute(uint256 _disputeId) external view returns (
        uint256 bountyId,
        bool isExpiryVote,
        uint256 amount,
        uint256 votingEnd,
        bool resolved,
        uint256 voteCount
    ) {
        Dispute storage d = disputes[_disputeId];
        return (
            d.bountyId,
            d.isExpiryVote,
            d.amount,
            d.votingEnd,
            d.resolved,
            d.votes.length
        );
    }

    function hasVoted(uint256 _disputeId, address _voter) external view returns (bool) {
        return disputes[_disputeId].hasVoted[_voter];
    }

    function getVoteCount(uint256 _disputeId) external view returns (uint256) {
        return disputes[_disputeId].votes.length;
    }

    function isDisputeActive(uint256 _bountyId) external view returns (bool) {
        for (uint256 i = 1; i <= disputeCounter; i++) {
            if (disputes[i].bountyId == _bountyId && !disputes[i].resolved) {
                return true;
            }
        }
        return false;
    }
}
