// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQuintyNFT {
    function mintBadge(address recipient, uint8 badgeType, string memory metadataURI) external returns (uint256);
}

/**
 * @title LookingForGrant
 * @notice Platform for projects seeking funding from VCs/investors
 * @dev Projects post their details and investors can provide support
 */
contract LookingForGrant is Ownable, ReentrancyGuard {

    enum RequestStatus { Active, Funded, Cancelled }

    struct Update {
        address author;
        string content; // IPFS CID for update content (text/images)
        uint256 timestamp;
    }

    struct Supporter {
        address addr;
        uint256 amount;
        uint256 timestamp;
    }

    struct FundingRequest {
        address requester;
        string title;
        string projectDetails; // IPFS CID with full project description
        string progress; // IPFS CID with current progress
        string socialAccounts; // IPFS CID with social media links
        string offering; // What they're offering (tokens, equity, etc.) - IPFS CID
        uint256 fundingGoal; // Target amount to raise
        uint256 totalRaised;
        uint256 createdAt;
        uint256 deadline; // Optional deadline
        RequestStatus status;
        Supporter[] supporters;
        mapping(address => uint256) supporterContributions;
        Update[] updates;
    }

    mapping(uint256 => FundingRequest) public fundingRequests;
    uint256 public requestCounter;
    address public nftAddress;

    event FundingRequestCreated(
        uint256 indexed requestId,
        address indexed requester,
        string title,
        uint256 fundingGoal,
        uint256 deadline
    );
    event SupportReceived(
        uint256 indexed requestId,
        address indexed supporter,
        uint256 amount,
        uint256 totalRaised
    );
    event FundsWithdrawn(
        uint256 indexed requestId,
        address indexed requester,
        uint256 amount
    );
    event UpdatePosted(
        uint256 indexed requestId,
        address indexed author,
        string content
    );
    event RequestCancelled(uint256 indexed requestId);
    event RequestFunded(uint256 indexed requestId, uint256 totalRaised);

    constructor() Ownable(msg.sender) {}

    function setNFTAddress(address _nftAddress) external onlyOwner {
        nftAddress = _nftAddress;
    }

    /**
     * @notice Create a funding request
     * @param _title Project title
     * @param _projectDetails IPFS CID with project description
     * @param _progress IPFS CID with current progress/achievements
     * @param _socialAccounts IPFS CID with social media links
     * @param _offering IPFS CID describing what's offered (tokens, equity, etc.)
     * @param _fundingGoal Target funding amount
     * @param _deadline Optional deadline (0 for no deadline)
     */
    function createFundingRequest(
        string memory _title,
        string memory _projectDetails,
        string memory _progress,
        string memory _socialAccounts,
        string memory _offering,
        uint256 _fundingGoal,
        uint256 _deadline
    ) external nonReentrant {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_projectDetails).length > 0, "Project details required");
        require(_fundingGoal > 0, "Funding goal must be > 0");
        if (_deadline > 0) {
            require(_deadline > block.timestamp, "Invalid deadline");
        }

        requestCounter++;
        FundingRequest storage request = fundingRequests[requestCounter];
        request.requester = msg.sender;
        request.title = _title;
        request.projectDetails = _projectDetails;
        request.progress = _progress;
        request.socialAccounts = _socialAccounts;
        request.offering = _offering;
        request.fundingGoal = _fundingGoal;
        request.createdAt = block.timestamp;
        request.deadline = _deadline;
        request.status = RequestStatus.Active;

        emit FundingRequestCreated(requestCounter, msg.sender, _title, _fundingGoal, _deadline);
    }

    /**
     * @notice Support a funding request with ETH
     * @param _requestId Funding request ID
     */
    function supportRequest(uint256 _requestId) external payable nonReentrant {
        FundingRequest storage request = fundingRequests[_requestId];
        require(request.status == RequestStatus.Active, "Request not active");
        require(msg.value > 0, "Must send ETH");

        if (request.deadline > 0) {
            require(block.timestamp <= request.deadline, "Deadline passed");
        }

        // Track supporter
        if (request.supporterContributions[msg.sender] == 0) {
            request.supporters.push(Supporter({
                addr: msg.sender,
                amount: msg.value,
                timestamp: block.timestamp
            }));
        } else {
            // Update existing supporter amount
            for (uint i = 0; i < request.supporters.length; i++) {
                if (request.supporters[i].addr == msg.sender) {
                    request.supporters[i].amount += msg.value;
                    break;
                }
            }
        }

        request.supporterContributions[msg.sender] += msg.value;
        request.totalRaised += msg.value;

        emit SupportReceived(_requestId, msg.sender, msg.value, request.totalRaised);

        // Mint supporter badge on first contribution
        if (nftAddress != address(0) && request.supporterContributions[msg.sender] == msg.value) {
            IQuintyNFT(nftAddress).mintBadge(msg.sender, 6, "ipfs://looking-for-grant-supporter-badge/"); // BadgeType.LookingForGrantSupporter = 6
        }

        // Auto-mark as funded if goal reached
        if (request.totalRaised >= request.fundingGoal) {
            request.status = RequestStatus.Funded;
            emit RequestFunded(_requestId, request.totalRaised);
        }
    }

    /**
     * @notice Requester withdraws raised funds
     * @param _requestId Funding request ID
     * @param _amount Amount to withdraw
     */
    function withdrawFunds(uint256 _requestId, uint256 _amount) external nonReentrant {
        FundingRequest storage request = fundingRequests[_requestId];
        require(msg.sender == request.requester, "Not requester");
        require(request.totalRaised > 0, "No funds to withdraw");
        require(_amount > 0 && _amount <= request.totalRaised, "Invalid amount");

        request.totalRaised -= _amount;

        // Transfer funds
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(_requestId, msg.sender, _amount);
    }

    /**
     * @notice Post an update about the project
     * @param _requestId Funding request ID
     * @param _content IPFS CID with update content
     */
    function postUpdate(uint256 _requestId, string memory _content) external nonReentrant {
        FundingRequest storage request = fundingRequests[_requestId];
        require(msg.sender == request.requester, "Not requester");
        require(bytes(_content).length > 0, "Content required");

        request.updates.push(Update({
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp
        }));

        emit UpdatePosted(_requestId, msg.sender, _content);
    }

    /**
     * @notice Update project details
     * @param _requestId Funding request ID
     * @param _projectDetails New project details IPFS CID
     * @param _progress New progress IPFS CID
     */
    function updateProjectInfo(
        uint256 _requestId,
        string memory _projectDetails,
        string memory _progress
    ) external nonReentrant {
        FundingRequest storage request = fundingRequests[_requestId];
        require(msg.sender == request.requester, "Not requester");

        if (bytes(_projectDetails).length > 0) {
            request.projectDetails = _projectDetails;
        }
        if (bytes(_progress).length > 0) {
            request.progress = _progress;
        }
    }

    /**
     * @notice Cancel funding request (only if no funds raised)
     * @param _requestId Funding request ID
     */
    function cancelRequest(uint256 _requestId) external nonReentrant {
        FundingRequest storage request = fundingRequests[_requestId];
        require(msg.sender == request.requester, "Not requester");
        require(request.totalRaised == 0, "Cannot cancel with raised funds");
        require(request.status == RequestStatus.Active, "Not active");

        request.status = RequestStatus.Cancelled;
        emit RequestCancelled(_requestId);
    }

    // ========== VIEW FUNCTIONS ==========

    function getRequestInfo(uint256 _requestId) external view returns (
        address requester,
        string memory title,
        string memory projectDetails,
        string memory progress,
        string memory socialAccounts,
        string memory offering,
        uint256 fundingGoal,
        uint256 totalRaised,
        uint256 createdAt,
        uint256 deadline,
        RequestStatus status
    ) {
        FundingRequest storage request = fundingRequests[_requestId];
        return (
            request.requester,
            request.title,
            request.projectDetails,
            request.progress,
            request.socialAccounts,
            request.offering,
            request.fundingGoal,
            request.totalRaised,
            request.createdAt,
            request.deadline,
            request.status
        );
    }

    function getSupporterCount(uint256 _requestId) external view returns (uint256) {
        return fundingRequests[_requestId].supporters.length;
    }

    function getSupporter(uint256 _requestId, uint256 _index) external view returns (
        address addr,
        uint256 amount,
        uint256 timestamp
    ) {
        require(_index < fundingRequests[_requestId].supporters.length, "Invalid index");
        Supporter storage supporter = fundingRequests[_requestId].supporters[_index];
        return (supporter.addr, supporter.amount, supporter.timestamp);
    }

    function getSupporterContribution(uint256 _requestId, address _supporter) external view returns (uint256) {
        return fundingRequests[_requestId].supporterContributions[_supporter];
    }

    function getUpdateCount(uint256 _requestId) external view returns (uint256) {
        return fundingRequests[_requestId].updates.length;
    }

    function getUpdate(uint256 _requestId, uint256 _updateId) external view returns (
        address author,
        string memory content,
        uint256 timestamp
    ) {
        require(_updateId < fundingRequests[_requestId].updates.length, "Invalid update ID");
        Update storage update = fundingRequests[_requestId].updates[_updateId];
        return (update.author, update.content, update.timestamp);
    }

    function getAvailableFunds(uint256 _requestId) external view returns (uint256) {
        return fundingRequests[_requestId].totalRaised;
    }

    receive() external payable {}
}
