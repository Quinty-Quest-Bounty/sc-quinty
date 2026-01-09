// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IQuintyNFT
 * @notice Interface for the QuintyNFT badge contract
 * @dev Used by multiple contracts to mint achievement badges
 */
interface IQuintyNFT {
    /**
     * @notice Mint a single badge to a recipient
     * @param recipient Address to receive the badge
     * @param badgeType Type of badge to mint
     * @param metadataURI IPFS URI for badge metadata
     * @return tokenId The ID of the minted badge
     */
    function mintBadge(address recipient, uint8 badgeType, string memory metadataURI) external returns (uint256);

    /**
     * @notice Batch mint badges to multiple recipients
     * @param recipients Array of addresses to receive badges
     * @param badgeType Type of badge to mint for all recipients
     * @param metadataURI IPFS URI for badge metadata
     */
    function batchMintBadges(address[] memory recipients, uint8 badgeType, string memory metadataURI) external;
}
