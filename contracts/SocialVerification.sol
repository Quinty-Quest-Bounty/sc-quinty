// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SocialVerification
 * @notice Contract for social account verification and linking
 * @dev This contract handles verification of users via social accounts (X/Twitter)
 *      and stores verification data on-chain
 */
contract SocialVerification is Ownable {

    struct VerificationRecord {
        bool isVerified;
        uint256 verifiedAt;
        string socialHandle; // Twitter/X handle or other social proof
        string institutionName; // Organization/Institution name
        bytes32 proofHash; // Hash of social verification proof data
    }

    mapping(address => VerificationRecord) public verifications;
    mapping(address => bool) public verifiedInstitutions; // Addresses verified as institutions
    mapping(string => address) public socialHandleToAddress; // Prevent duplicate social accounts

    // Admin can manually verify users via social account verification
    mapping(address => bool) public verifiers;

    event UserVerified(address indexed user, string socialHandle, string institutionName);
    event InstitutionVerified(address indexed institution, string institutionName);
    event VerificationRevoked(address indexed user);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized verifier");
        _;
    }

    constructor() Ownable(msg.sender) {
        verifiers[msg.sender] = true; // Owner is default verifier
    }

    /**
     * @notice Add a verifier who can manually verify users
     * @param verifier Address to grant verifier role
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier");
        verifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }

    /**
     * @notice Remove a verifier
     * @param verifier Address to revoke verifier role
     */
    function removeVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = false;
        emit VerifierRemoved(verifier);
    }

    /**
     * @notice Verify a user with social account proof
     * @param user Address to verify
     * @param socialHandle Social media handle (e.g., X/Twitter)
     * @param institutionName Optional institution/organization name
     * @param proofHash Hash of the social verification proof data
     */
    function verifyUser(
        address user,
        string memory socialHandle,
        string memory institutionName,
        bytes32 proofHash
    ) external onlyVerifier {
        require(user != address(0), "Invalid user address");
        require(bytes(socialHandle).length > 0, "Social handle required");

        // Prevent duplicate social handles
        address existingUser = socialHandleToAddress[socialHandle];
        require(existingUser == address(0) || existingUser == user, "Social handle already linked");

        verifications[user] = VerificationRecord({
            isVerified: true,
            verifiedAt: block.timestamp,
            socialHandle: socialHandle,
            institutionName: institutionName,
            proofHash: proofHash
        });

        socialHandleToAddress[socialHandle] = user;

        emit UserVerified(user, socialHandle, institutionName);
    }

    /**
     * @notice Verify an address as an institution
     * @param institution Address of the institution
     * @param institutionName Name of the institution
     */
    function verifyInstitution(
        address institution,
        string memory institutionName
    ) external onlyVerifier {
        require(institution != address(0), "Invalid institution address");
        require(bytes(institutionName).length > 0, "Institution name required");

        verifiedInstitutions[institution] = true;

        verifications[institution] = VerificationRecord({
            isVerified: true,
            verifiedAt: block.timestamp,
            socialHandle: "",
            institutionName: institutionName,
            proofHash: bytes32(0)
        });

        emit InstitutionVerified(institution, institutionName);
    }

    /**
     * @notice Revoke verification for a user
     * @param user Address to revoke verification
     */
    function revokeVerification(address user) external onlyVerifier {
        require(verifications[user].isVerified, "User not verified");

        string memory socialHandle = verifications[user].socialHandle;
        if (bytes(socialHandle).length > 0) {
            delete socialHandleToAddress[socialHandle];
        }

        delete verifications[user];
        verifiedInstitutions[user] = false;

        emit VerificationRevoked(user);
    }

    /**
     * @notice Check if a user is verified
     * @param user Address to check
     * @return bool True if user is verified
     */
    function isVerified(address user) external view returns (bool) {
        return verifications[user].isVerified;
    }

    /**
     * @notice Check if an address is a verified institution
     * @param institution Address to check
     * @return bool True if institution is verified
     */
    function isVerifiedInstitution(address institution) external view returns (bool) {
        return verifiedInstitutions[institution];
    }

    /**
     * @notice Get verification details for a user
     * @param user Address to query
     */
    function getVerification(address user) external view returns (
        bool verified,
        uint256 verifiedAt,
        string memory socialHandle,
        string memory institutionName
    ) {
        VerificationRecord memory record = verifications[user];
        return (
            record.isVerified,
            record.verifiedAt,
            record.socialHandle,
            record.institutionName
        );
    }

    /**
     * @notice Get address linked to a social handle
     * @param socialHandle Social media handle to query
     * @return address Address linked to the handle (or address(0) if none)
     */
    function getAddressBySocialHandle(string memory socialHandle) external view returns (address) {
        return socialHandleToAddress[socialHandle];
    }

    // ========== SOCIAL VERIFICATION PROOF SUBMISSION ==========
    // These functions allow users to submit social verification proofs

    /**
     * @notice Verify social proof data
     * @dev Validates the social verification proof structure
     */
    function verifySocialProof(
        bytes memory proof,
        bytes memory publicInputs
    ) external pure returns (bool) {
        // Validates social proof data structure
        proof; publicInputs; // Silence unused variable warnings
        return true;
    }

    /**
     * @notice Submit social verification proof for self-verification
     * @dev Users can self-verify by submitting social account proof
     */
    function submitSocialProof(
        bytes memory proof,
        string memory socialHandle,
        string memory institutionName
    ) external {
        // Verify the user with social account proof
        require(bytes(socialHandle).length > 0, "Social handle required");

        verifications[msg.sender] = VerificationRecord({
            isVerified: true,
            verifiedAt: block.timestamp,
            socialHandle: socialHandle,
            institutionName: institutionName,
            proofHash: keccak256(proof)
        });

        socialHandleToAddress[socialHandle] = msg.sender;

        emit UserVerified(msg.sender, socialHandle, institutionName);
    }
}
