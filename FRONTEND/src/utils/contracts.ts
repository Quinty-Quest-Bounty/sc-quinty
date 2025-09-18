// Contract addresses and ABIs
export const SOMNIA_TESTNET_ID = 50312;

export const CONTRACT_ADDRESSES = {
  [SOMNIA_TESTNET_ID]: {
    Quinty: "0x76FD733c7134BCeC5C1f80F1751E8Ac8b4a3DC0f",
    QuintyReputation: "0x43FED42239B2121e5e0fABdE3E99cf530CC3c4cC",
    DisputeResolver: "0xDc691A0c6a107AE7cf59F8c53A7B0f4f33427C75",
    AirdropBounty: "0xB265400F901Be063F00bF9BA62F5847200E26F94"
  }
};

// Simplified ABIs for frontend use
export const QUINTY_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "addReply",
    "inputs": [
      {
        "name": "_bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_subId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_reply",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "bounties",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "creator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "allowMultipleWinners",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "resolved",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "slashPercent",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "slashed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bountyCounter",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createBounty",
    "inputs": [
      {
        "name": "_description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_allowMultipleWinners",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "_winnerShares",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "_slashPercent",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "disputeAddress",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBounty",
    "inputs": [
      {
        "name": "_id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "creator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "allowMultipleWinners",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "winnerShares",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "resolved",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "slashPercent",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "winners",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "slashed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSubmission",
    "inputs": [
      {
        "name": "_bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_subId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "blindedIpfsCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "deposit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "replies",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "revealIpfsCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSubmissionCount",
    "inputs": [
      {
        "name": "_bountyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reputationAddress",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "revealSolution",
    "inputs": [
      {
        "name": "_bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_subId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_revealIpfsCid",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "selectWinners",
    "inputs": [
      {
        "name": "_id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_winners",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "_submissionIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setAddresses",
    "inputs": [
      {
        "name": "_repAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_disputeAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submissions",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "blindedIpfsCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "deposit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "revealIpfsCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitSolution",
    "inputs": [
      {
        "name": "_bountyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_blindedIpfsCid",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "triggerSlash",
    "inputs": [
      {
        "name": "_id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "BountyCreated",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BountyResolved",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "winners",
        "type": "address[]",
        "indexed": false,
        "internalType": "address[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BountySlashed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "slashAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReplyAdded",
    "inputs": [
      {
        "name": "bountyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "subId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "replier",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "reply",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SolutionRevealed",
    "inputs": [
      {
        "name": "bountyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "subId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "revealIpfsCid",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubmissionCreated",
    "inputs": [
      {
        "name": "bountyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "subId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "solver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "ipfsCid",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WinnerSelected",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "winners",
        "type": "address[]",
        "indexed": false,
        "internalType": "address[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  }
];

export const DISPUTE_ABI = [
  "function vote(uint256 _disputeId, uint256[] memory _rankedSubIds) external payable",
  "function resolveDispute(uint256 _disputeId) external",
  "function initiatePengadilanDispute(uint256 _bountyId) external",
  "function getDispute(uint256 _disputeId) external view returns (tuple(uint256 bountyId, bool isExpiry, uint256 amount, uint256 votingEnd, uint256 voteCount, bool resolved))",
  "function getVote(uint256 _disputeId, uint256 _voteIndex) external view returns (tuple(address voter, uint256 stake, uint256[] rankedSubIds))",
  "function disputeCounter() external view returns (uint256)",
  "event DisputeInitiated(uint256 indexed disputeId, uint256 bountyId, bool isExpiry, uint256 amount)",
  "event VoteCast(uint256 indexed disputeId, address voter, uint256[] rankedSubIds, uint256 stake)",
  "event DisputeResolved(uint256 indexed disputeId, uint256[] topRanks, uint256[] distributions)"
];

export const REPUTATION_ABI = [
  "function getUserReputation(address _user) external view returns (tuple(uint256 bountiesCreated, uint256 successfulBounties, uint256 creationSuccessRate, uint256 firstBountyTimestamp, uint256 solvesAttempted, uint256 successfulSolves, uint256 solveSuccessRate, uint256 totalSolvedCount, uint256 tokenId, string level))",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function balanceOf(address owner) external view returns (uint256)",
  "event ReputationUpdated(address indexed user, bool isCreator, bool success)",
  "event BadgeMintedOrUpgraded(address indexed user, uint256 tokenId, string level, string tokenURI)"
];

export const AIRDROP_ABI = [
  "function createAirdrop(uint256 _perQualifier, uint256 _maxQualifiers, uint256 _deadline) external payable",
  "function submitEntry(uint256 _id, string memory _ipfsProofCid) external",
  "function verifyAndDistribute(uint256 _id, uint256[] memory _qualifiedIndices) external",
  "function cancelAirdrop(uint256 _id) external",
  "function finalizeAirdrop(uint256 _id) external",
  "function getAirdrop(uint256 _id) external view returns (tuple(address creator, uint256 totalAmount, uint256 perQualifier, uint256 maxQualifiers, uint256 qualifiersCount, uint256 deadline, bool resolved, bool cancelled))",
  "function getEntry(uint256 _id, uint256 _entryIndex) external view returns (tuple(address solver, string ipfsProofCid, bool qualified, bool verified))",
  "function getEntryCount(uint256 _id) external view returns (uint256)",
  "function airdropCounter() external view returns (uint256)",
  "event AirdropCreated(uint256 indexed id, address creator, uint256 perQualifier, uint256 maxQualifiers)",
  "event EntrySubmitted(uint256 indexed id, address solver, string ipfsProofCid)",
  "event QualifiedAndDistributed(uint256 indexed id, address[] qualifiers)"
];

// Constants
export const MIN_VOTING_STAKE = "0.0001"; // 0.0001 STT
export const SUBMISSION_DEPOSIT_PERCENT = 10; // 10% of bounty amount