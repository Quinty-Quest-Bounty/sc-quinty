// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QuintyReputation is ERC721URIStorage, Ownable {

    struct ReputationStats {
        uint256 bountiesCreated;
        uint256 successfulBounties;
        uint256 creationSuccessRate; // In basis points
        uint256 firstBountyTimestamp;
        uint256 solvesAttempted;
        uint256 successfulSolves;
        uint256 solveSuccessRate; // In basis points
        uint256 totalSolvedCount;
        string creatorLevel;
        string solverLevel;
    }

    mapping(address => ReputationStats) public reputations;
    mapping(address => uint256) private _userToTokenId;
    string private _baseTokenURI;

    uint256 private _tokenCounter;

    // Badge thresholds
    uint256 public constant BRONZE_RATE = 5000; // 50%
    uint256 public constant BRONZE_ACTIONS = 5;
    uint256 public constant SILVER_RATE = 8000; // 80%
    uint256 public constant SILVER_ACTIONS = 20;
    uint256 public constant GOLD_RATE = 9500; // 95%
    uint256 public constant GOLD_ACTIONS = 50;

    event ReputationUpdated(address indexed user, bool isCreator, bool success);
    event BadgeMintedOrUpgraded(address indexed user, uint256 tokenId, string level, bool isCreator);

    constructor(string memory baseTokenURI) ERC721("Quinty Reputation", "QREP") Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI;
    }

    function setBaseTokenURI(string memory baseTokenURI) external onlyOwner {
        _baseTokenURI = baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        address owner = ownerOf(tokenId); // This will revert if token doesn't exist
        ReputationStats memory stats = reputations[owner];
        
        // Determine the higher of the two levels for the token image
        string memory primaryLevel = _getPrimaryLevel(stats.creatorLevel, stats.solverLevel);
        
        return string(abi.encodePacked(_baseTokenURI, primaryLevel, ".json"));
    }

    function updateCreatorRep(address _user, bool _success) external onlyOwner {
        ReputationStats storage stats = reputations[_user];
        if (stats.firstBountyTimestamp == 0) {
            stats.firstBountyTimestamp = block.timestamp;
        }
        stats.bountiesCreated++;
        if (_success) {
            stats.successfulBounties++;
        }
        stats.creationSuccessRate = (stats.successfulBounties * 10000) / stats.bountiesCreated;

        _updateBadge(_user, true);
        emit ReputationUpdated(_user, true, _success);
    }

    function updateSolverRep(address _user, bool _success) external onlyOwner {
        ReputationStats storage stats = reputations[_user];
        stats.solvesAttempted++;
        if (_success) {
            stats.successfulSolves++;
            stats.totalSolvedCount++;
        }
        stats.solveSuccessRate = (stats.successfulSolves * 10000) / stats.solvesAttempted;

        _updateBadge(_user, false);
        emit ReputationUpdated(_user, false, _success);
    }

    function _updateBadge(address _user, bool _isCreator) internal {
        ReputationStats storage stats = reputations[_user];
        string memory currentLevel = _isCreator ? stats.creatorLevel : stats.solverLevel;
        string memory newLevel = _determineLevel(_isCreator ? stats.creationSuccessRate : stats.solveSuccessRate, _isCreator ? stats.bountiesCreated : stats.solvesAttempted);

        if (keccak256(abi.encodePacked(currentLevel)) != keccak256(abi.encodePacked(newLevel))) {
            if (_isCreator) {
                stats.creatorLevel = newLevel;
            } else {
                stats.solverLevel = newLevel;
            }

            uint256 tokenId = _userToTokenId[_user];
            if (tokenId == 0) {
                _tokenCounter++;
                tokenId = _tokenCounter;
                _userToTokenId[_user] = tokenId;
                _safeMint(_user, tokenId);
            }
            emit BadgeMintedOrUpgraded(_user, tokenId, newLevel, _isCreator);
        }
    }

    function _determineLevel(uint256 _rate, uint256 _actions) internal pure returns (string memory) {
        if (_rate >= GOLD_RATE && _actions >= GOLD_ACTIONS) return "Gold";
        if (_rate >= SILVER_RATE && _actions >= SILVER_ACTIONS) return "Silver";
        if (_rate >= BRONZE_RATE && _actions >= BRONZE_ACTIONS) return "Bronze";
        return "None";
    }

    function _getPrimaryLevel(string memory creatorLevel, string memory solverLevel) internal pure returns (string memory) {
        if (keccak256(abi.encodePacked(creatorLevel)) == keccak256(abi.encodePacked("Gold")) || keccak256(abi.encodePacked(solverLevel)) == keccak256(abi.encodePacked("Gold"))) return "Gold";
        if (keccak256(abi.encodePacked(creatorLevel)) == keccak256(abi.encodePacked("Silver")) || keccak256(abi.encodePacked(solverLevel)) == keccak256(abi.encodePacked("Silver"))) return "Silver";
        if (keccak256(abi.encodePacked(creatorLevel)) == keccak256(abi.encodePacked("Bronze")) || keccak256(abi.encodePacked(solverLevel)) == keccak256(abi.encodePacked("Bronze"))) return "Bronze";
        return "None";
    }

    function getUserReputation(address _user) external view returns (ReputationStats memory) {
        return reputations[_user];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0), "Soulbound: tokens are not transferable");
        return super._update(to, tokenId, auth);
    }
}
