# Technical Development and Application Technology.md

This file provides comprehensive, detailed guidance on the technical implementation, development tools, architecture, and technology stack for Quinty. It has been refined for clarity, depth, and completeness to serve as a blueprint for an AI-assisted build process. The documentation emphasizes modularity, extensibility, and best practices for a proof-of-concept (POC) that can be easily improved in the future (e.g., via proxy upgrades, additional modules, or off-chain integrations).

The primary focus areas are:

- **Escrow Management**: Trustless handling of funds with 100% locking in Somnia Testnet's native token (STT), timed releases, slashing (25-50% on expiry), and refunds. Extensible for ERC-20 or fee structures.
- **NFT-Based Reputation**: Soulbound ERC-721 NFTs with IPFS-hosted images and dynamic metadata for visual badges, tracking detailed metrics for creators and solvers. Utilities include reputation-gated features (e.g., discounts or access).
- **IPFS Integration**: Decentralized storage for blinded submissions, solution reveals, and NFT assets (images/metadata). On-chain storage of IPFS CIDs ensures immutability; frontend handles uploads.
- **Voting and Dispute System**: Community voting (-style "pengadilan") for expired bounties and post-resolution disputes. Voters stake ~0.0001 STT to vote on top submissions (rank 1-3). Rewards: True voters get 5% of bounty; top non-winner gets 10% if ranked high but not selected. For disputes: If community overturns winner, 80% refund to creator, 10% to true voters, 10% to solver.
- **Transparent Airdrop Tasks**: Separate contract for protocol promotion/airdrop bounties with verifiable social proofs (e.g., X posts via IPFS).

All development and testing target the **Somnia Testnet (chainId: 50312)** with native **STT** tokens. Staking for voting/disputes uses **0.0001 STT** to keep costs low, ensuring accessibility for POC.

**Narratives and Use Cases**:

- **Freelance Tasks**: Quinty supports task-based bounties (e.g., coding, design) with blinded submissions and community dispute resolution.
- **Transparent Protocol Promotion/Airdrops**: Creators escrow STT for promotion tasks (e.g., X posts). Solvers submit proofs (IPFS-hosted links/screenshots). First 100 valid entries (verified by community vote or future oracle for 100 likes/views) receive fixed rewards (e.g., 10 STT each), ensuring transparent distribution.

This setup assumes an EVM-compatible chain (Somnia Testnet). All code examples are in Solidity 0.8.28 for security and compatibility.

## Project Overview

Quinty is an on-chain task bounty built on the Somnia Testnet. It operates as a trustless platform where creators post bounties with 100% escrow in STT, solvers submit blinded solutions (via IPFS) to protect intellectual property, and disputes/expiries are resolved through decentralized voting ("pengadilan ") with staking (0.0001 STT). Users can act as "hakim" (judges) by staking to vote on top submissions, earning rewards for accurate votes. The project encompasses:

- **Backend/Smart Contracts**: Written in Solidity using Hardhat for development, testing, deployment, and verification. Contracts are modular for easy extension.
- **Frontend**: A Next.js application with Web3 integration for user interactions, voting, and IPFS uploads.
- **Key Innovations**:
  - Blinded submissions via IPFS CIDs.
  - Threaded communication (on-chain for POC).
  - Slashing (25-50% of bounty) on expiry, distributed via vote: 10% to top non-winner, 5% to true voters.
  - Dispute : Overturn winners with 80% creator refund, 10% voters, 10% solver.
  - NFT-based reputation with IPFS images/metadata.
  - Airdrop bounties: Transparent rewards for promotion tasks.
- **Extensibility Points**: Proxy patterns, interfaces, virtual functions for custom logic (e.g., oracle for X engagement).

## Development Commands

### Frontend (Next.js)

- **Development**: `npm run dev` - Starts the Next.js development server with hot-reloading.
- **Build**: `npm run build` - Compiles the application for production.
- **Production**: `npm start` - Launches the built application.
- **Linting**: `npm run lint` - Runs ESLint with Prettier.
- **Testing**: `npm run test` - Executes tests using Jest/Vitest. Install: `npm install --save-dev jest vitest @testing-library/react`.

### Smart Contracts (Hardhat)

Hardhat is used for all contract operations. Install: `npm init -y && npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox`. Run `npx hardhat` to initialize. Configure `hardhat.config.ts` with Somnia Testnet (chainId: 50312, RPC: https://testnet.somnia.network). Use TypeScript for scripts/tests.

- **Compile Contracts**: `npx hardhat compile` - Generates artifacts in `/artifacts/`.
- **Run Tests**: `npx hardhat test` - Executes tests from `/test/` using Mocha/Chai.
- **Run Tests with Gas Reports**: `npx hardhat test --gas-report` - Includes gas metrics (install `@nomiclabs/hardhat-gas-reporter`).
- **Deploy to Somnia Testnet**: `npx hardhat run scripts/deploy.ts --network somniaTestnet` - Deploys contracts; verify with `npx hardhat verify <address> --network somniaTestnet`.
- **Local Development**: `npx hardhat node` - Starts a local network (fork Somnia Testnet via `forking: { url: process.env.SOMNIA_TESTNET_RPC }`).
- **Console**: `npx hardhat console --network localhost` - Interactive REPL.
- **Verification**: Use Etherscan plugin (`@nomiclabs/hardhat-etherscan`) for source code verification.

Configure `hardhat.config.ts`:

```ts
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    somniaTestnet: {
      url: process.env.SOMNIA_TESTNET_RPC || "https://testnet.somnia.network",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 50312,
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }, // Adapt for Somnia explorer
};
```

## Architecture Overview

### Smart Contracts (`/contracts/`)

Contracts are organized in `/contracts/` with subfolders (e.g., `/core/`, `/reputation/`, `/dispute/`, `/airdrop/`). Solidity 0.8.28 with optimizer enabled. Key contracts:

- **Quinty.sol**: Core bounty and escrow management – 100% STT escrow, IPFS submissions, winner selection, expiry triggers voting.
- **DisputeResolver.sol**: Voting and court – 0.0001 STT stakes, ranks submissions, distributes slash/rewards.
- **QuintyReputation.sol**: ERC-721 NFT – soulbound, IPFS images/metadata.
- **AirdropBounty.sol**: Promotion/airdrop tasks – fixed STT rewards for qualifiers.

Dependencies: `npm install @openzeppelin/contracts`.

Key Features:

- **Escrow**: 100% STT locked; released on resolution; slashed to voting pool on expiry.
- **NFT**: Soulbound badges with IPFS URIs (e.g., "ipfs://<CID>/gold-creator.json" linking to badge.png).
- **IPFS**: CIDs for submissions/reveals/NFTs; frontend uploads via Pinata/web3-storage.
- **Voting/Dispute**: 0.0001 STT stake; expiry rewards (10% top, 5% voters); dispute refunds (80% creator, 10% voters, 10% solver).
- **Airdrop**: Fixed STT rewards for verified X posts (POC: manual vote).

For extensibility: Use `virtual` functions, proxies (via @openzeppelin/upgrades), interfaces.

### Frontend Architecture (`/src/`)

- **Framework**: Next.js 15 with React 19 and App Router.
- **Styling**: Tailwind CSS v3+ with ShadCN UI (add voting/airdrop components).
- **Web3**: Wagmi v2+ for hooks, RainbowKit for wallets.
- **State**: React hooks + Wagmi; Zustand for voting/airdrop state.
- **Fonts**: Playfair Display (headings), Inter (body).

Structure: Add `/components/voting/` ( interfaces), `/components/airdrop/` (X proof uploads).

### Web3 Integration

- **Network**: Somnia Testnet (chainId: 50312, RPC: https://testnet.somnia.network).
- **Wallets**: RainbowKit with `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- **Addresses**: In `/src/lib/contracts.ts` (update post-deploy):
  ```ts
  export const ADDRESSES = {
    Quinty: { 50312: "0x..." },
    Reputation: { 50312: "0x..." },
    Dispute: { 50312: "0x..." },
    Airdrop: { 50312: "0x..." },
  };
  ```
- **IPFS**: Use `ipfs-http-client` or Pinata SDK for uploads; store CIDs on-chain.
- **Events**: Wagmi `useContractEvent` for updates (e.g., DisputeInitiated).
- **NFT Display**: Query tokenURI, fetch IPFS JSON/image (e.g., badge.png).
- **Voting**: Forms for staking 0.0001 STT, ranking submissions.

## Development Guidelines

### Smart Contract Development

- Hardhat Setup: Scripts in `/scripts/`, tests in `/test/`.
- Solidity: Locked to 0.8.28; optimizer enabled.
- Modular: Inherit/interfaces; comment extension points.
- Events: For all mutations (e.g., `BountyCreated`, `VoteCast`).
- Gas: Immutables, packed structs.
- Security: ReentrancyGuard, checks-effects-interactions.
- IPFS: Store CIDs as strings; validate length.
- Voting: 0.0001 STT stake; extensible for ERC-20.
- Testing: 100% coverage; simulate STT stakes, votes, IPFS CIDs.

### Frontend Development

- TypeScript: Strict.
- UI: Responsive; add voting/airdrop dashboards.
- Web3: Wagmi only.
- IPFS: `web3-storage`: `const client = makeStorageClient(); const cid = await client.put(files);`.
- Airdrop: Forms for X proof uploads (links/screenshots).

### Key Integration Points

- Deploy order: Quinty → Reputation → DisputeResolver → AirdropBounty → Set addresses.
- Frontend: Wagmi for reads/writes; IPFS for uploads.
- Escrow: STT locked; transfers on resolve/vote.
- NFT: IPFS URI updates on level change.
- Voting: 0.0001 STT stake; reward splits.

### Environment Setup

- `.env`: SOMNIA_TESTNET_RPC, PRIVATE_KEY, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
- Hardhat: Config as above; testnet only.

### Testing Strategy

- Contracts: `npx hardhat test`; focus on escrow (STT flows), NFT (IPFS URIs), voting (stake/rewards), airdrops (proofs).
- Frontend: Jest for components.
- Integration: Hardhat local + frontend; mock IPFS CIDs.

## Architecture Notes

Quinty supports freelance tasks and transparent protocol promotion/airdrops. Flows:

- **Escrow**: Create (lock STT) → Submit (IPFS) → Resolve (release) → Expiry (slash to vote).
- **Voting (Expiry)**: Stake 0.0001 STT → Rank 1-3 → Top non-winner 10%, true voters 5%.
- **Dispute (Pengadilan )**: Stake → Vote to overturn → 80% creator, 10% voters, 10% solver if successful.
- **NFT**: Update metrics → Set IPFS image/metadata.
- **Airdrop**: Escrow STT → Submit X proofs (IPFS) → Verify first 100 → Distribute.

Modularity: Separate contracts for core/airdrop.

## Detailed Smart Contract Architecture and Code

### Requirements Overview

- **Escrow**: 100% STT lock; slash 25-50% to vote pool; extensible for fees.
- **NFT**: Soulbound; IPFS images (e.g., bronze-creator.png) and metadata.
- **IPFS**: CIDs for submissions/reveals/NFTs.
- **Voting/Dispute**: 0.0001 STT stake; reward splits as specified.
- **Airdrop**: Fixed STT rewards for verified X posts.
- **Environment**: Somnia Testnet; all in STT.

### Advanced Solidity Code

<xaiArtifact artifact_id="d44eabef-7e01-4c04-9a6c-deee6726283f" artifact_version_id="71098867-f7b5-4e3e-b6d8-f28cfc5468bc" title="Quinty.sol" contentType="text/solidity">
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Interfaces
interface IQuintyReputation {
function updateCreatorRep(address \_user, bool \_success) external;
function updateSolverRep(address \_user, bool \_success) external;
}

interface IDisputeResolver {
function initiateExpiryVote(uint256 \_bountyId, uint256 \_slashAmount) external;
function initiatePengadilanDispute(uint256 \_bountyId) external;
}

// 1. Core Escrow and Bounty Contract
contract Quinty is Ownable, ReentrancyGuard {
using SafeMath for uint256;
using Strings for uint256;

    struct Bounty {
        address creator;
        string description;
        uint256 amount; // STT escrowed
        uint256 deadline;
        bool allowMultipleWinners;
        uint256[] winnerShares; // Basis points, sum 10000
        bool resolved;
        uint256 slashPercent; // 2500-5000 bp
    }

    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCounter;
    address public reputationAddress;
    address public disputeAddress;

    event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount, uint256 deadline);
    event BountyResolved(uint256 indexed id, address[] winners, uint256[] amounts);
    event BountySlashed(uint256 indexed id, uint256 slashAmount);
    event WinnerSelected(uint256 indexed id, address[] winners);

    modifier onlyCreator(uint256 _id) { require(msg.sender == bounties[_id].creator, "Not creator"); _; }
    modifier notResolved(uint256 _id) { require(!bounties[_id].resolved, "Resolved"); _; }
    modifier afterDeadline(uint256 _id) { require(block.timestamp > bounties[_id].deadline, "Not expired"); _; }

    // Set contract addresses
    function setAddresses(address _repAddress, address _disputeAddress) external onlyOwner {
        reputationAddress = _repAddress;
        disputeAddress = _disputeAddress;
    }

    // Create: Lock 100% STT escrow
    function createBounty(
        string memory _description,
        uint256 _deadline,
        bool _allowMultipleWinners,
        uint256[] memory _winnerShares,
        uint256 _slashPercent
    ) external payable nonReentrant {
        require(msg.value > 0, "Escrow required");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash 25-50%");

        if (_allowMultipleWinners) {
            require(_winnerShares.length > 1, "Shares required");
            uint256 total = 0;
            for (uint i = 0; i < _winnerShares.length; i++) total = total.add(_winnerShares[i]);
            require(total == 10000, "Shares sum to 10000");
        } else {
            require(_winnerShares.length == 0, "No shares");
        }

        bountyCounter++;
        bounties[bountyCounter] = Bounty({
            creator: msg.sender,
            description: _description,
            amount: msg.value,
            deadline: _deadline,
            allowMultipleWinners: _allowMultipleWinners,
            winnerShares: _winnerShares,
            resolved: false,
            slashPercent: _slashPercent
        });
        emit BountyCreated(bountyCounter, msg.sender, msg.value, _deadline);
        _afterCreate(bountyCounter);

        IQuintyReputation(reputationAddress).updateCreatorRep(msg.sender, false);
    }

    // Resolve: Release STT to winners, update reps
    function selectWinners(uint256 _id, address[] memory _winners) external onlyCreator(_id) notResolved(_id) nonReentrant {
        Bounty storage bounty = bounties[_id];
        require(block.timestamp <= bounty.deadline, "Expired");
        require(_winners.length == (bounty.allowMultipleWinners ? bounty.winnerShares.length : 1), "Invalid winners");

        uint256[] memory amounts = new uint256[](_winners.length);
        for (uint i = 0; i < _winners.length; i++) {
            amounts[i] = bounty.allowMultipleWinners ? bounty.amount.mul(bounty.winnerShares[i]).div(10000) : bounty.amount;
            payable(_winners[i]).transfer(amounts[i]);
        }

        bounty.resolved = true;
        emit BountyResolved(_id, _winners, amounts);
        emit WinnerSelected(_id, _winners);
        _afterResolve(_id);

        IQuintyReputation(reputationAddress).updateCreatorRep(bounty.creator, true);
        for (uint i = 0; i < _winners.length; i++) {
            IQuintyReputation(reputationAddress).updateSolverRep(_winners[i], true);
        }
    }

    // Slash: Transfer to DisputeResolver for voting
    function triggerSlash(uint256 _id) external afterDeadline(_id) notResolved(_id) nonReentrant {
        Bounty storage bounty = bounties[_id];
        uint256 slashAmount = bounty.amount.mul(bounty.slashPercent).div(10000);
        payable(disputeAddress).transfer(slashAmount);
        payable(bounty.creator).transfer(bounty.amount.sub(slashAmount));
        bounty.resolved = true;
        emit BountySlashed(_id, slashAmount);
        IQuintyReputation(reputationAddress).updateCreatorRep(bounty.creator, false);
        IDisputeResolver(disputeAddress).initiateExpiryVote(_id, slashAmount);
    }

    // Extension hooks
    function _afterCreate(uint256 _id) internal virtual {}
    function _afterResolve(uint256 _id) internal virtual {}

}

// 2. Submissions with IPFS
contract QuintySubmissions is Quinty {
struct Submission {
uint256 bountyId;
address solver;
string blindedIpfsCid; // IPFS CID (e.g., Qm...)
uint256 deposit; // 10% STT
string[] replies;
string revealIpfsCid; // Revealed solution
}

    mapping(uint256 => Submission[]) public submissions;

    event SubmissionCreated(uint256 indexed bountyId, uint256 subId, address solver, string ipfsCid);
    event ReplyAdded(uint256 indexed bountyId, uint256 subId, address replier, string reply);
    event SolutionRevealed(uint256 indexed bountyId, uint256 subId, string revealIpfsCid);

    // Submit: 10% STT deposit, IPFS CID
    function submitSolution(uint256 _bountyId, string memory _blindedIpfsCid) external payable notResolved(_bountyId) nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp <= bounty.deadline, "Expired");
        require(msg.value == bounty.amount.div(10), "10% deposit");
        require(bytes(_blindedIpfsCid).length > 0, "Invalid CID");

        uint256 subId = submissions[_bountyId].length;
        submissions[_bountyId].push(Submission(_bountyId, msg.sender, _blindedIpfsCid, msg.value, new string[](0), ""));
        emit SubmissionCreated(_bountyId, subId, msg.sender, _blindedIpfsCid);

        IQuintyReputation(reputationAddress).updateSolverRep(msg.sender, false);
    }

    // Reply: Creator/solver communication
    function addReply(uint256 _bountyId, uint256 _subId, string memory _reply) external notResolved(_bountyId) {
        Submission storage sub = submissions[_bountyId][_subId];
        require(msg.sender == bounties[_bountyId].creator || msg.sender == sub.solver, "Unauthorized");
        require(bytes(_reply).length <= 500, "Reply too long");

        sub.replies.push(_reply);
        emit ReplyAdded(_bountyId, _subId, msg.sender, _reply);
    }

    // Reveal: Post-resolution IPFS CID
    function revealSolution(uint256 _bountyId, uint256 _subId, string memory _revealIpfsCid) external {
        Submission storage sub = submissions[_bountyId][_subId];
        require(msg.sender == sub.solver, "Not solver");
        require(bounties[_bountyId].resolved, "Not resolved");
        require(bytes(sub.revealIpfsCid).length == 0, "Revealed");
        require(bytes(_revealIpfsCid).length > 0, "Invalid CID");

        sub.revealIpfsCid = _revealIpfsCid;
        emit SolutionRevealed(_bountyId, _subId, _revealIpfsCid);
    }

    function refundDeposit(uint256 _bountyId, uint256 _subId) internal {
        Submission storage sub = submissions[_bountyId][_subId];
        if (sub.deposit > 0) {
            payable(sub.solver).transfer(sub.deposit);
            sub.deposit = 0;
        }
    }

}

// 3. Voting and Pengadilan
contract DisputeResolver is QuintySubmissions {
using SafeMath for uint256;

    struct Vote {
        address voter;
        uint256 stake; // 0.0001 STT
        uint256[] rankedSubIds; // 1-3 ranks
    }

    struct Dispute {
        uint256 bountyId;
        bool isExpiry; // Expiry vs pengadilan
        uint256 amount; // Slash or full bounty
        uint256 votingEnd;
        Vote[] votes;
        bool resolved;
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;
    uint256 public constant MIN_STAKE = 0.0001 ether; // 0.0001 STT
    uint256 public constant VOTING_DURATION = 3 days;

    event DisputeInitiated(uint256 indexed disputeId, uint256 bountyId, bool isExpiry);
    event VoteCast(uint256 indexed disputeId, address voter, uint256[] rankedSubIds);
    event DisputeResolved(uint256 indexed disputeId, uint256[] topRanks, uint256[] distributions);

    // Expiry vote: Distribute slash
    function initiateExpiryVote(uint256 _bountyId, uint256 _slashAmount) external {
        require(msg.sender == address(this) || msg.sender == owner(), "Unauthorized");
        disputeCounter++;
        uint256 disputeId = disputeCounter;
        disputes[disputeId] = Dispute(_bountyId, true, _slashAmount, block.timestamp + VOTING_DURATION, new Vote[](0), false);
        emit DisputeInitiated(disputeId, _bountyId, true);
    }

    // Pengadilan: Creator disputes winner
    function initiatePengadilanDispute(uint256 _bountyId) external onlyCreator(_bountyId) {
        require(bounties[_bountyId].resolved, "Not resolved");
        disputeCounter++;
        uint256 disputeId = disputeCounter;
        disputes[disputeId] = Dispute(_bountyId, false, bounties[_bountyId].amount, block.timestamp + VOTING_DURATION, new Vote[](0), false);
        emit DisputeInitiated(disputeId, _bountyId, false);
    }

    // Vote: Stake 0.0001 STT, rank 1-3
    function vote(uint256 _disputeId, uint256[] memory _rankedSubIds) external payable nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        require(!dispute.resolved && block.timestamp <= dispute.votingEnd, "Inactive");
        require(msg.value >= MIN_STAKE, "Min 0.0001 STT");
        require(_rankedSubIds.length == 3, "Rank 1-3");
        for (uint i = 0; i < 3; i++) {
            require(_rankedSubIds[i] < submissions[dispute.bountyId].length, "Invalid subId");
        }

        dispute.votes.push(Vote(msg.sender, msg.value, _rankedSubIds));
        emit VoteCast(_disputeId, msg.sender, _rankedSubIds);
    }

    // Resolve: Tally and distribute
    function resolveDispute(uint256 _disputeId) external nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        require(block.timestamp > dispute.votingEnd && !dispute.resolved, "Not resolvable");

        uint256[] memory topRanks = _tallyRanks(dispute.votes, dispute.bountyId);
        uint256[] memory distributions = new uint256[](topRanks.length);

        if (dispute.isExpiry) {
            // Expiry: 10% to top non-winner, 5% to true voters
            uint256 topReward = dispute.amount.div(10);
            // Assume topRanks[0] not winner (check via events); transfer to solver
            uint256 voterPool = dispute.amount.div(20);
            _distributeToTrueVoters(dispute.votes, topRanks, voterPool, distributions);
        } else {
            // Pengadilan: If overturn
            if (_shouldOverturn(dispute.votes)) {
                uint256 refund = dispute.amount.mul(80).div(100);
                payable(bounties[dispute.bountyId].creator).transfer(refund);
                uint256 voterPool = dispute.amount.div(10);
                uint256 solverKeep = dispute.amount.div(10);
                // Transfer solverKeep to original winner
                _distributeToTrueVoters(dispute.votes, topRanks, voterPool, distributions);
            }
        }

        dispute.resolved = true;
        emit DisputeResolved(_disputeId, topRanks, distributions);
        // Update reps based on outcome
    }

    // Placeholder tally (extend with weighted scoring)
    function _tallyRanks(Vote[] memory votes, uint256 bountyId) internal pure returns (uint256[] memory) {
        uint256[] memory ranks = new uint256[](3);
        // POC: Return dummy ranks; implement point-based ranking
        return ranks;
    }

    function _shouldOverturn(Vote[] memory votes) internal pure returns (bool) {
        // POC: Assume majority overturn
        return votes.length > 0; // Extend with logic
    }

    function _distributeToTrueVoters(Vote[] memory votes, uint256[] memory topRanks, uint256 pool, uint256[] memory distributions) internal {
        // Proportional to stake for voters matching topRanks
        // Transfer STT
    }

}

// 4. NFT Reputation with IPFS
contract QuintyReputation is ERC721URIStorage, Ownable {
using SafeMath for uint256;
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
    }

    mapping(address => Reputation) public reputations;
    uint256 private _tokenCounter;

    uint256 public constant BRONZE_RATE = 5000; uint256 public constant BRONZE_ACTIONS = 5;
    uint256 public constant SILVER_RATE = 8000; uint256 public constant SILVER_ACTIONS = 20;
    uint256 public constant GOLD_RATE = 9500; uint256 public constant GOLD_ACTIONS = 50;

    event ReputationUpdated(address indexed user, bool isCreator, bool success);
    event BadgeMintedOrUpgraded(address indexed user, uint256 tokenId, string level, string tokenURI);

    constructor() ERC721("QuintyReputation", "QREP") {}

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
        if (rep.firstBountyTimestamp == 0) rep.firstBountyTimestamp = block.timestamp;
        if (_success) rep.successfulBounties += 1;
        rep.creationSuccessRate = rep.bountiesCreated > 0 ? rep.successfulBounties.mul(10000).div(rep.bountiesCreated) : 0;

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
        rep.solveSuccessRate = rep.solvesAttempted > 0 ? rep.successfulSolves.mul(10000).div(rep.solvesAttempted) : 0;

        emit ReputationUpdated(_user, false, _success);
        _checkAndUpdateBadge(_user, false);
    }

    function _checkAndUpdateBadge(address _user, bool _isCreator) internal {
        Reputation storage rep = reputations[_user];
        uint256 rate = _isCreator ? rep.creationSuccessRate : rep.solveSuccessRate;
        uint256 actions = _isCreator ? rep.bountiesCreated : rep.solvesAttempted;
        string memory newLevel = "";

        if (rate >= GOLD_RATE && actions >= GOLD_ACTIONS) newLevel = "Gold";
        else if (rate >= SILVER_RATE && actions >= SILVER_ACTIONS) newLevel = "Silver";
        else if (rate >= BRONZE_RATE && actions >= BRONZE_ACTIONS) newLevel = "Bronze";
        else return;

        string memory uri = _generateIpfsUri(newLevel, _isCreator, rep);

        if (rep.tokenId == 0) {
            _tokenCounter++;
            rep.tokenId = _tokenCounter;
            _safeMint(_user, _tokenCounter);
            _setTokenURI(_tokenCounter, uri);
            rep.level = newLevel;
            emit BadgeMintedOrUpgraded(_user, _tokenCounter, newLevel, uri);
        } else if (keccak256(bytes(newLevel)) != keccak256(bytes(rep.level))) {
            _setTokenURI(rep.tokenId, uri);
            rep.level = newLevel;
            emit BadgeMintedOrUpgraded(_user, rep.tokenId, newLevel, uri);
        }
    }

    function _generateIpfsUri(string memory level, bool isCreator, Reputation memory rep) internal pure returns (string memory) {
        // POC: Placeholder CID; real: JSON with {"name": "Gold Creator", "image": "ipfs://<CID>/gold-creator.png", "attributes": [...]}
        string memory baseIpfs = "ipfs://QmExampleCid/";
        string memory role = isCreator ? "Creator" : "Solver";
        return string(abi.encodePacked(baseIpfs, level, "-", role, ".json"));
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        require(from == address(0), "Soulbound");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

}

// 5. Transparent Airdrop Task Contract
contract AirdropBounty is Ownable, ReentrancyGuard {
using SafeMath for uint256;

    struct Airdrop {
        address creator;
        uint256 totalAmount; // STT escrowed
        uint256 perQualifier; // e.g., 10 STT
        uint256 maxQualifiers; // e.g., 100
        uint256 qualifiersCount;
        uint256 deadline;
        bool resolved;
    }

    struct Entry {
        address solver;
        string ipfsProofCid; // X post link/screenshot
        bool qualified;
    }

    mapping(uint256 => Airdrop) public airdrops;
    mapping(uint256 => Entry[]) public entries;
    uint256 public airdropCounter;

    event AirdropCreated(uint256 indexed id, address creator, uint256 perQualifier, uint256 maxQualifiers);
    event EntrySubmitted(uint256 indexed id, address solver, string ipfsProofCid);
    event QualifiedAndDistributed(uint256 indexed id, address[] qualifiers);

    // Create: Escrow STT for fixed rewards
    function createAirdrop(
        uint256 _perQualifier,
        uint256 _maxQualifiers,
        uint256 _deadline
    ) external payable nonReentrant {
        require(msg.value == _perQualifier.mul(_maxQualifiers), "Escrow full");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_maxQualifiers > 0, "Invalid qualifiers");

        airdropCounter++;
        airdrops[airdropCounter] = Airdrop(msg.sender, msg.value, _perQualifier, _maxQualifiers, 0, _deadline, false);
        emit AirdropCreated(airdropCounter, msg.sender, _perQualifier, _maxQualifiers);
    }

    // Submit: X post proof via IPFS
    function submitEntry(uint256 _id, string memory _ipfsProofCid) external nonReentrant {
        Airdrop storage airdrop = airdrops[_id];
        require(block.timestamp <= airdrop.deadline && !airdrop.resolved, "Inactive");
        require(bytes(_ipfsProofCid).length > 0, "Invalid proof");

        entries[_id].push(Entry(msg.sender, _ipfsProofCid, false));
        emit EntrySubmitted(_id, msg.sender, _ipfsProofCid);
    }

    // Verify: POC manual; future oracle/vote
    function verifyAndDistribute(uint256 _id, uint256[] memory _qualifiedIndices) external onlyOwner nonReentrant {
        Airdrop storage airdrop = airdrops[_id];
        require(!airdrop.resolved, "Resolved");
        require(_qualifiedIndices.length <= airdrop.maxQualifiers, "Too many");

        address[] memory qualifiers = new address[](_qualifiedIndices.length);
        for (uint i = 0; i < _qualifiedIndices.length; i++) {
            uint256 idx = _qualifiedIndices[i];
            Entry storage entry = entries[_id][idx];
            require(!entry.qualified, "Already qualified");
            entry.qualified = true;
            qualifiers[i] = entry.solver;
            payable(entry.solver).transfer(airdrop.perQualifier);
        }

        airdrop.qualifiersCount = _qualifiedIndices.length;
        airdrop.resolved = true;
        emit QualifiedAndDistributed(_id, qualifiers);
    }

}
</xaiArtifact>

### Integration Notes

- **Deploy Script** (`scripts/deploy.ts`):

```ts
async function main() {
  const [deployer] = await ethers.getSigners();
  const Quinty = await ethers.getContractFactory("Quinty");
  const quinty = await Quinty.deploy();
  await quinty.deployed();

  const Reputation = await ethers.getContractFactory("QuintyReputation");
  const reputation = await Reputation.deploy();
  await reputation.deployed();

  const Dispute = await ethers.getContractFactory("DisputeResolver");
  const dispute = await Dispute.deploy();
  await dispute.deployed();

  const Airdrop = await ethers.getContractFactory("AirdropBounty");
  const airdrop = await Airdrop.deploy();
  await airdrop.deployed();

  await quinty.setAddresses(reputation.address, dispute.address);
  console.log(
    "Quinty:",
    quinty.address,
    "Reputation:",
    reputation.address,
    "Dispute:",
    dispute.address,
    "Airdrop:",
    airdrop.address
  );
}

main();
```

- **Frontend**: Use Wagmi to call functions; Pinata for IPFS uploads.
- **Testing**: Deploy to Somnia Testnet; use STT for stakes (0.0001 STT).
- **Extension**: Add oracle for X likes/views; UUPS proxy for upgrades.

## Tech Stack

- **Blockchain**: Somnia Testnet (EVM, STT).
- **Contracts**: Hardhat + Solidity.
- **Frontend**: Next.js + Wagmi.
- **Storage**: IPFS (CIDs on-chain).
- **Testing**: Hardhat/Mocha.
- **Security**: OpenZeppelin patterns. Test thoroughly on testnet.
