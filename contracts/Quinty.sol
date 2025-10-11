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

interface IQuintyNFT {
    function mintBadge(address recipient, uint8 badgeType, string memory metadataURI) external returns (uint256);
    function batchMintBadges(address[] memory recipients, uint8 badgeType, string memory metadataURI) external;
}

contract Quinty is Ownable, ReentrancyGuard {

    enum BountyStatus { OPREC, OPEN, PENDING_REVEAL, RESOLVED, DISPUTED, EXPIRED }

    struct Team {
        address leader;
        address[] members;
        uint256 createdAt;
    }

    struct OprecApplication {
        address applicant;
        address[] teamMembers; // Empty if solo, filled if team
        string workExamples; // IPFS CID with portfolio/examples
        string skillDescription;
        uint256 appliedAt;
        bool approved;
        bool rejected;
    }

    struct Reply {
        address replier;
        string content;
        uint256 timestamp;
    }

    struct Submission {
        address solver;
        address[] teamMembers; // Empty if solo, filled if team submission
        string blindedIpfsCid;
        string revealIpfsCid;
        uint256 deposit;
        Reply[] replies;
        bool revealed;
        bool isTeam;
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
        bool hasOprec; // Whether this bounty has oprec phase
        uint256 oprecDeadline; // Deadline for oprec applications
        OprecApplication[] oprecApplications;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(address => bool)) public approvedParticipants; // bountyId => participant => approved
    uint256 public bountyCounter;

    address public reputationAddress;
    address public disputeAddress;
    address public nftAddress;

    constructor() Ownable(msg.sender) {}

    event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount, uint256 deadline, bool hasOprec);
    event OprecApplicationSubmitted(uint256 indexed bountyId, uint256 applicationId, address indexed applicant, bool isTeam);
    event OprecApplicationApproved(uint256 indexed bountyId, uint256 applicationId, address indexed applicant);
    event OprecApplicationRejected(uint256 indexed bountyId, uint256 applicationId, address indexed applicant);
    event OprecPhaseEnded(uint256 indexed bountyId);
    event SubmissionCreated(uint256 indexed bountyId, uint256 subId, address solver, string ipfsCid, bool isTeam);
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

    modifier oprecIsActive(uint256 _bountyId) {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPREC, "Oprec not active");
        require(block.timestamp <= bounty.oprecDeadline, "Oprec deadline passed");
        _;
    }

    function setAddresses(address _repAddress, address _disputeAddress, address _nftAddress) external onlyOwner {
        reputationAddress = _repAddress;
        disputeAddress = _disputeAddress;
        nftAddress = _nftAddress;
    }

    function createBounty(
        string memory _description,
        uint256 _deadline,
        bool _allowMultipleWinners,
        uint256[] memory _winnerShares,
        uint256 _slashPercent,
        bool _hasOprec,
        uint256 _oprecDeadline
    ) external payable nonReentrant {
        require(msg.value > 0, "Escrow required");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash must be 25-50%");

        if (_hasOprec) {
            require(_oprecDeadline > block.timestamp && _oprecDeadline < _deadline, "Invalid oprec deadline");
        }

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
        bounty.status = _hasOprec ? BountyStatus.OPREC : BountyStatus.OPEN;
        bounty.slashPercent = _slashPercent;
        bounty.hasOprec = _hasOprec;
        bounty.oprecDeadline = _oprecDeadline;

        emit BountyCreated(bountyCounter, msg.sender, msg.value, _deadline, _hasOprec);
        IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
    }

    // ========== OPREC FUNCTIONS ==========

    function applyToOprec(
        uint256 _bountyId,
        address[] memory _teamMembers,
        string memory _workExamples,
        string memory _skillDescription
    ) external oprecIsActive(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bytes(_workExamples).length > 0, "Work examples required");
        require(bytes(_skillDescription).length > 0, "Skill description required");
        require(_teamMembers.length <= 10, "Max 10 team members");

        // Validate team members
        for (uint i = 0; i < _teamMembers.length; i++) {
            require(_teamMembers[i] != address(0), "Invalid team member");
            require(_teamMembers[i] != msg.sender, "Cannot include self in team members");
        }

        bounty.oprecApplications.push(OprecApplication({
            applicant: msg.sender,
            teamMembers: _teamMembers,
            workExamples: _workExamples,
            skillDescription: _skillDescription,
            appliedAt: block.timestamp,
            approved: false,
            rejected: false
        }));

        emit OprecApplicationSubmitted(
            _bountyId,
            bounty.oprecApplications.length - 1,
            msg.sender,
            _teamMembers.length > 0
        );
    }

    function approveOprecApplications(
        uint256 _bountyId,
        uint256[] memory _applicationIds
    ) external onlyCreator(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPREC, "Oprec not active");

        for (uint i = 0; i < _applicationIds.length; i++) {
            uint256 appId = _applicationIds[i];
            require(appId < bounty.oprecApplications.length, "Invalid application ID");

            OprecApplication storage app = bounty.oprecApplications[appId];
            require(!app.approved && !app.rejected, "Application already processed");

            app.approved = true;
            approvedParticipants[_bountyId][app.applicant] = true;

            emit OprecApplicationApproved(_bountyId, appId, app.applicant);
        }
    }

    function rejectOprecApplications(
        uint256 _bountyId,
        uint256[] memory _applicationIds
    ) external onlyCreator(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPREC, "Oprec not active");

        for (uint i = 0; i < _applicationIds.length; i++) {
            uint256 appId = _applicationIds[i];
            require(appId < bounty.oprecApplications.length, "Invalid application ID");

            OprecApplication storage app = bounty.oprecApplications[appId];
            require(!app.approved && !app.rejected, "Application already processed");

            app.rejected = true;

            emit OprecApplicationRejected(_bountyId, appId, app.applicant);
        }
    }

    function endOprecPhase(uint256 _bountyId) external onlyCreator(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPREC, "Oprec not active");
        require(block.timestamp >= bounty.oprecDeadline, "Oprec deadline not reached");

        bounty.status = BountyStatus.OPEN;
        emit OprecPhaseEnded(_bountyId);
    }

    // ========== SUBMISSION FUNCTIONS ==========

    function submitSolution(
        uint256 _bountyId,
        string memory _blindedIpfsCid,
        address[] memory _teamMembers
    ) external payable bountyIsOpen(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp <= bounty.deadline, "Deadline has passed");

        // If oprec was active, check if participant is approved
        if (bounty.hasOprec) {
            require(approvedParticipants[_bountyId][msg.sender], "Not approved participant");
        }

        uint256 depositAmount = bounty.amount / 10;
        require(msg.value == depositAmount, "10% deposit required");
        require(_teamMembers.length <= 10, "Max 10 team members");

        // Validate team members
        for (uint i = 0; i < _teamMembers.length; i++) {
            require(_teamMembers[i] != address(0), "Invalid team member");
            require(_teamMembers[i] != msg.sender, "Cannot include self in team members");
        }

        bool isTeam = _teamMembers.length > 0;

        bounty.submissions.push(Submission({
            solver: msg.sender,
            teamMembers: _teamMembers,
            blindedIpfsCid: _blindedIpfsCid,
            revealIpfsCid: "",
            deposit: depositAmount,
            replies: new Reply[](0),
            revealed: false,
            isTeam: isTeam
        }));

        emit SubmissionCreated(_bountyId, bounty.submissions.length - 1, msg.sender, _blindedIpfsCid, isTeam);
        IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
    }

    function selectWinners(uint256 _bountyId, address[] memory _winners, uint256[] memory _submissionIds) external onlyCreator(_bountyId) bountyIsOpen(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        // Creator can select winners anytime, even after deadline
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

        // Calculate total prize amount
        uint256 prizeAmount;
        if (bounty.allowMultipleWinners) {
            prizeAmount = (bounty.amount * bounty.winnerShares[winnerIndex]) / 10000;
        } else {
            prizeAmount = bounty.amount;
        }

        // Handle team vs solo reward distribution
        if (sub.isTeam && sub.teamMembers.length > 0) {
            // Team submission: split reward equally among leader + all team members
            uint256 totalMembers = sub.teamMembers.length + 1; // +1 for leader
            uint256 rewardPerMember = prizeAmount / totalMembers;
            uint256 depositRefundPerMember = sub.deposit / totalMembers;

            // Pay leader
            payable(msg.sender).transfer(rewardPerMember + depositRefundPerMember);

            // Pay team members
            for (uint i = 0; i < sub.teamMembers.length; i++) {
                payable(sub.teamMembers[i]).transfer(rewardPerMember + depositRefundPerMember);
            }

            // Mint team member NFT badges for all participants
            if (nftAddress != address(0)) {
                address[] memory allMembers = new address[](totalMembers);
                allMembers[0] = msg.sender;
                for (uint i = 0; i < sub.teamMembers.length; i++) {
                    allMembers[i + 1] = sub.teamMembers[i];
                }
                IQuintyNFT(nftAddress).batchMintBadges(allMembers, 2, "ipfs://team-member-badge/"); // BadgeType.TeamMember = 2
            }

            // Record win for all team members
            IQuintyReputation(reputationAddress).recordWin(msg.sender);
            for (uint i = 0; i < sub.teamMembers.length; i++) {
                IQuintyReputation(reputationAddress).recordWin(sub.teamMembers[i]);
            }
        } else {
            // Solo submission: pay entire prize to solver
            payable(msg.sender).transfer(prizeAmount + sub.deposit);
            IQuintyReputation(reputationAddress).recordWin(msg.sender);
        }

        sub.deposit = 0;
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
        uint256[] memory selectedSubmissionIds,
        bool hasOprec,
        uint256 oprecDeadline
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
            bounty.selectedSubmissionIds,
            bounty.hasOprec,
            bounty.oprecDeadline
        );
    }

    function getOprecApplicationCount(uint256 _bountyId) external view returns (uint256) {
        return bounties[_bountyId].oprecApplications.length;
    }

    function getOprecApplication(uint256 _bountyId, uint256 _appId) external view returns (
        address applicant,
        address[] memory teamMembers,
        string memory workExamples,
        string memory skillDescription,
        uint256 appliedAt,
        bool approved,
        bool rejected
    ) {
        require(_appId < bounties[_bountyId].oprecApplications.length, "Invalid application ID");
        OprecApplication storage app = bounties[_bountyId].oprecApplications[_appId];
        return (
            app.applicant,
            app.teamMembers,
            app.workExamples,
            app.skillDescription,
            app.appliedAt,
            app.approved,
            app.rejected
        );
    }

    function isApprovedParticipant(uint256 _bountyId, address _participant) external view returns (bool) {
        return approvedParticipants[_bountyId][_participant];
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
