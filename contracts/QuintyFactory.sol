// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./QuintyRegistry.sol";
import "./Quinty.sol";
import "./QuintyReputation.sol";
import "./QuintyNFT.sol";
import "./DisputeResolver.sol";
import "./GrantProgram.sol";
import "./Crowdfunding.sol";
import "./LookingForGrant.sol";
import "./AirdropBounty.sol";
import "./SocialVerification.sol";

/**
 * @title QuintyFactory
 * @notice Factory for deploying Quinty protocol contracts with automatic registration
 * @dev
 *
 * Benefits:
 * - Deploy and register in one transaction
 * - Standardized deployment process
 * - Automatic setup and linking
 * - Event tracking for all deployments
 * - Supports upgrades (deploy new version + register)
 */
contract QuintyFactory is Ownable {

    // ==================== STATE ====================

    QuintyRegistry public immutable registry;

    // ==================== EVENTS ====================

    event ContractDeployed(
        bytes32 indexed contractType,
        address indexed contractAddress,
        uint256 version,
        address deployer
    );

    event EcosystemDeployed(
        address quinty,
        address reputation,
        address nft,
        address disputeResolver,
        uint256 timestamp
    );

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Initialize factory with registry
     * @param _registry Address of the QuintyRegistry
     */
    constructor(address _registry) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        registry = QuintyRegistry(_registry);
    }

    // ==================== CORE CONTRACT DEPLOYMENT ====================

    /**
     * @notice Deploy Quinty core bounty contract
     * @return address Deployed contract address
     */
    function deployQuinty() external onlyOwner returns (address) {
        Quinty quinty = new Quinty();
        address quintyAddress = address(quinty);

        registry.registerContract(QuintyRegistry(address(registry)).QUINTY(), quintyAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).QUINTY(),
            quintyAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).QUINTY()),
            msg.sender
        );

        return quintyAddress;
    }

    /**
     * @notice Deploy QuintyReputation contract
     * @param _baseTokenURI Base URI for NFT metadata
     * @return address Deployed contract address
     */
    function deployQuintyReputation(string memory _baseTokenURI) external onlyOwner returns (address) {
        QuintyReputation reputation = new QuintyReputation(_baseTokenURI);
        address reputationAddress = address(reputation);

        registry.registerContract(QuintyRegistry(address(registry)).QUINTY_REPUTATION(), reputationAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).QUINTY_REPUTATION(),
            reputationAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).QUINTY_REPUTATION()),
            msg.sender
        );

        return reputationAddress;
    }

    /**
     * @notice Deploy QuintyNFT contract
     * @param _baseTokenURI Base URI for badge metadata
     * @return address Deployed contract address
     */
    function deployQuintyNFT(string memory _baseTokenURI) external onlyOwner returns (address) {
        QuintyNFT nft = new QuintyNFT(_baseTokenURI);
        address nftAddress = address(nft);

        registry.registerContract(QuintyRegistry(address(registry)).QUINTY_NFT(), nftAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).QUINTY_NFT(),
            nftAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).QUINTY_NFT()),
            msg.sender
        );

        return nftAddress;
    }

    /**
     * @notice Deploy DisputeResolver contract
     * @param _quintyAddress Address of Quinty contract
     * @return address Deployed contract address
     */
    function deployDisputeResolver(address _quintyAddress) external onlyOwner returns (address) {
        DisputeResolver dispute = new DisputeResolver(_quintyAddress);
        address disputeAddress = address(dispute);

        registry.registerContract(QuintyRegistry(address(registry)).DISPUTE_RESOLVER(), disputeAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).DISPUTE_RESOLVER(),
            disputeAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).DISPUTE_RESOLVER()),
            msg.sender
        );

        return disputeAddress;
    }

    // ==================== FUNDING CONTRACT DEPLOYMENT ====================

    /**
     * @notice Deploy GrantProgram contract
     * @return address Deployed contract address
     */
    function deployGrantProgram() external onlyOwner returns (address) {
        GrantProgram grantProgram = new GrantProgram();
        address grantProgramAddress = address(grantProgram);

        registry.registerContract(QuintyRegistry(address(registry)).GRANT_PROGRAM(), grantProgramAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).GRANT_PROGRAM(),
            grantProgramAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).GRANT_PROGRAM()),
            msg.sender
        );

        return grantProgramAddress;
    }

    /**
     * @notice Deploy Crowdfunding contract
     * @return address Deployed contract address
     */
    function deployCrowdfunding() external onlyOwner returns (address) {
        Crowdfunding crowdfunding = new Crowdfunding();
        address crowdfundingAddress = address(crowdfunding);

        registry.registerContract(QuintyRegistry(address(registry)).CROWDFUNDING(), crowdfundingAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).CROWDFUNDING(),
            crowdfundingAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).CROWDFUNDING()),
            msg.sender
        );

        return crowdfundingAddress;
    }

    /**
     * @notice Deploy LookingForGrant contract
     * @return address Deployed contract address
     */
    function deployLookingForGrant() external onlyOwner returns (address) {
        LookingForGrant lookingForGrant = new LookingForGrant();
        address lookingForGrantAddress = address(lookingForGrant);

        registry.registerContract(QuintyRegistry(address(registry)).LOOKING_FOR_GRANT(), lookingForGrantAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).LOOKING_FOR_GRANT(),
            lookingForGrantAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).LOOKING_FOR_GRANT()),
            msg.sender
        );

        return lookingForGrantAddress;
    }

    /**
     * @notice Deploy AirdropBounty contract
     * @return address Deployed contract address
     */
    function deployAirdropBounty() external onlyOwner returns (address) {
        AirdropBounty airdropBounty = new AirdropBounty();
        address airdropBountyAddress = address(airdropBounty);

        registry.registerContract(QuintyRegistry(address(registry)).AIRDROP_BOUNTY(), airdropBountyAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).AIRDROP_BOUNTY(),
            airdropBountyAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).AIRDROP_BOUNTY()),
            msg.sender
        );

        return airdropBountyAddress;
    }

    /**
     * @notice Deploy SocialVerification contract
     * @return address Deployed contract address
     */
    function deploySocialVerification() external onlyOwner returns (address) {
        SocialVerification socialVerification = new SocialVerification();
        address socialVerificationAddress = address(socialVerification);

        registry.registerContract(QuintyRegistry(address(registry)).SOCIAL_VERIFICATION(), socialVerificationAddress);

        emit ContractDeployed(
            QuintyRegistry(address(registry)).SOCIAL_VERIFICATION(),
            socialVerificationAddress,
            registry.getLatestVersion(QuintyRegistry(address(registry)).SOCIAL_VERIFICATION()),
            msg.sender
        );

        return socialVerificationAddress;
    }

    // ==================== ECOSYSTEM DEPLOYMENT ====================

    /**
     * @notice Deploy entire Quinty ecosystem in one transaction
     * @param reputationBaseURI Base URI for reputation NFTs
     * @param nftBaseURI Base URI for badge NFTs
     * @return quintyAddress Address of deployed Quinty contract
     * @return reputationAddress Address of deployed QuintyReputation contract
     * @return nftAddress Address of deployed QuintyNFT contract
     * @return disputeAddress Address of deployed DisputeResolver contract
     * @return grantProgramAddress Address of deployed GrantProgram contract
     * @return crowdfundingAddress Address of deployed Crowdfunding contract
     * @return lookingForGrantAddress Address of deployed LookingForGrant contract
     * @return airdropBountyAddress Address of deployed AirdropBounty contract
     * @return socialVerificationAddress Address of deployed SocialVerification contract
     * @dev This is expensive but convenient for initial deployment
     */
    function deployFullEcosystem(
        string memory reputationBaseURI,
        string memory nftBaseURI
    ) external onlyOwner returns (
        address quintyAddress,
        address reputationAddress,
        address nftAddress,
        address disputeAddress,
        address grantProgramAddress,
        address crowdfundingAddress,
        address lookingForGrantAddress,
        address airdropBountyAddress,
        address socialVerificationAddress
    ) {
        // Deploy core contracts
        QuintyReputation reputation = new QuintyReputation(reputationBaseURI);
        reputationAddress = address(reputation);

        Quinty quinty = new Quinty();
        quintyAddress = address(quinty);

        DisputeResolver dispute = new DisputeResolver(quintyAddress);
        disputeAddress = address(dispute);

        QuintyNFT nft = new QuintyNFT(nftBaseURI);
        nftAddress = address(nft);

        // Deploy funding contracts
        GrantProgram grantProgram = new GrantProgram();
        grantProgramAddress = address(grantProgram);

        Crowdfunding crowdfunding = new Crowdfunding();
        crowdfundingAddress = address(crowdfunding);

        LookingForGrant lookingForGrant = new LookingForGrant();
        lookingForGrantAddress = address(lookingForGrant);

        AirdropBounty airdropBounty = new AirdropBounty();
        airdropBountyAddress = address(airdropBounty);

        SocialVerification socialVerification = new SocialVerification();
        socialVerificationAddress = address(socialVerification);

        // Register all contracts in batch
        bytes32[] memory types = new bytes32[](9);
        address[] memory addresses = new address[](9);

        types[0] = QuintyRegistry(address(registry)).QUINTY();
        types[1] = QuintyRegistry(address(registry)).QUINTY_REPUTATION();
        types[2] = QuintyRegistry(address(registry)).QUINTY_NFT();
        types[3] = QuintyRegistry(address(registry)).DISPUTE_RESOLVER();
        types[4] = QuintyRegistry(address(registry)).GRANT_PROGRAM();
        types[5] = QuintyRegistry(address(registry)).CROWDFUNDING();
        types[6] = QuintyRegistry(address(registry)).LOOKING_FOR_GRANT();
        types[7] = QuintyRegistry(address(registry)).AIRDROP_BOUNTY();
        types[8] = QuintyRegistry(address(registry)).SOCIAL_VERIFICATION();

        addresses[0] = quintyAddress;
        addresses[1] = reputationAddress;
        addresses[2] = nftAddress;
        addresses[3] = disputeAddress;
        addresses[4] = grantProgramAddress;
        addresses[5] = crowdfundingAddress;
        addresses[6] = lookingForGrantAddress;
        addresses[7] = airdropBountyAddress;
        addresses[8] = socialVerificationAddress;

        registry.batchRegisterContracts(types, addresses);

        emit EcosystemDeployed(quintyAddress, reputationAddress, nftAddress, disputeAddress, block.timestamp);
    }

    // ==================== SETUP HELPERS ====================

    /**
     * @notice Setup connections for core contracts (after deployment)
     * @dev Call this after deploying all core contracts
     */
    function setupCoreConnections() external onlyOwner {
        address quintyAddress = registry.getContract(QuintyRegistry(address(registry)).QUINTY());
        address reputationAddress = registry.getContract(QuintyRegistry(address(registry)).QUINTY_REPUTATION());
        address disputeAddress = registry.getContract(QuintyRegistry(address(registry)).DISPUTE_RESOLVER());
        address nftAddress = registry.getContract(QuintyRegistry(address(registry)).QUINTY_NFT());

        require(quintyAddress != address(0), "Quinty not deployed");
        require(reputationAddress != address(0), "Reputation not deployed");
        require(nftAddress != address(0), "NFT not deployed");

        // Set addresses in Quinty
        Quinty(quintyAddress).setAddresses(reputationAddress, disputeAddress, nftAddress);

        // Transfer QuintyReputation ownership to Quinty
        QuintyReputation(reputationAddress).transferOwnership(quintyAddress);

        // Authorize Quinty to mint NFTs
        QuintyNFT(nftAddress).authorizeMinter(quintyAddress);
    }

    /**
     * @notice Setup funding contracts to use QuintyNFT
     * @dev Call this after deploying funding contracts
     */
    function setupFundingConnections() external onlyOwner {
        address nftAddress = registry.getContract(QuintyRegistry(address(registry)).QUINTY_NFT());
        require(nftAddress != address(0), "NFT not deployed");

        address grantProgramAddress = registry.getContract(QuintyRegistry(address(registry)).GRANT_PROGRAM());
        address crowdfundingAddress = registry.getContract(QuintyRegistry(address(registry)).CROWDFUNDING());
        address lookingForGrantAddress = registry.getContract(QuintyRegistry(address(registry)).LOOKING_FOR_GRANT());

        if (grantProgramAddress != address(0)) {
            GrantProgram(payable(grantProgramAddress)).setNFTAddress(nftAddress);
            QuintyNFT(nftAddress).authorizeMinter(grantProgramAddress);
        }

        if (crowdfundingAddress != address(0)) {
            Crowdfunding(payable(crowdfundingAddress)).setNFTAddress(nftAddress);
            QuintyNFT(nftAddress).authorizeMinter(crowdfundingAddress);
        }

        if (lookingForGrantAddress != address(0)) {
            LookingForGrant(payable(lookingForGrantAddress)).setNFTAddress(nftAddress);
            QuintyNFT(nftAddress).authorizeMinter(lookingForGrantAddress);
        }
    }
}
