// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QuintyNFT
 * @notice Soulbound (non-transferable) NFT badges for Quinty ecosystem
 * @dev All badges are permanently bound to the recipient's address
 */
contract QuintyNFT is ERC721, Ownable {

    enum BadgeType {
        BountyCreator,
        BountySolver,
        TeamMember,
        GrantGiver,
        GrantRecipient,
        CrowdfundingDonor,
        LookingForGrantSupporter
    }

    struct Badge {
        BadgeType badgeType;
        uint256 issuedAt;
        string metadataURI; // IPFS URI for badge metadata
        address issuer; // Contract that issued the badge
    }

    mapping(uint256 => Badge) public badges;
    mapping(address => uint256[]) public userBadges;
    mapping(address => mapping(BadgeType => uint256)) public userBadgeCount;
    mapping(address => bool) public authorizedMinters; // Contracts that can mint

    uint256 public tokenCounter;
    string private _baseTokenURI;

    event BadgeMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        BadgeType badgeType,
        address indexed issuer
    );
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);

    modifier onlyAuthorized() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    constructor(string memory baseTokenURI) ERC721("Quinty Badge", "QBADGE") Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI;
    }

    /**
     * @notice Mint a soulbound badge to a recipient
     * @param recipient Address to receive the badge
     * @param badgeType Type of badge to mint
     * @param metadataURI IPFS URI for badge metadata
     */
    function mintBadge(
        address recipient,
        BadgeType badgeType,
        string memory metadataURI
    ) external onlyAuthorized returns (uint256) {
        require(recipient != address(0), "Invalid recipient");

        tokenCounter++;
        uint256 tokenId = tokenCounter;

        _safeMint(recipient, tokenId);

        badges[tokenId] = Badge({
            badgeType: badgeType,
            issuedAt: block.timestamp,
            metadataURI: metadataURI,
            issuer: msg.sender
        });

        userBadges[recipient].push(tokenId);
        userBadgeCount[recipient][badgeType]++;

        emit BadgeMinted(tokenId, recipient, badgeType, msg.sender);

        return tokenId;
    }

    /**
     * @notice Batch mint badges to multiple recipients
     * @param recipients Array of addresses to receive badges
     * @param badgeType Type of badge to mint for all recipients
     * @param metadataURI IPFS URI for badge metadata (same for all)
     */
    function batchMintBadges(
        address[] memory recipients,
        BadgeType badgeType,
        string memory metadataURI
    ) external onlyAuthorized {
        require(recipients.length > 0, "Empty recipients array");
        require(recipients.length <= 100, "Too many recipients");

        for (uint i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");

            tokenCounter++;
            uint256 tokenId = tokenCounter;

            _safeMint(recipients[i], tokenId);

            badges[tokenId] = Badge({
                badgeType: badgeType,
                issuedAt: block.timestamp,
                metadataURI: metadataURI,
                issuer: msg.sender
            });

            userBadges[recipients[i]].push(tokenId);
            userBadgeCount[recipients[i]][badgeType]++;

            emit BadgeMinted(tokenId, recipients[i], badgeType, msg.sender);
        }
    }

    /**
     * @notice Authorize a contract to mint badges
     * @param minter Address of the contract to authorize
     */
    function authorizeMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    /**
     * @notice Revoke minting authorization from a contract
     * @param minter Address of the contract to revoke
     */
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    /**
     * @notice Set base URI for token metadata
     * @param baseTokenURI New base URI
     */
    function setBaseTokenURI(string memory baseTokenURI) external onlyOwner {
        _baseTokenURI = baseTokenURI;
    }

    /**
     * @notice Get all badges owned by a user
     * @param user Address of the user
     * @return Array of token IDs owned by the user
     */
    function getUserBadges(address user) external view returns (uint256[] memory) {
        return userBadges[user];
    }

    /**
     * @notice Get count of specific badge type for a user
     * @param user Address of the user
     * @param badgeType Type of badge to query
     * @return Count of badges of that type
     */
    function getBadgeCount(address user, BadgeType badgeType) external view returns (uint256) {
        return userBadgeCount[user][badgeType];
    }

    /**
     * @notice Get badge details
     * @param tokenId Token ID of the badge
     */
    function getBadge(uint256 tokenId) external view returns (
        BadgeType badgeType,
        uint256 issuedAt,
        string memory metadataURI,
        address issuer,
        address owner
    ) {
        require(_ownerOf(tokenId) != address(0), "Badge does not exist");
        Badge memory badge = badges[tokenId];
        return (
            badge.badgeType,
            badge.issuedAt,
            badge.metadataURI,
            badge.issuer,
            _ownerOf(tokenId)
        );
    }

    /**
     * @notice Get token URI with badge-specific metadata
     * @param tokenId Token ID
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Badge does not exist");

        Badge memory badge = badges[tokenId];

        // If badge has custom metadata URI, use it
        if (bytes(badge.metadataURI).length > 0) {
            return badge.metadataURI;
        }

        // Otherwise use base URI
        return _baseTokenURI;
    }

    // ========== SOULBOUND: PREVENT TRANSFERS ==========

    /**
     * @dev Override transfer functions to make badges soulbound (non-transferable)
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all other transfers
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: Transfer not allowed");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Disable approvals for soulbound tokens
     */
    function approve(address /*to*/, uint256 /*tokenId*/) public virtual override {
        revert("Soulbound: Approval not allowed");
    }

    /**
     * @dev Disable operator approvals for soulbound tokens
     */
    function setApprovalForAll(address /*operator*/, bool /*approved*/) public virtual override {
        revert("Soulbound: Approval not allowed");
    }
}
