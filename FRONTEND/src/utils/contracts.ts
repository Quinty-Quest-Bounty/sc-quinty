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
  {
    "type": "function",
    "name": "vote",
    "inputs": [
      { "name": "_disputeId", "type": "uint256" },
      { "name": "_rankedSubIds", "type": "uint256[]" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "resolveDispute",
    "inputs": [{ "name": "_disputeId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initiatePengadilanDispute",
    "inputs": [{ "name": "_bountyId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getDispute",
    "inputs": [{ "name": "_disputeId", "type": "uint256" }],
    "outputs": [
      {
        "type": "tuple",
        "components": [
          { "name": "bountyId", "type": "uint256" },
          { "name": "isExpiry", "type": "bool" },
          { "name": "amount", "type": "uint256" },
          { "name": "votingEnd", "type": "uint256" },
          { "name": "resolved", "type": "bool" },
          { "name": "voteCount", "type": "uint256" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVote",
    "inputs": [
      { "name": "_disputeId", "type": "uint256" },
      { "name": "_voteIndex", "type": "uint256" }
    ],
    "outputs": [
      {
        "type": "tuple",
        "components": [
          { "name": "voter", "type": "address" },
          { "name": "stake", "type": "uint256" },
          { "name": "rankedSubIds", "type": "uint256[]" },
          { "name": "timestamp", "type": "uint256" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasVoted",
    "inputs": [
        { "name": "_disputeId", "type": "uint256" },
        { "name": "_voter", "type": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "disputeCounter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "DisputeInitiated",
    "inputs": [
      { "name": "disputeId", "type": "uint256", "indexed": true },
      { "name": "bountyId", "type": "uint256", "indexed": false },
      { "name": "isExpiry", "type": "bool", "indexed": false },
      { "name": "amount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VoteCast",
    "inputs": [
      { "name": "disputeId", "type": "uint256", "indexed": true },
      { "name": "voter", "type": "address", "indexed": false },
      { "name": "rankedSubIds", "type": "uint256[]", "indexed": false },
      { "name": "stake", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DisputeResolved",
    "inputs": [
      { "name": "disputeId", "type": "uint256", "indexed": true },
      { "name": "topRanks", "type": "uint256[]", "indexed": false },
      { "name": "distributions", "type": "uint256[]", "indexed": false }
    ],
    "anonymous": false
  }
];

export const REPUTATION_ABI = [
  {
    "type": "function",
    "name": "getUserReputation",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [
      {
        "type": "tuple",
        "components": [
          { "name": "bountiesCreated", "type": "uint256" },
          { "name": "successfulBounties", "type": "uint256" },
          { "name": "creationSuccessRate", "type": "uint256" },
          { "name": "firstBountyTimestamp", "type": "uint256" },
          { "name": "solvesAttempted", "type": "uint256" },
          { "name": "successfulSolves", "type": "uint256" },
          { "name": "solveSuccessRate", "type": "uint256" },
          { "name": "totalSolvedCount", "type": "uint256" },
          { "name": "tokenId", "type": "uint256" },
          { "name": "level", "type": "string" },
          { "name": "hasCreatorBadge", "type": "bool" },
          { "name": "hasSolverBadge", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCreatorStats",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [
        { "name": "created", "type": "uint256" },
        { "name": "successful", "type": "uint256" },
        { "name": "rate", "type": "uint256" },
        { "name": "activeSince", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSolverStats",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [
        { "name": "attempted", "type": "uint256" },
        { "name": "successful", "type": "uint256" },
        { "name": "rate", "type": "uint256" },
        { "name": "totalSolved", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBadgeLevel",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [{ "name": "", "type": "string" }],
    "stateMutability": "view"
  },
    {
    "type": "function",
    "name": "hasBadge",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTokenIdForUser",
    "inputs": [{ "name": "_user", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalSupply",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tokenURI",
    "inputs": [{ "name": "tokenId", "type": "uint256" }],
    "outputs": [{ "name": "", "type": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "name": "owner", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ReputationUpdated",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "isCreator", "type": "bool", "indexed": false },
      { "name": "success", "type": "bool", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BadgeMintedOrUpgraded",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "tokenId", "type": "uint256", "indexed": false },
      { "name": "level", "type": "string", "indexed": false },
      { "name": "tokenURI", "type": "string", "indexed": false }
    ],
    "anonymous": false
  }
];

export const AIRDROP_ABI = [
  {
    "type": "function",
    "name": "createAirdrop",
    "inputs": [
      { "name": "_title", "type": "string", "internalType": "string" },
      { "name": "_description", "type": "string", "internalType": "string" },
      { "name": "_perQualifier", "type": "uint256", "internalType": "uint256" },
      { "name": "_maxQualifiers", "type": "uint256", "internalType": "uint256" },
      { "name": "_deadline", "type": "uint256", "internalType": "uint256" },
      { "name": "_requirements", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "submitEntry",
    "inputs": [
      { "name": "_id", "type": "uint256", "internalType": "uint256" },
      { "name": "_ipfsProofCid", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifyEntry",
    "inputs": [
      { "name": "_airdropId", "type": "uint256", "internalType": "uint256" },
      { "name": "_entryId", "type": "uint256", "internalType": "uint256" },
      { "name": "_status", "type": "uint8", "internalType": "enum AirdropBounty.VerificationStatus" },
      { "name": "_feedback", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifyMultipleEntries",
    "inputs": [
      { "name": "_airdropId", "type": "uint256", "internalType": "uint256" },
      { "name": "_entryIds", "type": "uint256[]", "internalType": "uint256[]" },
      { "name": "_statuses", "type": "uint8[]", "internalType": "enum AirdropBounty.VerificationStatus[]" },
      { "name": "_feedbacks", "type": "string[]", "internalType": "string[]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "finalizeAirdrop",
    "inputs": [{ "name": "_id", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelAirdrop",
    "inputs": [{ "name": "_id", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAirdrop",
    "inputs": [{ "name": "_id", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      { "name": "creator", "type": "address", "internalType": "address" },
      { "name": "title", "type": "string", "internalType": "string" },
      { "name": "description", "type": "string", "internalType": "string" },
      { "name": "totalAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "perQualifier", "type": "uint256", "internalType": "uint256" },
      { "name": "maxQualifiers", "type": "uint256", "internalType": "uint256" },
      { "name": "qualifiersCount", "type": "uint256", "internalType": "uint256" },
      { "name": "deadline", "type": "uint256", "internalType": "uint256" },
      { "name": "createdAt", "type": "uint256", "internalType": "uint256" },
      { "name": "resolved", "type": "bool", "internalType": "bool" },
      { "name": "cancelled", "type": "bool", "internalType": "bool" },
      { "name": "requirements", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntry",
    "inputs": [
      { "name": "_airdropId", "type": "uint256", "internalType": "uint256" },
      { "name": "_entryId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "solver", "type": "address", "internalType": "address" },
      { "name": "ipfsProofCid", "type": "string", "internalType": "string" },
      { "name": "timestamp", "type": "uint256", "internalType": "uint256" },
      { "name": "status", "type": "uint8", "internalType": "enum AirdropBounty.VerificationStatus" },
      { "name": "feedback", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAirdropStats",
    "inputs": [{ "name": "_airdropId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      { "name": "totalEntries", "type": "uint256", "internalType": "uint256" },
      { "name": "pendingEntries", "type": "uint256", "internalType": "uint256" },
      { "name": "approvedEntries", "type": "uint256", "internalType": "uint256" },
      { "name": "rejectedEntries", "type": "uint256", "internalType": "uint256" },
      { "name": "remainingSlots", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserSubmission",
    "inputs": [
      { "name": "_airdropId", "type": "uint256", "internalType": "uint256" },
      { "name": "_user", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "hasSubmittedEntry", "type": "bool", "internalType": "bool" },
      { "name": "submissionIndex", "type": "uint256", "internalType": "uint256" },
      { "name": "status", "type": "uint8", "internalType": "enum AirdropBounty.VerificationStatus" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addVerifier",
    "inputs": [{ "name": "_verifier", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeVerifier",
    "inputs": [{ "name": "_verifier", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isVerifier",
    "inputs": [{ "name": "_address", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntryCount",
    "inputs": [{ "name": "_id", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "airdropCounter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AirdropCreated",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "creator", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "title", "type": "string", "indexed": false, "internalType": "string" },
      { "name": "perQualifier", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "maxQualifiers", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "deadline", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EntrySubmitted",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "solver", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "ipfsProofCid", "type": "string", "indexed": false, "internalType": "string" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EntryVerified",
    "inputs": [
      { "name": "airdropId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "entryId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "verifier", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "status", "type": "uint8", "indexed": false, "internalType": "enum AirdropBounty.VerificationStatus" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AirdropCancelled",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "refundAmount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "QualifiedAndDistributed",
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "qualifiers", "type": "address[]", "indexed": false, "internalType": "address[]" },
      { "name": "totalDistributed", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
];

// Constants
export const MIN_VOTING_STAKE = "0.0001"; // 0.0001 STT
export const SUBMISSION_DEPOSIT_PERCENT = 10; // 10% of bounty amount