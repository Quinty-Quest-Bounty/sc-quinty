// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interfaces
interface IQuintyReputation {
    function recordBountyCreation(address _user) external;
    function recordSubmission(address _user) external;
    function recordWin(address _user) external;
}

interface IDisputeResolver {
    function initiateExpiryVote(uint256 _bountyId, uint256 _slashAmount) external;
}

contract Quinty is Ownable, ReentrancyGuard {

    enum BountyStatus { OPEN, PENDING_REVEAL, RESOLVED, DISPUTED, EXPIRED }

    struct Reply {
        address replier;
        string content;
        uint256 timestamp;
    }

    struct Submission {
        address solver;
        string blindedIpfsCid;
        string revealIpfsCid;
        uint256 deposit;
        Reply[] replies;
        bool revealed;
    }

    struct Bounty {
        address creator;
        string description;
        uint256 amount;
        uint256 deadline;
        bool allowMultipleWinners;
        uint256[] winnerShares; // Basis points
        BountyStatus status;
        uint256 slashPercent;
        Submission[] submissions;
        address[] selectedWinners;
        uint256[] selectedSubmissionIds;
    }

    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCounter;

    address public reputationAddress;
    address public disputeAddress;

    constructor() Ownable(msg.sender) {}

    event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount, uint256 deadline);
    event SubmissionCreated(uint256 indexed bountyId, uint256 subId, address solver, string ipfsCid);
    event WinnersSelected(uint256 indexed bountyId, address[] winners, uint256[] submissionIds);
    event SolutionRevealed(uint256 indexed bountyId, uint256 subId, address solver, string revealIpfsCid);
    event BountyResolved(uint256 indexed bountyId);
    event BountySlashed(uint256 indexed bountyId, uint256 slashAmount);
    event ReplyAdded(uint256 indexed bountyId, uint256 subId, address replier);

    modifier onlyCreator(uint256 _bountyId) {
        require(msg.sender == bounties[_bountyId].creator, "Not creator");
        _;
    }

    modifier bountyIsOpen(uint256 _bountyId) {
        require(bounties[_bountyId].status == BountyStatus.OPEN, "Bounty not open");
        _;
    }

    function setAddresses(address _repAddress, address _disputeAddress) external onlyOwner {
        reputationAddress = _repAddress;
        disputeAddress = _disputeAddress;
    }

    function createBounty(
        string memory _description,
        uint256 _deadline,
        bool _allowMultipleWinners,
        uint256[] memory _winnerShares,
        uint256 _slashPercent
    ) external payable nonReentrant {
        require(msg.value > 0, "Escrow required");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash must be 25-50%");

        if (_allowMultipleWinners) {
            require(_winnerShares.length > 1, "Multi-winner requires multiple shares");
            uint256 totalShares = 0;
            for (uint i = 0; i < _winnerShares.length; i++) {
                totalShares += _winnerShares[i];
            }
            require(totalShares == 10000, "Shares must sum to 10000 basis points");
        } else {
            require(_winnerShares.length == 0, "Single winner bounty cannot have shares");
        }

        bountyCounter++;
        Bounty storage bounty = bounties[bountyCounter];
        bounty.creator = msg.sender;
        bounty.description = _description;
        bounty.amount = msg.value;
        bounty.deadline = _deadline;
        bounty.allowMultipleWinners = _allowMultipleWinners;
        bounty.winnerShares = _winnerShares;
        bounty.status = BountyStatus.OPEN;
        bounty.slashPercent = _slashPercent;

        emit BountyCreated(bountyCounter, msg.sender, msg.value, _deadline);
        IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
    }

    function submitSolution(uint256 _bountyId, string memory _blindedIpfsCid) external payable bountyIsOpen(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp <= bounty.deadline, "Deadline has passed");
        uint256 depositAmount = bounty.amount / 10;
        require(msg.value == depositAmount, "10% deposit required");

        bounty.submissions.push(Submission({
            solver: msg.sender,
            blindedIpfsCid: _blindedIpfsCid,
            revealIpfsCid: "",
            deposit: depositAmount,
            replies: new Reply[](0),
            revealed: false
        }));

        emit SubmissionCreated(_bountyId, bounty.submissions.length - 1, msg.sender, _blindedIpfsCid);
        IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
    }

    function selectWinners(uint256 _bountyId, address[] memory _winners, uint256[] memory _submissionIds) external onlyCreator(_bountyId) bountyIsOpen(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp <= bounty.deadline, "Cannot select winners after deadline");
        require(_winners.length == _submissionIds.length, "Winners and submission IDs length mismatch");
        
        if (bounty.allowMultipleWinners) {
            require(_winners.length == bounty.winnerShares.length, "Number of winners must match defined shares");
        } else {
            require(_winners.length == 1, "Only one winner allowed");
        }

        bounty.status = BountyStatus.PENDING_REVEAL;
        bounty.selectedWinners = _winners;
        bounty.selectedSubmissionIds = _submissionIds;

        // Refund deposits for non-winners
        for (uint i = 0; i < bounty.submissions.length; i++) {
            bool isWinner = false;
            for (uint j = 0; j < _submissionIds.length; j++) {
                if (i == _submissionIds[j]) {
                    isWinner = true;
                    break;
                }
            }
            if (!isWinner) {
                Submission storage sub = bounty.submissions[i];
                if(sub.deposit > 0) {
                    payable(sub.solver).transfer(sub.deposit);
                    sub.deposit = 0;
                }
            }
        }

        emit WinnersSelected(_bountyId, _winners, _submissionIds);
    }

    function revealSolution(uint256 _bountyId, uint256 _subId, string memory _revealIpfsCid) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.PENDING_REVEAL, "Bounty not pending reveal");
        require(_subId < bounty.submissions.length, "Invalid submission ID");
        Submission storage sub = bounty.submissions[_subId];
        require(msg.sender == sub.solver, "Not the solver of this submission");
        require(!sub.revealed, "Solution already revealed");

        bool isWinner = false;
        uint winnerIndex = 0;
        for (uint i = 0; i < bounty.selectedWinners.length; i++) {
            if (bounty.selectedWinners[i] == msg.sender && bounty.selectedSubmissionIds[i] == _subId) {
                isWinner = true;
                winnerIndex = i;
                break;
            }
        }
        require(isWinner, "Not a selected winner");

        sub.revealIpfsCid = _revealIpfsCid;
        sub.revealed = true;

        // Pay the winner and refund their deposit
        uint256 prizeAmount;
        if (bounty.allowMultipleWinners) {
            prizeAmount = (bounty.amount * bounty.winnerShares[winnerIndex]) / 10000;
        } else {
            prizeAmount = bounty.amount;
        }
        payable(msg.sender).transfer(prizeAmount + sub.deposit);
        sub.deposit = 0;

        IQuintyReputation(reputationAddress).recordWin(msg.sender);
        emit SolutionRevealed(_bountyId, _subId, msg.sender, _revealIpfsCid);

        // Check if all winners have revealed to resolve the bounty
        bool allRevealed = true;
        for (uint i = 0; i < bounty.selectedSubmissionIds.length; i++) {
            if (!bounty.submissions[bounty.selectedSubmissionIds[i]].revealed) {
                allRevealed = false;
                break;
            }
        }

        if (allRevealed) {
            bounty.status = BountyStatus.RESOLVED;
            // Creator success is already recorded when bounty is created
            emit BountyResolved(_bountyId);
        }
    }

    function addReply(uint256 _bountyId, uint256 _subId, string memory _content) external bountyIsOpen(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];
        require(_subId < bounty.submissions.length, "Invalid submission ID");
        Submission storage sub = bounty.submissions[_subId];
        require(msg.sender == bounty.creator || msg.sender == sub.solver, "Not authorized to reply");

        sub.replies.push(Reply({ replier: msg.sender, content: _content, timestamp: block.timestamp }));
        emit ReplyAdded(_bountyId, _subId, msg.sender);
    }

    function triggerSlash(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPEN, "Bounty not open");
        require(block.timestamp > bounty.deadline, "Deadline not passed");

        bounty.status = BountyStatus.EXPIRED;
        uint256 slashAmount = (bounty.amount * bounty.slashPercent) / 10000;
        
        // Transfer slash amount to dispute contract for distribution
        (bool success, ) = disputeAddress.call{value: slashAmount}(
            abi.encodeWithSelector(IDisputeResolver.initiateExpiryVote.selector, _bountyId, slashAmount)
        );
        require(success, "Failed to initiate expiry vote");

        // Refund remaining amount to creator
        payable(bounty.creator).transfer(bounty.amount - slashAmount);

        // Creator failure is not tracked in milestone system
        emit BountySlashed(_bountyId, slashAmount);
    }

    // Getter functions
    function getBountyData(uint256 _bountyId) external view returns (
        address creator,
        string memory description,
        uint256 amount,
        uint256 deadline,
        bool allowMultipleWinners,
        uint256[] memory winnerShares,
        BountyStatus status,
        uint256 slashPercent,
        address[] memory selectedWinners,
        uint256[] memory selectedSubmissionIds
    ) {
        Bounty storage bounty = bounties[_bountyId];
        return (
            bounty.creator,
            bounty.description,
            bounty.amount,
            bounty.deadline,
            bounty.allowMultipleWinners,
            bounty.winnerShares,
            bounty.status,
            bounty.slashPercent,
            bounty.selectedWinners,
            bounty.selectedSubmissionIds
        );
    }

    function getSubmission(uint256 _bountyId, uint256 _subId) external view returns (
        uint256 bountyId,
        address solver,
        string memory blindedIpfsCid,
        uint256 deposit,
        string[] memory replies,
        string memory revealIpfsCid,
        uint256 timestamp
    ) {
        Submission storage submission = bounties[_bountyId].submissions[_subId];

        // Convert Reply[] to string[] for replies
        string[] memory replyContents = new string[](submission.replies.length);
        for (uint i = 0; i < submission.replies.length; i++) {
            replyContents[i] = submission.replies[i].content;
        }

        return (
            _bountyId,
            submission.solver,
            submission.blindedIpfsCid,
            submission.deposit,
            replyContents,
            submission.revealIpfsCid,
            block.timestamp // Note: This is current timestamp, not submission timestamp
        );
    }

    function getSubmissionStruct(uint256 _bountyId, uint256 _subId) external view returns (Submission memory) {
        return bounties[_bountyId].submissions[_subId];
    }

    function getSubmissionCount(uint256 _bountyId) external view returns (uint256) {
        return bounties[_bountyId].submissions.length;
    }
}
