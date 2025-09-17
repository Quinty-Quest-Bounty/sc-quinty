// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IQuintyReputation {
    function updateCreatorRep(address _user, bool _success) external;
    function updateSolverRep(address _user, bool _success) external;
}

interface IDisputeResolver {
    function initiateExpiryVote(uint256 _bountyId, uint256 _slashAmount) external;
    function initiatePengadilanDispute(uint256 _bountyId) external;
}

contract Quinty is Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct Bounty {
        address creator;
        string description;
        uint256 amount; // STT escrowed
        uint256 deadline;
        bool allowMultipleWinners;
        uint256[] winnerShares; // Basis points, sum 10000
        bool resolved;
        uint256 slashPercent; // 2500-5000 bp
        address[] winners;
        bool slashed;
    }

    struct Submission {
        uint256 bountyId;
        address solver;
        string blindedIpfsCid; // IPFS CID (e.g., Qm...)
        uint256 deposit; // 10% STT
        string[] replies;
        string revealIpfsCid; // Revealed solution
        uint256 timestamp;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission[]) public submissions;
    uint256 public bountyCounter;
    address public reputationAddress;
    address public disputeAddress;

    event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount, uint256 deadline);
    event BountyResolved(uint256 indexed id, address[] winners, uint256[] amounts);
    event BountySlashed(uint256 indexed id, uint256 slashAmount);
    event WinnerSelected(uint256 indexed id, address[] winners);
    event SubmissionCreated(uint256 indexed bountyId, uint256 subId, address solver, string ipfsCid);
    event ReplyAdded(uint256 indexed bountyId, uint256 subId, address replier, string reply);
    event SolutionRevealed(uint256 indexed bountyId, uint256 subId, string revealIpfsCid);

    modifier onlyCreator(uint256 _id) {
        require(msg.sender == bounties[_id].creator, "Not creator");
        _;
    }

    modifier notResolved(uint256 _id) {
        require(!bounties[_id].resolved, "Resolved");
        _;
    }

    modifier afterDeadline(uint256 _id) {
        require(block.timestamp > bounties[_id].deadline, "Not expired");
        _;
    }

    constructor() Ownable(msg.sender) {}

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
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash 25-50%");

        if (_allowMultipleWinners) {
            require(_winnerShares.length > 1, "Shares required");
            uint256 total = 0;
            for (uint i = 0; i < _winnerShares.length; i++) {
                total += _winnerShares[i];
            }
            require(total == 10000, "Shares sum to 10000");
        } else {
            require(_winnerShares.length == 0, "No shares for single winner");
        }

        bountyCounter++;
        bounties[bountyCounter] = Bounty({
            creator: msg.sender,
            description: _description,
            amount: msg.value,
            deadline: _deadline,
            allowMultipleWinners: _allowMultipleWinners,
            winnerShares: _winnerShares,
            resolved: false,
            slashPercent: _slashPercent,
            winners: new address[](0),
            slashed: false
        });

        emit BountyCreated(bountyCounter, msg.sender, msg.value, _deadline);

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).updateCreatorRep(msg.sender, false);
        }
    }

    function submitSolution(uint256 _bountyId, string memory _blindedIpfsCid)
        external
        payable
        notResolved(_bountyId)
        nonReentrant
    {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp <= bounty.deadline, "Expired");
        require(msg.value == bounty.amount / 10, "10% deposit required");
        require(bytes(_blindedIpfsCid).length > 0, "Invalid CID");

        uint256 subId = submissions[_bountyId].length;
        submissions[_bountyId].push(Submission({
            bountyId: _bountyId,
            solver: msg.sender,
            blindedIpfsCid: _blindedIpfsCid,
            deposit: msg.value,
            replies: new string[](0),
            revealIpfsCid: "",
            timestamp: block.timestamp
        }));

        emit SubmissionCreated(_bountyId, subId, msg.sender, _blindedIpfsCid);

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).updateSolverRep(msg.sender, false);
        }
    }

    function addReply(uint256 _bountyId, uint256 _subId, string memory _reply)
        external
        notResolved(_bountyId)
    {
        require(_subId < submissions[_bountyId].length, "Invalid submission");
        Submission storage sub = submissions[_bountyId][_subId];
        require(
            msg.sender == bounties[_bountyId].creator || msg.sender == sub.solver,
            "Unauthorized"
        );
        require(bytes(_reply).length <= 500, "Reply too long");

        sub.replies.push(_reply);
        emit ReplyAdded(_bountyId, _subId, msg.sender, _reply);
    }

    function selectWinners(uint256 _id, address[] memory _winners, uint256[] memory _submissionIds)
        external
        onlyCreator(_id)
        notResolved(_id)
        nonReentrant
    {
        Bounty storage bounty = bounties[_id];
        require(block.timestamp <= bounty.deadline, "Expired");
        require(
            _winners.length == (bounty.allowMultipleWinners ? bounty.winnerShares.length : 1),
            "Invalid winners count"
        );

        uint256[] memory amounts = new uint256[](_winners.length);

        for (uint i = 0; i < _winners.length; i++) {
            amounts[i] = bounty.allowMultipleWinners ?
                (bounty.amount * bounty.winnerShares[i]) / 10000 :
                bounty.amount;

            (bool success, ) = payable(_winners[i]).call{value: amounts[i]}("");
            require(success, "Transfer failed");

            if (reputationAddress != address(0)) {
                IQuintyReputation(reputationAddress).updateSolverRep(_winners[i], true);
            }
        }

        // Refund deposits for all submissions
        for (uint i = 0; i < submissions[_id].length; i++) {
            if (submissions[_id][i].deposit > 0) {
                (bool success, ) = payable(submissions[_id][i].solver).call{value: submissions[_id][i].deposit}("");
                require(success, "Deposit refund failed");
                submissions[_id][i].deposit = 0;
            }
        }

        bounty.resolved = true;
        bounty.winners = _winners;

        emit BountyResolved(_id, _winners, amounts);
        emit WinnerSelected(_id, _winners);

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).updateCreatorRep(bounty.creator, true);
        }
    }

    function triggerSlash(uint256 _id)
        external
        afterDeadline(_id)
        notResolved(_id)
        nonReentrant
    {
        Bounty storage bounty = bounties[_id];
        require(!bounty.slashed, "Already slashed");

        uint256 slashAmount = (bounty.amount * bounty.slashPercent) / 10000;
        uint256 refundAmount = bounty.amount - slashAmount;

        bounty.slashed = true;
        bounty.resolved = true;

        // Transfer slash amount to dispute resolver
        if (disputeAddress != address(0) && slashAmount > 0) {
            (bool success, ) = payable(disputeAddress).call{value: slashAmount}("");
            require(success, "Slash transfer failed");
            IDisputeResolver(disputeAddress).initiateExpiryVote(_id, slashAmount);
        }

        // Refund remaining amount to creator
        if (refundAmount > 0) {
            (bool success, ) = payable(bounty.creator).call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        // Refund all submission deposits
        for (uint i = 0; i < submissions[_id].length; i++) {
            if (submissions[_id][i].deposit > 0) {
                (bool success, ) = payable(submissions[_id][i].solver).call{value: submissions[_id][i].deposit}("");
                require(success, "Deposit refund failed");
                submissions[_id][i].deposit = 0;
            }
        }

        emit BountySlashed(_id, slashAmount);

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).updateCreatorRep(bounty.creator, false);
        }
    }

    function revealSolution(uint256 _bountyId, uint256 _subId, string memory _revealIpfsCid) external {
        require(_subId < submissions[_bountyId].length, "Invalid submission");
        Submission storage sub = submissions[_bountyId][_subId];
        require(msg.sender == sub.solver, "Not solver");
        require(bounties[_bountyId].resolved, "Not resolved");
        require(bytes(sub.revealIpfsCid).length == 0, "Already revealed");
        require(bytes(_revealIpfsCid).length > 0, "Invalid CID");

        sub.revealIpfsCid = _revealIpfsCid;
        emit SolutionRevealed(_bountyId, _subId, _revealIpfsCid);
    }

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
    ) {
        Bounty storage bounty = bounties[_id];
        return (
            bounty.creator,
            bounty.description,
            bounty.amount,
            bounty.deadline,
            bounty.allowMultipleWinners,
            bounty.winnerShares,
            bounty.resolved,
            bounty.slashPercent,
            bounty.winners,
            bounty.slashed
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
        require(_subId < submissions[_bountyId].length, "Invalid submission");
        Submission storage sub = submissions[_bountyId][_subId];
        return (
            sub.bountyId,
            sub.solver,
            sub.blindedIpfsCid,
            sub.deposit,
            sub.replies,
            sub.revealIpfsCid,
            sub.timestamp
        );
    }

    function getSubmissionCount(uint256 _bountyId) external view returns (uint256) {
        return submissions[_bountyId].length;
    }

    receive() external payable {}
}