// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IQuintyRegistry.sol";

/**
 * @title QuintyRegistry
 * @notice Central registry for all Quinty protocol contracts
 * @dev Implements versioning, upgradeability, and emergency controls
 *
 * Architecture inspired by:
 * - Aave's PoolAddressesProvider
 * - Synthetix's AddressResolver
 * - Compound's Comptroller
 *
 * Benefits:
 * - Single source of truth for all contract addresses
 * - Frontend queries one contract for all addresses
 * - Easy to upgrade individual components
 * - Supports multiple versions (rollback capability)
 * - Emergency pause functionality
 */
contract QuintyRegistry is AccessControl, Pausable, IQuintyRegistry {

    // ==================== ROLES ====================

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ==================== CONTRACT TYPE IDENTIFIERS ====================

    // Core contracts
    bytes32 public constant QUINTY = keccak256("QUINTY");
    bytes32 public constant QUINTY_REPUTATION = keccak256("QUINTY_REPUTATION");
    bytes32 public constant QUINTY_NFT = keccak256("QUINTY_NFT");
    bytes32 public constant DISPUTE_RESOLVER = keccak256("DISPUTE_RESOLVER");

    // Funding contracts
    bytes32 public constant GRANT_PROGRAM = keccak256("GRANT_PROGRAM");
    bytes32 public constant CROWDFUNDING = keccak256("CROWDFUNDING");
    bytes32 public constant LOOKING_FOR_GRANT = keccak256("LOOKING_FOR_GRANT");
    bytes32 public constant AIRDROP_BOUNTY = keccak256("AIRDROP_BOUNTY");

    // Utility contracts
    bytes32 public constant SOCIAL_VERIFICATION = keccak256("SOCIAL_VERIFICATION");

    // ==================== STATE ====================

    /**
     * @notice Mapping: contractType => version => ContractInfo
     * @dev Stores all versions of each contract type
     */
    mapping(bytes32 => mapping(uint256 => ContractInfo)) private _contractVersions;

    /**
     * @notice Mapping: contractType => latest version number
     * @dev Tracks the current version for each contract type
     */
    mapping(bytes32 => uint256) private _latestVersion;

    /**
     * @notice Mapping: contractType => array of all version numbers
     * @dev Used to enumerate all versions of a contract
     */
    mapping(bytes32 => uint256[]) private _allVersions;

    /**
     * @notice Protocol creation timestamp
     */
    uint256 public immutable deployedAt;

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Initialize the registry
     * @dev Sets up roles and deploys registry
     */
    constructor() {
        deployedAt = block.timestamp;

        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @inheritdoc IQuintyRegistry
     */
    function getContract(bytes32 contractType) external view override returns (address) {
        uint256 version = _latestVersion[contractType];
        require(version > 0, "Contract type not registered");

        ContractInfo memory info = _contractVersions[contractType][version];
        require(info.isActive, "Contract is deprecated");

        return info.contractAddress;
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function getContractByVersion(bytes32 contractType, uint256 version)
        external
        view
        override
        returns (address)
    {
        require(version > 0 && version <= _latestVersion[contractType], "Invalid version");

        ContractInfo memory info = _contractVersions[contractType][version];
        require(info.contractAddress != address(0), "Version not found");

        return info.contractAddress;
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function getContractInfo(bytes32 contractType)
        external
        view
        override
        returns (ContractInfo memory)
    {
        uint256 version = _latestVersion[contractType];
        require(version > 0, "Contract type not registered");

        return _contractVersions[contractType][version];
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function getAllVersions(bytes32 contractType)
        external
        view
        override
        returns (address[] memory)
    {
        uint256[] memory versions = _allVersions[contractType];
        address[] memory addresses = new address[](versions.length);

        for (uint256 i = 0; i < versions.length; i++) {
            addresses[i] = _contractVersions[contractType][versions[i]].contractAddress;
        }

        return addresses;
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function isActive(bytes32 contractType) external view override returns (bool) {
        uint256 version = _latestVersion[contractType];
        if (version == 0) return false;

        return _contractVersions[contractType][version].isActive;
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function isPaused() external view override returns (bool) {
        return paused();
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @inheritdoc IQuintyRegistry
     */
    function registerContract(bytes32 contractType, address contractAddress)
        external
        override
        onlyRole(UPGRADER_ROLE)
    {
        require(contractAddress != address(0), "Invalid contract address");
        require(contractType != bytes32(0), "Invalid contract type");

        uint256 previousVersion = _latestVersion[contractType];
        uint256 newVersion = previousVersion + 1;

        address previousAddress = previousVersion > 0
            ? _contractVersions[contractType][previousVersion].contractAddress
            : address(0);

        // Create new contract info
        _contractVersions[contractType][newVersion] = ContractInfo({
            contractAddress: contractAddress,
            version: newVersion,
            isActive: true,
            deployedAt: block.timestamp,
            deprecatedAt: 0
        });

        // Update latest version
        _latestVersion[contractType] = newVersion;
        _allVersions[contractType].push(newVersion);

        // Auto-deprecate previous version if it exists
        if (previousVersion > 0) {
            _contractVersions[contractType][previousVersion].isActive = false;
            _contractVersions[contractType][previousVersion].deprecatedAt = block.timestamp;
        }

        emit ContractRegistered(contractType, contractAddress, newVersion, previousAddress);
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function batchRegisterContracts(
        bytes32[] calldata contractTypes,
        address[] calldata contractAddresses
    ) external override onlyRole(UPGRADER_ROLE) {
        require(contractTypes.length == contractAddresses.length, "Array length mismatch");
        require(contractTypes.length <= 20, "Too many contracts");

        for (uint256 i = 0; i < contractTypes.length; i++) {
            require(contractAddresses[i] != address(0), "Invalid contract address");
            require(contractTypes[i] != bytes32(0), "Invalid contract type");

            uint256 previousVersion = _latestVersion[contractTypes[i]];
            uint256 newVersion = previousVersion + 1;

            address previousAddress = previousVersion > 0
                ? _contractVersions[contractTypes[i]][previousVersion].contractAddress
                : address(0);

            _contractVersions[contractTypes[i]][newVersion] = ContractInfo({
                contractAddress: contractAddresses[i],
                version: newVersion,
                isActive: true,
                deployedAt: block.timestamp,
                deprecatedAt: 0
            });

            _latestVersion[contractTypes[i]] = newVersion;
            _allVersions[contractTypes[i]].push(newVersion);

            if (previousVersion > 0) {
                _contractVersions[contractTypes[i]][previousVersion].isActive = false;
                _contractVersions[contractTypes[i]][previousVersion].deprecatedAt = block.timestamp;
            }

            emit ContractRegistered(contractTypes[i], contractAddresses[i], newVersion, previousAddress);
        }
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function deprecateContract(bytes32 contractType, uint256 version)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(version > 0 && version <= _latestVersion[contractType], "Invalid version");

        ContractInfo storage info = _contractVersions[contractType][version];
        require(info.contractAddress != address(0), "Version not found");
        require(info.isActive, "Already deprecated");

        info.isActive = false;
        info.deprecatedAt = block.timestamp;

        emit ContractDeprecated(contractType, version, info.contractAddress);
    }

    /**
     * @inheritdoc IQuintyRegistry
     */
    function setPaused(bool _paused) external override onlyRole(PAUSER_ROLE) {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }

        emit ProtocolPaused(_paused);
    }

    // ==================== CONVENIENCE GETTERS ====================

    /**
     * @notice Get all contract addresses for frontend (latest versions only)
     * @return quinty Latest Quinty contract
     * @return reputation Latest QuintyReputation contract
     * @return nft Latest QuintyNFT contract
     * @return disputeResolver Latest DisputeResolver contract
     * @return grantProgram Latest GrantProgram contract
     * @return crowdfunding Latest Crowdfunding contract
     * @return lookingForGrant Latest LookingForGrant contract
     * @return airdropBounty Latest AirdropBounty contract
     * @return socialVerification Latest SocialVerification contract
     */
    function getAllContracts() external view returns (
        address quinty,
        address reputation,
        address nft,
        address disputeResolver,
        address grantProgram,
        address crowdfunding,
        address lookingForGrant,
        address airdropBounty,
        address socialVerification
    ) {
        quinty = _getActiveContract(QUINTY);
        reputation = _getActiveContract(QUINTY_REPUTATION);
        nft = _getActiveContract(QUINTY_NFT);
        disputeResolver = _getActiveContract(DISPUTE_RESOLVER);
        grantProgram = _getActiveContract(GRANT_PROGRAM);
        crowdfunding = _getActiveContract(CROWDFUNDING);
        lookingForGrant = _getActiveContract(LOOKING_FOR_GRANT);
        airdropBounty = _getActiveContract(AIRDROP_BOUNTY);
        socialVerification = _getActiveContract(SOCIAL_VERIFICATION);
    }

    /**
     * @notice Get contract type identifier by name
     * @param name Contract name as string
     * @return bytes32 Contract type identifier
     */
    function getContractTypeId(string memory name) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }

    /**
     * @notice Get version count for a contract type
     * @param contractType Type identifier
     * @return uint256 Number of versions deployed
     */
    function getVersionCount(bytes32 contractType) external view returns (uint256) {
        return _allVersions[contractType].length;
    }

    /**
     * @notice Get latest version number for a contract type
     * @param contractType Type identifier
     * @return uint256 Latest version number (0 if not registered)
     */
    function getLatestVersion(bytes32 contractType) external view returns (uint256) {
        return _latestVersion[contractType];
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * @dev Internal helper to get active contract address
     * @param contractType Type identifier
     * @return address Contract address (address(0) if not found/active)
     */
    function _getActiveContract(bytes32 contractType) internal view returns (address) {
        uint256 version = _latestVersion[contractType];
        if (version == 0) return address(0);

        ContractInfo memory info = _contractVersions[contractType][version];
        return info.isActive ? info.contractAddress : address(0);
    }
}
