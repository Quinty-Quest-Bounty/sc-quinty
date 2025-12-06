// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title IQuintyRegistry
 * @notice Interface for the central Quinty protocol registry
 * @dev Inspired by Aave's AddressesProvider and Synthetix's AddressResolver
 */
interface IQuintyRegistry {

    // ==================== EVENTS ====================

    /**
     * @notice Emitted when a contract is registered or updated
     * @param contractType Type identifier (e.g., "QUINTY", "GRANT_PROGRAM")
     * @param contractAddress Address of the registered contract
     * @param version Version number of the contract
     * @param previousAddress Previous address (address(0) if new registration)
     */
    event ContractRegistered(
        bytes32 indexed contractType,
        address indexed contractAddress,
        uint256 version,
        address previousAddress
    );

    /**
     * @notice Emitted when a contract version is deprecated
     * @param contractType Type identifier
     * @param version Version number deprecated
     * @param contractAddress Address of deprecated contract
     */
    event ContractDeprecated(
        bytes32 indexed contractType,
        uint256 version,
        address indexed contractAddress
    );

    /**
     * @notice Emitted when protocol is paused/unpaused
     * @param paused True if paused, false if unpaused
     */
    event ProtocolPaused(bool paused);

    // ==================== STRUCTS ====================

    /**
     * @notice Information about a registered contract
     * @param contractAddress Address of the contract
     * @param version Version number
     * @param isActive Whether this version is active
     * @param deployedAt Timestamp of deployment
     * @param deprecatedAt Timestamp when deprecated (0 if active)
     */
    struct ContractInfo {
        address contractAddress;
        uint256 version;
        bool isActive;
        uint256 deployedAt;
        uint256 deprecatedAt;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Get the latest active contract address for a type
     * @param contractType Type identifier (e.g., keccak256("QUINTY"))
     * @return address Latest active contract address
     */
    function getContract(bytes32 contractType) external view returns (address);

    /**
     * @notice Get a specific version of a contract
     * @param contractType Type identifier
     * @param version Version number
     * @return address Contract address for that version
     */
    function getContractByVersion(bytes32 contractType, uint256 version) external view returns (address);

    /**
     * @notice Get detailed information about the latest contract
     * @param contractType Type identifier
     * @return ContractInfo struct with all details
     */
    function getContractInfo(bytes32 contractType) external view returns (ContractInfo memory);

    /**
     * @notice Get all versions of a contract type
     * @param contractType Type identifier
     * @return address[] Array of all contract addresses (all versions)
     */
    function getAllVersions(bytes32 contractType) external view returns (address[] memory);

    /**
     * @notice Check if a contract is registered and active
     * @param contractType Type identifier
     * @return bool True if contract exists and is active
     */
    function isActive(bytes32 contractType) external view returns (bool);

    /**
     * @notice Check if protocol is paused
     * @return bool True if paused
     */
    function isPaused() external view returns (bool);

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Register a new contract or update existing one
     * @param contractType Type identifier
     * @param contractAddress Address of the new contract
     * @dev Only callable by admin/upgrader role
     */
    function registerContract(bytes32 contractType, address contractAddress) external;

    /**
     * @notice Batch register multiple contracts
     * @param contractTypes Array of type identifiers
     * @param contractAddresses Array of contract addresses
     * @dev Only callable by upgrader role
     */
    function batchRegisterContracts(
        bytes32[] calldata contractTypes,
        address[] calldata contractAddresses
    ) external;

    /**
     * @notice Deprecate a specific contract version
     * @param contractType Type identifier
     * @param version Version to deprecate
     * @dev Only callable by admin role
     */
    function deprecateContract(bytes32 contractType, uint256 version) external;

    /**
     * @notice Emergency pause protocol
     * @param paused True to pause, false to unpause
     * @dev Only callable by pauser/admin role
     */
    function setPaused(bool paused) external;
}
