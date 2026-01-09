// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IQuintyNFT.sol";

/**
 * @title GrantProgram
 * @notice Grant programs where organizations distribute funds to selected applicants
 * @dev Supports application submission, selection, fund distribution, and progress updates
 */
contract GrantProgram is Ownable, ReentrancyGuard {

    enum GrantStatus { Open, SelectionPhase, Active, Completed, Cancelled }
    enum ApplicationStatus { Pending, Approved, Rejected }

    struct Update {
        address author;
        string content; // IPFS CID for update content (text/images)
        uint256 timestamp;
    }

    struct Application {
        address applicant;
        string projectDetails; // IPFS CID with project description
        string socialAccounts; // IPFS CID with social proof
        uint256 requestedAmount;
        uint256 appliedAt;
        ApplicationStatus status;
        string rejectionReason; // Optional feedback
    }

    struct Grant {
        address giver; // Organization/person creating the grant
        string title;
        string description;
        uint256 totalFunds; // Total ETH available for grants
        uint256 maxApplicants; // Maximum number of recipients
        uint256 applicationDeadline;
        uint256 distributionDeadline; // Deadline to distribute all funds
        GrantStatus status;
        uint256 fundsDistributed;
        uint256 createdAt;
        Application[] applications;
        address[] selectedRecipients;
        mapping(address => uint256) recipientAmounts; // How much each recipient gets
        mapping(address => bool) hasClaimed; // Track if recipient claimed
        Update[] updates;
    }

    mapping(uint256 => Grant) public grants;
    mapping(uint256 => mapping(address => bool)) public hasApplied; // grantId => applicant => applied
    uint256 public grantCounter;
    address public nftAddress;

    event GrantCreated(uint256 indexed grantId, address indexed giver, string title, uint256 totalFunds, uint256 applicationDeadline);
    event ApplicationSubmitted(uint256 indexed grantId, uint256 applicationId, address indexed applicant, uint256 requestedAmount);
    event ApplicationApproved(uint256 indexed grantId, uint256 applicationId, address indexed applicant, uint256 approvedAmount);
    event ApplicationRejected(uint256 indexed grantId, uint256 applicationId, address indexed applicant, string reason);
    event FundsClaimed(uint256 indexed grantId, address indexed recipient, uint256 amount);
    event UpdatePosted(uint256 indexed grantId, address indexed author, string content);
    event GrantCompleted(uint256 indexed grantId, uint256 totalDistributed);
    event GrantCancelled(uint256 indexed grantId, uint256 refundAmount);

    modifier onlyGiver(uint256 _grantId) {
        require(msg.sender == grants[_grantId].giver, "Not grant giver");
        _;
    }

    modifier grantIsOpen(uint256 _grantId) {
        require(grants[_grantId].status == GrantStatus.Open, "Grant not open for applications");
        require(block.timestamp <= grants[_grantId].applicationDeadline, "Application deadline passed");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setNFTAddress(address _nftAddress) external onlyOwner {
        nftAddress = _nftAddress;
    }

    /**
     * @notice Create a new grant program
     * @param _title Title of the grant program
     * @param _description IPFS CID with full description
     * @param _maxApplicants Maximum number of recipients to select
     * @param _applicationDeadline Deadline for applications
     * @param _distributionDeadline Deadline to distribute funds
     */
    function createGrant(
        string memory _title,
        string memory _description,
        uint256 _maxApplicants,
        uint256 _applicationDeadline,
        uint256 _distributionDeadline
    ) external payable nonReentrant {
        require(msg.value > 0, "Must provide grant funds");
        require(bytes(_title).length > 0, "Title required");
        require(_maxApplicants > 0 && _maxApplicants <= 100, "Invalid max applicants");
        require(_applicationDeadline > block.timestamp, "Invalid application deadline");
        require(_distributionDeadline > _applicationDeadline, "Distribution deadline must be after application deadline");

        grantCounter++;
        Grant storage grant = grants[grantCounter];
        grant.giver = msg.sender;
        grant.title = _title;
        grant.description = _description;
        grant.totalFunds = msg.value;
        grant.maxApplicants = _maxApplicants;
        grant.applicationDeadline = _applicationDeadline;
        grant.distributionDeadline = _distributionDeadline;
        grant.status = GrantStatus.Open;
        grant.createdAt = block.timestamp;

        emit GrantCreated(grantCounter, msg.sender, _title, msg.value, _applicationDeadline);

        // Mint GrantGiver badge
        if (nftAddress != address(0)) {
            IQuintyNFT(nftAddress).mintBadge(msg.sender, 3, "ipfs://grant-giver-badge/"); // BadgeType.GrantGiver = 3
        }
    }

    /**
     * @notice Apply for a grant
     * @param _grantId Grant program ID
     * @param _projectDetails IPFS CID with project details
     * @param _socialAccounts IPFS CID with social proof
     * @param _requestedAmount Amount of ETH requested
     */
    function applyForGrant(
        uint256 _grantId,
        string memory _projectDetails,
        string memory _socialAccounts,
        uint256 _requestedAmount
    ) external grantIsOpen(_grantId) nonReentrant {
        Grant storage grant = grants[_grantId];
        require(!hasApplied[_grantId][msg.sender], "Already applied");
        require(bytes(_projectDetails).length > 0, "Project details required");
        require(_requestedAmount > 0 && _requestedAmount <= grant.totalFunds, "Invalid requested amount");

        hasApplied[_grantId][msg.sender] = true;

        grant.applications.push(Application({
            applicant: msg.sender,
            projectDetails: _projectDetails,
            socialAccounts: _socialAccounts,
            requestedAmount: _requestedAmount,
            appliedAt: block.timestamp,
            status: ApplicationStatus.Pending,
            rejectionReason: ""
        }));

        emit ApplicationSubmitted(_grantId, grant.applications.length - 1, msg.sender, _requestedAmount);
    }

    /**
     * @notice Approve applications and set grant amounts
     * @param _grantId Grant program ID
     * @param _applicationIds Array of application IDs to approve
     * @param _approvedAmounts Array of approved amounts for each application
     */
    function approveApplications(
        uint256 _grantId,
        uint256[] memory _applicationIds,
        uint256[] memory _approvedAmounts
    ) external onlyGiver(_grantId) nonReentrant {
        Grant storage grant = grants[_grantId];
        require(grant.status == GrantStatus.Open || grant.status == GrantStatus.SelectionPhase, "Cannot approve in current status");
        require(_applicationIds.length == _approvedAmounts.length, "Array length mismatch");
        require(grant.selectedRecipients.length + _applicationIds.length <= grant.maxApplicants, "Exceeds max applicants");

        uint256 totalToDistribute = grant.fundsDistributed;

        for (uint i = 0; i < _applicationIds.length; i++) {
            uint256 appId = _applicationIds[i];
            require(appId < grant.applications.length, "Invalid application ID");

            Application storage app = grant.applications[appId];
            require(app.status == ApplicationStatus.Pending, "Application already processed");
            require(_approvedAmounts[i] > 0, "Invalid approved amount");

            totalToDistribute += _approvedAmounts[i];
            require(totalToDistribute <= grant.totalFunds, "Insufficient grant funds");

            app.status = ApplicationStatus.Approved;
            grant.selectedRecipients.push(app.applicant);
            grant.recipientAmounts[app.applicant] = _approvedAmounts[i];

            emit ApplicationApproved(_grantId, appId, app.applicant, _approvedAmounts[i]);
        }

        // Update status to SelectionPhase or Active
        if (grant.status == GrantStatus.Open) {
            grant.status = GrantStatus.SelectionPhase;
        }
    }

    /**
     * @notice Reject applications with optional feedback
     * @param _grantId Grant program ID
     * @param _applicationIds Array of application IDs to reject
     * @param _reasons Array of rejection reasons
     */
    function rejectApplications(
        uint256 _grantId,
        uint256[] memory _applicationIds,
        string[] memory _reasons
    ) external onlyGiver(_grantId) nonReentrant {
        Grant storage grant = grants[_grantId];
        require(grant.status == GrantStatus.Open || grant.status == GrantStatus.SelectionPhase, "Cannot reject in current status");
        require(_applicationIds.length == _reasons.length, "Array length mismatch");

        for (uint i = 0; i < _applicationIds.length; i++) {
            uint256 appId = _applicationIds[i];
            require(appId < grant.applications.length, "Invalid application ID");

            Application storage app = grant.applications[appId];
            require(app.status == ApplicationStatus.Pending, "Application already processed");

            app.status = ApplicationStatus.Rejected;
            app.rejectionReason = _reasons[i];

            emit ApplicationRejected(_grantId, appId, app.applicant, _reasons[i]);
        }
    }

    /**
     * @notice Finalize selection and activate grant distribution
     * @param _grantId Grant program ID
     */
    function finalizeSelection(uint256 _grantId) external onlyGiver(_grantId) nonReentrant {
        Grant storage grant = grants[_grantId];
        require(grant.status == GrantStatus.SelectionPhase, "Not in selection phase");
        require(grant.selectedRecipients.length > 0, "No recipients selected");

        grant.status = GrantStatus.Active;
    }

    /**
     * @notice Recipients claim their approved grant funds
     * @param _grantId Grant program ID
     */
    function claimGrant(uint256 _grantId) external nonReentrant {
        Grant storage grant = grants[_grantId];
        require(grant.status == GrantStatus.Active, "Grant not active");
        require(grant.recipientAmounts[msg.sender] > 0, "Not a selected recipient");
        require(!grant.hasClaimed[msg.sender], "Already claimed");

        uint256 amount = grant.recipientAmounts[msg.sender];
        grant.hasClaimed[msg.sender] = true;
        grant.fundsDistributed += amount;

        // Transfer funds
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsClaimed(_grantId, msg.sender, amount);

        // Mint GrantRecipient badge
        if (nftAddress != address(0)) {
            IQuintyNFT(nftAddress).mintBadge(msg.sender, 4, "ipfs://grant-recipient-badge/"); // BadgeType.GrantRecipient = 4
        }

        // Check if all funds distributed
        bool allClaimed = true;
        for (uint i = 0; i < grant.selectedRecipients.length; i++) {
            if (!grant.hasClaimed[grant.selectedRecipients[i]]) {
                allClaimed = false;
                break;
            }
        }

        if (allClaimed) {
            grant.status = GrantStatus.Completed;
            emit GrantCompleted(_grantId, grant.fundsDistributed);
        }
    }

    /**
     * @notice Post an update to the grant program
     * @param _grantId Grant program ID
     * @param _content IPFS CID with update content (text/images)
     */
    function postUpdate(uint256 _grantId, string memory _content) external nonReentrant {
        Grant storage grant = grants[_grantId];
        require(bytes(_content).length > 0, "Content required");

        // Only giver or selected recipients can post updates
        bool canPost = msg.sender == grant.giver;
        if (!canPost) {
            for (uint i = 0; i < grant.selectedRecipients.length; i++) {
                if (grant.selectedRecipients[i] == msg.sender) {
                    canPost = true;
                    break;
                }
            }
        }
        require(canPost, "Not authorized to post updates");

        grant.updates.push(Update({
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp
        }));

        emit UpdatePosted(_grantId, msg.sender, _content);
    }

    /**
     * @notice Cancel grant and refund remaining funds (only before finalization)
     * @param _grantId Grant program ID
     */
    function cancelGrant(uint256 _grantId) external onlyGiver(_grantId) nonReentrant {
        Grant storage grant = grants[_grantId];
        require(grant.status == GrantStatus.Open || grant.status == GrantStatus.SelectionPhase, "Cannot cancel after activation");

        grant.status = GrantStatus.Cancelled;
        uint256 refundAmount = grant.totalFunds;

        // Refund all funds to giver
        (bool success, ) = payable(grant.giver).call{value: refundAmount}("");
        require(success, "Refund failed");

        emit GrantCancelled(_grantId, refundAmount);
    }

    // ========== VIEW FUNCTIONS ==========

    function getGrantInfo(uint256 _grantId) external view returns (
        address giver,
        string memory title,
        string memory description,
        uint256 totalFunds,
        uint256 maxApplicants,
        uint256 applicationDeadline,
        uint256 distributionDeadline,
        GrantStatus status,
        uint256 fundsDistributed,
        uint256 createdAt
    ) {
        Grant storage grant = grants[_grantId];
        return (
            grant.giver,
            grant.title,
            grant.description,
            grant.totalFunds,
            grant.maxApplicants,
            grant.applicationDeadline,
            grant.distributionDeadline,
            grant.status,
            grant.fundsDistributed,
            grant.createdAt
        );
    }

    function getApplicationCount(uint256 _grantId) external view returns (uint256) {
        return grants[_grantId].applications.length;
    }

    function getApplication(uint256 _grantId, uint256 _appId) external view returns (
        address applicant,
        string memory projectDetails,
        string memory socialAccounts,
        uint256 requestedAmount,
        uint256 appliedAt,
        ApplicationStatus status,
        string memory rejectionReason
    ) {
        require(_appId < grants[_grantId].applications.length, "Invalid application ID");
        Application storage app = grants[_grantId].applications[_appId];
        return (
            app.applicant,
            app.projectDetails,
            app.socialAccounts,
            app.requestedAmount,
            app.appliedAt,
            app.status,
            app.rejectionReason
        );
    }

    function getSelectedRecipients(uint256 _grantId) external view returns (address[] memory) {
        return grants[_grantId].selectedRecipients;
    }

    function getRecipientAmount(uint256 _grantId, address _recipient) external view returns (uint256) {
        return grants[_grantId].recipientAmounts[_recipient];
    }

    function hasClaimedGrant(uint256 _grantId, address _recipient) external view returns (bool) {
        return grants[_grantId].hasClaimed[_recipient];
    }

    function getUpdateCount(uint256 _grantId) external view returns (uint256) {
        return grants[_grantId].updates.length;
    }

    function getUpdate(uint256 _grantId, uint256 _updateId) external view returns (
        address author,
        string memory content,
        uint256 timestamp
    ) {
        require(_updateId < grants[_grantId].updates.length, "Invalid update ID");
        Update storage update = grants[_grantId].updates[_updateId];
        return (update.author, update.content, update.timestamp);
    }

    receive() external payable {}
}
