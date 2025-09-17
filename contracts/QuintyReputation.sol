// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract QuintyReputation is ERC721URIStorage, Ownable {
    using Strings for uint256;

    struct Reputation {
        uint256 bountiesCreated;
        uint256 successfulBounties;
        uint256 creationSuccessRate;
        uint256 firstBountyTimestamp;
        uint256 solvesAttempted;
        uint256 successfulSolves;
        uint256 solveSuccessRate;
        uint256 totalSolvedCount;
        uint256 tokenId;
        string level;
        bool hasCreatorBadge;
        bool hasSolverBadge;
        uint256 lastUpdated;
    }

    mapping(address => Reputation) public reputations;
    uint256 private _tokenCounter;

    // Thresholds for badge levels (basis points)
    uint256 public constant BRONZE_RATE = 5000;  // 50%
    uint256 public constant BRONZE_ACTIONS = 5;
    uint256 public constant SILVER_RATE = 8000;  // 80%
    uint256 public constant SILVER_ACTIONS = 20;
    uint256 public constant GOLD_RATE = 9500;    // 95%
    uint256 public constant GOLD_ACTIONS = 50;

    string public baseIpfsUri = "ipfs://QmExampleCid/";

    event ReputationUpdated(address indexed user, bool isCreator, bool success);
    event BadgeMintedOrUpgraded(address indexed user, uint256 tokenId, string level, string tokenURI);

    constructor() ERC721("QuintyReputation", "QREP") Ownable(msg.sender) {}

    function setBaseIpfsUri(string memory _newBaseUri) external onlyOwner {
        baseIpfsUri = _newBaseUri;
    }

    function isHighRepCreator(address _user) external view returns (bool) {
        Reputation memory rep = reputations[_user];
        return rep.creationSuccessRate >= SILVER_RATE && rep.bountiesCreated >= SILVER_ACTIONS;
    }

    function getSolverSolvedCount(address _user) external view returns (uint256) {
        return reputations[_user].totalSolvedCount;
    }

    function getCreatorActiveSince(address _user) external view returns (uint256) {
        return reputations[_user].firstBountyTimestamp;
    }

    function updateCreatorRep(address _user, bool _success) external onlyOwner {
        Reputation storage rep = reputations[_user];
        rep.bountiesCreated += 1;

        if (rep.firstBountyTimestamp == 0) {
            rep.firstBountyTimestamp = block.timestamp;
        }

        if (_success) {
            rep.successfulBounties += 1;
        }

        rep.creationSuccessRate = rep.bountiesCreated > 0 ?
            (rep.successfulBounties * 10000) / rep.bountiesCreated : 0;

        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(_user, true, _success);
        _checkAndUpdateBadge(_user, true);
    }

    function updateSolverRep(address _user, bool _success) external onlyOwner {
        Reputation storage rep = reputations[_user];
        rep.solvesAttempted += 1;

        if (_success) {
            rep.successfulSolves += 1;
            rep.totalSolvedCount += 1;
        }

        rep.solveSuccessRate = rep.solvesAttempted > 0 ?
            (rep.successfulSolves * 10000) / rep.solvesAttempted : 0;

        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(_user, false, _success);
        _checkAndUpdateBadge(_user, false);
    }

    function _checkAndUpdateBadge(address _user, bool _isCreator) internal {
        Reputation storage rep = reputations[_user];
        uint256 rate = _isCreator ? rep.creationSuccessRate : rep.solveSuccessRate;
        uint256 actions = _isCreator ? rep.bountiesCreated : rep.solvesAttempted;

        string memory newLevel = "";
        bool shouldUpdate = false;

        if (rate >= GOLD_RATE && actions >= GOLD_ACTIONS) {
            newLevel = "Gold";
            shouldUpdate = true;
        } else if (rate >= SILVER_RATE && actions >= SILVER_ACTIONS) {
            newLevel = "Silver";
            shouldUpdate = true;
        } else if (rate >= BRONZE_RATE && actions >= BRONZE_ACTIONS) {
            newLevel = "Bronze";
            shouldUpdate = true;
        }

        if (!shouldUpdate) return;

        // Determine if this is the first badge or an upgrade
        bool needsNewToken = false;
        bool isUpgrade = false;

        if (_isCreator) {
            if (!rep.hasCreatorBadge) {
                needsNewToken = true;
                rep.hasCreatorBadge = true;
            } else {
                isUpgrade = _isLevelUpgrade(rep.level, newLevel);
            }
        } else {
            if (!rep.hasSolverBadge) {
                needsNewToken = true;
                rep.hasSolverBadge = true;
            } else {
                isUpgrade = _isLevelUpgrade(rep.level, newLevel);
            }
        }

        if (needsNewToken) {
            // Mint new token
            _tokenCounter += 1;
            rep.tokenId = _tokenCounter;
            rep.level = newLevel;

            string memory uri = _generateIpfsUri(newLevel, _isCreator, rep);
            _safeMint(_user, _tokenCounter);
            _setTokenURI(_tokenCounter, uri);

            emit BadgeMintedOrUpgraded(_user, _tokenCounter, newLevel, uri);
        } else if (isUpgrade) {
            // Update existing token
            rep.level = newLevel;
            string memory uri = _generateIpfsUri(newLevel, _isCreator, rep);
            _setTokenURI(rep.tokenId, uri);

            emit BadgeMintedOrUpgraded(_user, rep.tokenId, newLevel, uri);
        }
    }

    function _isLevelUpgrade(string memory currentLevel, string memory newLevel) internal pure returns (bool) {
        bytes32 currentHash = keccak256(bytes(currentLevel));
        bytes32 newHash = keccak256(bytes(newLevel));

        if (newHash == keccak256(bytes("Gold"))) {
            return currentHash != newHash;
        } else if (newHash == keccak256(bytes("Silver"))) {
            return currentHash == keccak256(bytes("Bronze")) || currentHash == keccak256(bytes(""));
        } else if (newHash == keccak256(bytes("Bronze"))) {
            return currentHash == keccak256(bytes(""));
        }

        return false;
    }

    function _generateIpfsUri(string memory level, bool isCreator, Reputation memory rep) internal view returns (string memory) {
        string memory role = isCreator ? "Creator" : "Solver";
        string memory filename = string(abi.encodePacked(
            _toLowerCase(level), "-", _toLowerCase(role), ".json"
        ));
        return string(abi.encodePacked(baseIpfsUri, filename));
    }

    function _toLowerCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);

        for (uint i = 0; i < bStr.length; i++) {
            if (uint8(bStr[i]) >= 65 && uint8(bStr[i]) <= 90) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            require(false, "Soulbound: tokens cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    function getUserReputation(address _user) external view returns (
        uint256 bountiesCreated,
        uint256 successfulBounties,
        uint256 creationSuccessRate,
        uint256 firstBountyTimestamp,
        uint256 solvesAttempted,
        uint256 successfulSolves,
        uint256 solveSuccessRate,
        uint256 totalSolvedCount,
        uint256 tokenId,
        string memory level,
        bool hasCreatorBadge,
        bool hasSolverBadge
    ) {
        Reputation storage rep = reputations[_user];
        return (
            rep.bountiesCreated,
            rep.successfulBounties,
            rep.creationSuccessRate,
            rep.firstBountyTimestamp,
            rep.solvesAttempted,
            rep.successfulSolves,
            rep.solveSuccessRate,
            rep.totalSolvedCount,
            rep.tokenId,
            rep.level,
            rep.hasCreatorBadge,
            rep.hasSolverBadge
        );
    }

    function getCreatorStats(address _user) external view returns (
        uint256 created,
        uint256 successful,
        uint256 rate,
        uint256 activeSince
    ) {
        Reputation storage rep = reputations[_user];
        return (rep.bountiesCreated, rep.successfulBounties, rep.creationSuccessRate, rep.firstBountyTimestamp);
    }

    function getSolverStats(address _user) external view returns (
        uint256 attempted,
        uint256 successful,
        uint256 rate,
        uint256 totalSolved
    ) {
        Reputation storage rep = reputations[_user];
        return (rep.solvesAttempted, rep.successfulSolves, rep.solveSuccessRate, rep.totalSolvedCount);
    }

    function getBadgeLevel(address _user) external view returns (string memory) {
        return reputations[_user].level;
    }

    function hasBadge(address _user) external view returns (bool) {
        Reputation storage rep = reputations[_user];
        return rep.hasCreatorBadge || rep.hasSolverBadge;
    }

    function getTokenIdForUser(address _user) external view returns (uint256) {
        return reputations[_user].tokenId;
    }

    function getTotalSupply() external view returns (uint256) {
        return _tokenCounter;
    }
}