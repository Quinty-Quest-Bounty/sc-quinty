// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IQuintyNFT.sol";

/**
 * @title Crowdfunding
 * @notice All-or-nothing crowdfunding with milestone-based fund release
 * @dev If funding goal not reached by deadline, all funds are refunded
 */
contract Crowdfunding is Ownable, ReentrancyGuard {

    enum CampaignStatus { Active, Successful, Failed, Completed }
    enum MilestoneStatus { Pending, Released, Withdrawn }

    struct Update {
        address author;
        string content; // IPFS CID for update content (text/images)
        uint256 timestamp;
    }

    struct Contribution {
        address donor;
        uint256 amount;
        uint256 timestamp;
        bool refunded;
    }

    struct Milestone {
        string description;
        uint256 amount; // Amount to release at this milestone
        MilestoneStatus status;
        uint256 releasedAt;
    }

    struct Campaign {
        address creator;
        string title;
        string projectDetails; // IPFS CID with project description
        string socialAccounts; // IPFS CID with social proof
        uint256 fundingGoal;
        uint256 totalRaised;
        uint256 deadline;
        uint256 createdAt;
        CampaignStatus status;
        Contribution[] contributions;
        mapping(address => uint256) donorContributions;
        Milestone[] milestones;
        uint256 totalWithdrawn;
        Update[] updates;
    }

    mapping(uint256 => Campaign) public campaigns;
    uint256 public campaignCounter;
    address public nftAddress;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 fundingGoal,
        uint256 deadline
    );
    event ContributionReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        uint256 totalRaised
    );
    event CampaignSuccessful(uint256 indexed campaignId, uint256 totalRaised);
    event CampaignFailed(uint256 indexed campaignId, uint256 totalRaised);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event MilestoneReleased(uint256 indexed campaignId, uint256 milestoneId, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, uint256 amount, uint256 totalWithdrawn);
    event UpdatePosted(uint256 indexed campaignId, address indexed author, string content);
    event CampaignCompleted(uint256 indexed campaignId);

    constructor() Ownable(msg.sender) {}

    function setNFTAddress(address _nftAddress) external onlyOwner {
        nftAddress = _nftAddress;
    }

    /**
     * @notice Create a crowdfunding campaign with milestones
     * @param _title Campaign title
     * @param _projectDetails IPFS CID with full description
     * @param _socialAccounts IPFS CID with social links
     * @param _fundingGoal Target amount to raise
     * @param _deadline Campaign deadline
     * @param _milestoneDescriptions Array of milestone descriptions
     * @param _milestoneAmounts Array of amounts for each milestone
     */
    function createCampaign(
        string memory _title,
        string memory _projectDetails,
        string memory _socialAccounts,
        uint256 _fundingGoal,
        uint256 _deadline,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external nonReentrant {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_projectDetails).length > 0, "Project details required");
        require(_fundingGoal > 0, "Funding goal must be > 0");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_deadline <= block.timestamp + 365 days, "Deadline too far");
        require(_milestoneDescriptions.length == _milestoneAmounts.length, "Milestone arrays length mismatch");
        require(_milestoneDescriptions.length > 0, "At least one milestone required");

        // Validate milestones sum to funding goal
        uint256 totalMilestoneAmount = 0;
        for (uint i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Invalid milestone amount");
            totalMilestoneAmount += _milestoneAmounts[i];
        }
        require(totalMilestoneAmount == _fundingGoal, "Milestones must sum to funding goal");

        campaignCounter++;
        Campaign storage campaign = campaigns[campaignCounter];
        campaign.creator = msg.sender;
        campaign.title = _title;
        campaign.projectDetails = _projectDetails;
        campaign.socialAccounts = _socialAccounts;
        campaign.fundingGoal = _fundingGoal;
        campaign.deadline = _deadline;
        campaign.createdAt = block.timestamp;
        campaign.status = CampaignStatus.Active;

        // Create milestones
        for (uint i = 0; i < _milestoneDescriptions.length; i++) {
            campaign.milestones.push(Milestone({
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                status: MilestoneStatus.Pending,
                releasedAt: 0
            }));
        }

        emit CampaignCreated(campaignCounter, msg.sender, _title, _fundingGoal, _deadline);
    }

    /**
     * @notice Contribute to a campaign
     * @param _campaignId Campaign ID
     */
    function contribute(uint256 _campaignId) external payable nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status == CampaignStatus.Active, "Campaign not active");
        require(block.timestamp <= campaign.deadline, "Campaign deadline passed");
        require(msg.value > 0, "Must send ETH");

        // Record contribution
        campaign.contributions.push(Contribution({
            donor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            refunded: false
        }));

        campaign.donorContributions[msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        emit ContributionReceived(_campaignId, msg.sender, msg.value, campaign.totalRaised);

        // Mint donor badge on first contribution
        if (nftAddress != address(0) && campaign.donorContributions[msg.sender] == msg.value) {
            IQuintyNFT(nftAddress).mintBadge(msg.sender, 5, "ipfs://crowdfunding-donor-badge/"); // BadgeType.CrowdfundingDonor = 5
        }

        // Auto-mark as successful if goal reached
        if (campaign.totalRaised >= campaign.fundingGoal) {
            campaign.status = CampaignStatus.Successful;
            emit CampaignSuccessful(_campaignId, campaign.totalRaised);
        }
    }

    /**
     * @notice Finalize campaign after deadline
     * @param _campaignId Campaign ID
     */
    function finalizeCampaign(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status == CampaignStatus.Active, "Campaign already finalized");
        require(block.timestamp > campaign.deadline, "Deadline not reached");

        if (campaign.totalRaised >= campaign.fundingGoal) {
            campaign.status = CampaignStatus.Successful;
            emit CampaignSuccessful(_campaignId, campaign.totalRaised);
        } else {
            campaign.status = CampaignStatus.Failed;
            emit CampaignFailed(_campaignId, campaign.totalRaised);
        }
    }

    /**
     * @notice Donors claim refund for failed campaign
     * @param _campaignId Campaign ID
     */
    function claimRefund(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.status == CampaignStatus.Failed, "Campaign not failed");
        require(campaign.donorContributions[msg.sender] > 0, "No contributions to refund");

        uint256 refundAmount = campaign.donorContributions[msg.sender];
        campaign.donorContributions[msg.sender] = 0;

        // Mark all user's contributions as refunded
        for (uint i = 0; i < campaign.contributions.length; i++) {
            if (campaign.contributions[i].donor == msg.sender && !campaign.contributions[i].refunded) {
                campaign.contributions[i].refunded = true;
            }
        }

        // Transfer refund
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");

        emit RefundClaimed(_campaignId, msg.sender, refundAmount);
    }

    /**
     * @notice Creator releases a milestone (only if goal reached)
     * @param _campaignId Campaign ID
     * @param _milestoneId Milestone ID
     */
    function releaseMilestone(uint256 _campaignId, uint256 _milestoneId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Not creator");
        require(campaign.status == CampaignStatus.Successful, "Campaign not successful");
        require(_milestoneId < campaign.milestones.length, "Invalid milestone ID");

        Milestone storage milestone = campaign.milestones[_milestoneId];
        require(milestone.status == MilestoneStatus.Pending, "Milestone already processed");

        // Check if previous milestones are released (enforce order)
        if (_milestoneId > 0) {
            require(
                campaign.milestones[_milestoneId - 1].status != MilestoneStatus.Pending,
                "Previous milestone not released"
            );
        }

        milestone.status = MilestoneStatus.Released;
        milestone.releasedAt = block.timestamp;

        emit MilestoneReleased(_campaignId, _milestoneId, milestone.amount);
    }

    /**
     * @notice Creator withdraws released milestone funds
     * @param _campaignId Campaign ID
     * @param _milestoneId Milestone ID
     */
    function withdrawMilestone(uint256 _campaignId, uint256 _milestoneId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Not creator");
        require(_milestoneId < campaign.milestones.length, "Invalid milestone ID");

        Milestone storage milestone = campaign.milestones[_milestoneId];
        require(milestone.status == MilestoneStatus.Released, "Milestone not released");

        milestone.status = MilestoneStatus.Withdrawn;
        campaign.totalWithdrawn += milestone.amount;

        // Transfer milestone funds
        (bool success, ) = payable(msg.sender).call{value: milestone.amount}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(_campaignId, milestone.amount, campaign.totalWithdrawn);

        // Check if all milestones withdrawn
        bool allWithdrawn = true;
        for (uint i = 0; i < campaign.milestones.length; i++) {
            if (campaign.milestones[i].status != MilestoneStatus.Withdrawn) {
                allWithdrawn = false;
                break;
            }
        }

        if (allWithdrawn) {
            campaign.status = CampaignStatus.Completed;
            emit CampaignCompleted(_campaignId);
        }
    }

    /**
     * @notice Post an update about campaign progress
     * @param _campaignId Campaign ID
     * @param _content IPFS CID with update content
     */
    function postUpdate(uint256 _campaignId, string memory _content) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Not creator");
        require(bytes(_content).length > 0, "Content required");

        campaign.updates.push(Update({
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp
        }));

        emit UpdatePosted(_campaignId, msg.sender, _content);
    }

    // ========== VIEW FUNCTIONS ==========

    function getCampaignInfo(uint256 _campaignId) external view returns (
        address creator,
        string memory title,
        string memory projectDetails,
        string memory socialAccounts,
        uint256 fundingGoal,
        uint256 totalRaised,
        uint256 deadline,
        uint256 createdAt,
        CampaignStatus status,
        uint256 totalWithdrawn
    ) {
        Campaign storage campaign = campaigns[_campaignId];
        return (
            campaign.creator,
            campaign.title,
            campaign.projectDetails,
            campaign.socialAccounts,
            campaign.fundingGoal,
            campaign.totalRaised,
            campaign.deadline,
            campaign.createdAt,
            campaign.status,
            campaign.totalWithdrawn
        );
    }

    function getContributionCount(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].contributions.length;
    }

    function getContribution(uint256 _campaignId, uint256 _index) external view returns (
        address donor,
        uint256 amount,
        uint256 timestamp,
        bool refunded
    ) {
        require(_index < campaigns[_campaignId].contributions.length, "Invalid index");
        Contribution storage contribution = campaigns[_campaignId].contributions[_index];
        return (contribution.donor, contribution.amount, contribution.timestamp, contribution.refunded);
    }

    function getDonorContribution(uint256 _campaignId, address _donor) external view returns (uint256) {
        return campaigns[_campaignId].donorContributions[_donor];
    }

    function getMilestoneCount(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].milestones.length;
    }

    function getMilestone(uint256 _campaignId, uint256 _milestoneId) external view returns (
        string memory description,
        uint256 amount,
        MilestoneStatus status,
        uint256 releasedAt
    ) {
        require(_milestoneId < campaigns[_campaignId].milestones.length, "Invalid milestone ID");
        Milestone storage milestone = campaigns[_campaignId].milestones[_milestoneId];
        return (milestone.description, milestone.amount, milestone.status, milestone.releasedAt);
    }

    function getUpdateCount(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].updates.length;
    }

    function getUpdate(uint256 _campaignId, uint256 _updateId) external view returns (
        address author,
        string memory content,
        uint256 timestamp
    ) {
        require(_updateId < campaigns[_campaignId].updates.length, "Invalid update ID");
        Update storage update = campaigns[_campaignId].updates[_updateId];
        return (update.author, update.content, update.timestamp);
    }

    function getVaultBalance(uint256 _campaignId) external view returns (uint256) {
        Campaign storage campaign = campaigns[_campaignId];
        return campaign.totalRaised - campaign.totalWithdrawn;
    }

    receive() external payable {}
}
