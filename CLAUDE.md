# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quinty V2** is a comprehensive on-chain task bounty and funding ecosystem built for the Base network. It combines multiple funding models (bounties, grants, crowdfunding, VC funding) with a reputation system and soulbound NFT badges to create a complete decentralized work platform.

## Commands

### Smart Contract Development

- **Compile**: `npx hardhat compile` - Compiles all 9 contracts with IR optimization
- **Test**: `npx hardhat test` - Runs comprehensive test suite (68 tests)
- **Deploy locally**: `npx hardhat run scripts/deploy.ts --network hardhat`
- **Deploy to Base Sepolia**: `npx hardhat run scripts/deploy.ts --network baseSepolia`
- **Deploy to Base Mainnet**: `npx hardhat run scripts/deploy.ts --network baseMainnet`
- **Console**: `npx hardhat console --network baseSepolia` - Interactive REPL for testing

### Testing Commands

- **Full test suite**: `npx hardhat test` - Runs all 68 tests across 9 test files
- **Single test file**: `npx hardhat test test/Quinty.test.ts`
- **Individual contract tests**:
  - `npx hardhat test test/Quinty.test.ts` - Core bounty (21 tests)
  - `npx hardhat test test/QuintyOprec.test.ts` - Oprec & teams (9 tests)
  - `npx hardhat test test/AirdropBounty.test.ts` - Airdrops (26 tests)
  - `npx hardhat test test/QuintyNFT.test.ts` - Soulbound NFTs
  - `npx hardhat test test/GrantProgram.test.ts` - Grant programs
  - `npx hardhat test test/Crowdfunding.test.ts` - Crowdfunding
  - `npx hardhat test test/LookingForGrant.test.ts` - VC funding

## Architecture Overview

Quinty V2 is a comprehensive decentralized work and funding platform built on the Base network with a **Registry/Factory pattern infrastructure** managing nine core smart contracts.

## 🎯 Registry/Factory Pattern (NEW!)

Quinty implements a production-ready Registry/Factory pattern inspired by Aave's AddressProvider, Synthetix's AddressResolver, and Uniswap's Factory.

### Infrastructure Contracts (4 Files)

#### **QuintyRegistry.sol** - Central Contract Registry
**Purpose**: Single source of truth for all protocol contract addresses with versioning

**Features**:
- **Contract Versioning**: Tracks all versions of each contract type
- **Auto-Deprecation**: Automatically deprecates old versions when new ones registered
- **Emergency Pause**: Protocol-wide pause functionality (Pausable)
- **Role-Based Access**: DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE
- **Batch Operations**: Register multiple contracts in one transaction
- **Event Tracking**: All registrations and deprecations emit events

**Contract Types Supported** (9 types):
```solidity
bytes32 public constant QUINTY = keccak256("QUINTY");
bytes32 public constant QUINTY_REPUTATION = keccak256("QUINTY_REPUTATION");
bytes32 public constant QUINTY_NFT = keccak256("QUINTY_NFT");
bytes32 public constant DISPUTE_RESOLVER = keccak256("DISPUTE_RESOLVER");
bytes32 public constant GRANT_PROGRAM = keccak256("GRANT_PROGRAM");
bytes32 public constant CROWDFUNDING = keccak256("CROWDFUNDING");
bytes32 public constant LOOKING_FOR_GRANT = keccak256("LOOKING_FOR_GRANT");
bytes32 public constant AIRDROP_BOUNTY = keccak256("AIRDROP_BOUNTY");
bytes32 public constant SOCIAL_VERIFICATION = keccak256("SOCIAL_VERIFICATION");
```

**Key Functions**:
- `getContract(contractType)` - Get latest active contract address
- `getAllContracts()` - Get all 9 contract addresses in one call
- `registerContract(type, address)` - Register new version (auto-deprecates old)
- `batchRegisterContracts(types[], addresses[])` - Batch registration
- `deprecateContract(type, version)` - Manually deprecate a version
- `setPaused(bool)` - Emergency pause/unpause

**Lines of Code**: 365 lines

#### **QuintyFactory.sol** - Automated Deployment Factory
**Purpose**: Deploy and auto-register all protocol contracts

**Features**:
- **Individual Deployment Functions**: deployQuinty(), deployGrantProgram(), etc.
- **Full Ecosystem Deployment**: deployFullEcosystem() - deploy all 9 contracts in one transaction
- **Auto-Registration**: All deployments automatically registered in QuintyRegistry
- **Setup Helpers**: setupCoreConnections(), setupFundingConnections()
- **Event Emission**: ContractDeployed, EcosystemDeployed events

**Key Functions**:
- `deployQuinty()` - Deploy and register Quinty contract
- `deployFullEcosystem(reputationURI, nftURI)` - Deploy entire ecosystem
- `setupCoreConnections()` - Configure Quinty, Reputation, DisputeResolver, NFT
- `setupFundingConnections()` - Configure GrantProgram, Crowdfunding, LookingForGrant

**Lines of Code**: 384 lines

#### **IQuintyRegistry.sol** - Registry Interface
**Purpose**: Interface definition for QuintyRegistry

**Defines**:
- ContractInfo struct (address, version, isActive, deployedAt, deprecatedAt)
- All registry function signatures
- Events: ContractRegistered, ContractDeprecated, ProtocolPaused

**Lines of Code**: 143 lines

#### **IQuintyNFT.sol** - Shared NFT Interface
**Purpose**: Common interface used by multiple contracts to mint badges

**Functions**:
- `mintBadge(recipient, badgeType, metadataURI)` - Mint single badge
- `batchMintBadges(recipients[], badgeType, metadataURI)` - Batch mint

**Used By**: Quinty, GrantProgram, Crowdfunding, LookingForGrant

**Lines of Code**: 27 lines

### Benefits of Registry/Factory Pattern

✅ **Frontend Simplification**:
```javascript
// Before: Hardcode 9 addresses
const quinty = new Contract("0x123...", abi);

// After: Query registry for all addresses
const addresses = await registry.getAllContracts();
const quinty = new Contract(addresses[0], abi); // Always latest version
```

✅ **Seamless Upgrades**:
```solidity
// Deploy new version
await factory.deployQuinty(); // Auto-registers as v2, deprecates v1

// Frontend automatically uses v2 (no code changes needed!)
```

✅ **Version Tracking**:
```solidity
// Get specific version
address quintyV1 = await registry.getContractByVersion(QUINTY, 1);
address quintyV2 = await registry.getContract(QUINTY); // Latest

// Get version info
ContractInfo memory info = await registry.getContractInfo(QUINTY);
// info.version = 2, info.isActive = true, info.deployedAt = timestamp
```

✅ **Emergency Controls**:
```solidity
// Pause entire protocol
await registry.setPaused(true);

// Check if paused
bool paused = await registry.isPaused();
```

### Documentation

- **UPGRADE_GUIDE.md** - Complete upgrade procedures (400+ lines)
- **REGISTRY_FACTORY_IMPLEMENTATION.md** - Implementation summary (complete analysis)

### Core Contract System (9 Contracts)

#### 1. **Quinty.sol** - Main Bounty Contract
**Purpose**: Core bounty creation and management with 100% ETH escrow

**Key Features**:
- **100% ETH Escrow**: All bounties require full upfront payment in native ETH
- **Tracked IPFS Submissions**: Submissions are permanently recorded on-chain; submitters cannot change CIDs; winners reveal detailed solutions after selection
- **Team Submissions**: Support for team-based work with automatic equal reward splitting
- **Multiple Winners**: Customizable winner shares using basis points (must sum to 10000)
- **Automatic Slashing**: 25-50% slash on expired bounties, funds go to DisputeResolver
- **Communication System**: Creator and solvers can reply to submissions
- **Oprec (Open Recruitment)**: Optional pre-bounty application phase for curated participants

**Oprec (Open Recruitment) System**:
- Creators can enable an optional application phase before the bounty opens
- Applicants submit portfolios (IPFS CIDs) and skill descriptions
- Support for both solo and team applications (up to 10 members)
- Creator approves/rejects applications before opening the bounty to submissions
- Only approved participants can submit solutions if oprec is enabled

**Team Submission Flow**:
- Leader submits solution with array of team member addresses
- Rewards split equally among leader + all team members
- Deposits also split equally among all team members
- All team members get reputation updates and Team Member NFT badges

**State Machine**: OPREC → OPEN → PENDING_REVEAL → RESOLVED/EXPIRED/DISPUTED

**Interfaces**: IQuintyReputation, IDisputeResolver, IQuintyNFT

#### 2. **QuintyReputation.sol** - Achievement-Based Reputation
**Purpose**: Soulbound ERC-721 NFTs tracking user achievements and seasonal leaderboards

**Achievement System**:
- **Solver Milestones**: 1, 10, 25, 50, 100 submissions
- **Winner Milestones**: 1, 10, 25, 50, 100 wins
- **Creator Milestones**: 1, 10, 25, 50, 100 bounties created
- **Season Winners**: Monthly top solver and top creator

**Features**:
- **User Stats Tracking**: Submissions, wins, bounties created, first/last activity
- **Monthly Seasons**: 30-day seasons with automatic rollover
- **Dynamic NFT Metadata**: Custom IPFS images and on-chain SVG generation
- **Rarity Tiers**: Common (1), Uncommon (10), Rare (25), Epic (50), Legendary (100)
- **Soulbound Tokens**: Non-transferable achievement NFTs

**Ownership**: Transferred to Quinty contract after deployment to allow automated reputation updates

#### 3. **DisputeResolver.sol** - Community Voting System
**Purpose**: Voting system for expired bounty disputes and court (pengadilan) disputes

**Features**:
- **Minimum Stake**: 0.0001 ETH for accessibility
- **Weighted Voting**: Stake amount × rank position determines winners
- **Ranked Voting**: Voters rank exactly 3 submissions in order of preference
- **Reward Distribution**: 10% to top-ranked non-winner, 5% to correct voters
- **Expiry Votes**: Triggered when bounties expire and get slashed
- **Pengadilan (Court) Disputes**: Creator-initiated disputes for resolved bounties

**Status**: Currently marked as "coming soon" in tests

#### 4. **QuintyNFT.sol** - Soulbound Badge System
**Purpose**: Non-transferable NFT badges for ecosystem participation

**Badge Types** (7 total):
- **0: BountyCreator** - Minted when creating bounties
- **1: BountySolver** - For bounty participation
- **2: TeamMember** - For team-based bounty wins
- **3: GrantGiver** - For creating grant programs
- **4: GrantRecipient** - For receiving grants
- **5: CrowdfundingDonor** - For contributing to campaigns
- **6: LookingForGrantSupporter** - For VC/investor support

**Features**:
- **Soulbound**: Cannot be transferred or approved (only mint/burn)
- **Authorization System**: Only authorized contracts can mint badges
- **Custom Metadata**: Each badge has unique IPFS metadata URI
- **Query Functions**: Get user badges, check badge ownership, count by type

**Security**: Overrides _update(), approve(), and setApprovalForAll() to enforce soulbound behavior

#### 5. **AirdropBounty.sol** - Promotion Task Rewards
**Purpose**: Fixed-reward promotion tasks with social proof verification

**Features**:
- **Fixed Rewards**: perQualifier × maxQualifiers must be escrowed upfront
- **Social Proof**: Submissions include IPFS CIDs with social media proof
- **Verifier System**: Authorized verifiers approve/reject entries
- **Auto-Finalization**: Distributes rewards when max qualifiers reached
- **Batch Verification**: Verifiers can process up to 50 entries at once
- **Cancellation**: Creator can cancel if no approvals exist yet

**Use Cases**: X/Twitter campaigns, social media promotions, community engagement tasks

#### 6. **GrantProgram.sol** - Institutional Grant Distribution
**Purpose**: Organizations distribute funds to selected applicants

**Features**:
- **Application-Based**: Users apply with project details and social proof
- **Selective Approval**: Grant givers choose recipients and custom amounts
- **Flexible Amounts**: Each recipient can receive different amounts
- **Claim-Based Distribution**: Recipients claim funds after approval
- **Grant Lifecycle**: Open → SelectionPhase → Active → Completed/Cancelled
- **Progress Updates**: Both giver and recipients can post updates
- **NFT Badges**: GrantGiver and GrantRecipient badges automatically minted

**Security**: Can only cancel before finalization, requires arrays match for approval

#### 7. **LookingForGrant.sol** - VC/Investor Funding Platform
**Purpose**: Projects seek funding from VCs and investors

**Features**:
- **Flexible Contributions**: No all-or-nothing, anytime withdrawal
- **No Deadlines Required**: Optional deadline field (can be 0)
- **Project Updates**: Requesters can update project details and progress
- **Progress Tracking**: IPFS CIDs for project status and achievements
- **Offering Details**: IPFS CID describing what's offered (tokens, equity, etc.)
- **Auto-Funding**: Marks as funded when goal reached
- **Supporter Tracking**: Track all supporters and contribution amounts

**Difference from Crowdfunding**: No refund mechanism, creator can withdraw anytime

#### 8. **Crowdfunding.sol** - All-or-Nothing Campaigns
**Purpose**: All-or-nothing crowdfunding with milestone-based fund release

**Features**:
- **All-or-Nothing**: Full refund if goal not reached by deadline
- **Milestone-Based**: Funds released sequentially by milestone
- **Sequential Release**: Must release milestones in order
- **Auto-Success**: Marked successful when goal reached
- **Refund System**: Donors claim refunds for failed campaigns
- **Progress Updates**: Creators post project updates
- **NFT Badges**: CrowdfundingDonor badges on first contribution

**Milestone Validation**: Milestone amounts must sum exactly to funding goal

**State Flow**: Active → Successful/Failed → Completed (after all milestones withdrawn)

#### 9. **SocialVerification.sol** - Social Account Verification
**Purpose**: Link wallet addresses to social accounts (X/Twitter) on-chain

**Features**:
- **Manual Verification**: Authorized verifiers manually verify users
- **Social Handle Linking**: Prevent duplicate social accounts
- **Institution Verification**: Special verification for organizations
- **Proof Hashing**: Store hash of verification proof data
- **Verifier Management**: Owner can add/remove verifiers
- **Revocation System**: Verifiers can revoke verification

**Future Integration**: Ready for Reclaim Protocol or other ZK verification systems

### Contract Dependency Graph (with Registry/Factory)

```
QuintyRegistry (Central Source of Truth)
├── Tracks all contract versions
├── Provides getAllContracts()
└── Emergency pause control

QuintyFactory
├── → QuintyRegistry (Registers all deployments)
├── Deploys all 9 core contracts
└── Configures all connections

Quinty (Core)
├── → QuintyReputation (Ownership transferred)
├── → DisputeResolver (Receives slash funds)
├── → QuintyNFT (Mints badges for winners)
└── ← QuintyRegistry (Registered in registry)

QuintyNFT (Soulbound Badges)
├── ← Quinty (Authorized minter)
├── ← GrantProgram (Authorized minter)
├── ← LookingForGrant (Authorized minter)
├── ← Crowdfunding (Authorized minter)
└── ← QuintyRegistry (Registered in registry)

GrantProgram, LookingForGrant, Crowdfunding (Independent contracts with NFT integration)
├── → QuintyNFT (Mints badges)
└── ← QuintyRegistry (Registered in registry)

AirdropBounty, SocialVerification (Standalone contracts)
└── ← QuintyRegistry (Registered in registry)
```

### Deployment Order (NEW Registry/Factory Pattern)

**Recommended: Use Factory for Automated Deployment**

**Step 1: Infrastructure**
1. **QuintyRegistry** - Deploy first (no constructor args)
2. **QuintyFactory** - Deploy second (requires registry address)
3. Grant factory UPGRADER_ROLE in registry

**Step 2: Deploy via Factory**
4. Call `factory.deployFullEcosystem(reputationURI, nftURI)`
   - Deploys all 9 contracts in one transaction
   - Auto-registers all in QuintyRegistry
   - Auto-deprecates old versions if re-deploying

**Step 3: Setup via Factory**
5. Call `factory.setupCoreConnections()`
   - Configures Quinty, Reputation, DisputeResolver, NFT
6. Call `factory.setupFundingConnections()`
   - Configures GrantProgram, Crowdfunding, LookingForGrant

**Result**: All contracts deployed, registered, and configured in ~3 transactions!

---

**Alternative: Manual Deployment (Legacy)**

1. **QuintyReputation** - Deploy first (requires baseTokenURI)
2. **Quinty** - Deploy second (no constructor args)
3. **DisputeResolver** - Deploy third (requires Quinty address)
4. **QuintyNFT** - Deploy fourth (requires baseTokenURI)
5. **AirdropBounty** - Deploy fifth (no constructor args)
6. **SocialVerification** - Deploy sixth (no constructor args)
7. **GrantProgram** - Deploy seventh (no constructor args)
8. **LookingForGrant** - Deploy eighth (no constructor args)
9. **Crowdfunding** - Deploy ninth (no constructor args)

**Post-Deployment Setup** (in order):
1. `Quinty.setAddresses(reputation, dispute, nft)` - Connect core contracts
2. `QuintyReputation.transferOwnership(quinty)` - Allow Quinty to update reputation
3. `GrantProgram.setNFTAddress(nft)` - Enable grant badges
4. `LookingForGrant.setNFTAddress(nft)` - Enable supporter badges
5. `Crowdfunding.setNFTAddress(nft)` - Enable donor badges
6. `QuintyNFT.authorizeMinter(quinty)` - Allow Quinty to mint
7. `QuintyNFT.authorizeMinter(grantProgram)` - Allow GrantProgram to mint
8. `QuintyNFT.authorizeMinter(lookingForGrant)` - Allow LookingForGrant to mint
9. `QuintyNFT.authorizeMinter(crowdfunding)` - Allow Crowdfunding to mint

### Network Configuration

#### Base Mainnet (Production)
- **Network Name**: Base Mainnet
- **Chain ID**: 8453
- **RPC Endpoint**: https://mainnet.base.org
- **Block Explorer**: https://base.blockscout.com/
- **Native Token**: ETH
- **Minimum Voting Stake**: 0.0001 ETH

#### Base Sepolia (Testnet)
- **Network Name**: Base Sepolia
- **Chain ID**: 84532
- **RPC Endpoint**: https://sepolia.base.org
- **Block Explorer**: https://sepolia-explorer.base.org
- **Native Token**: ETH (Testnet)
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Minimum Voting Stake**: 0.0001 ETH

**Current Deployment**: Base Sepolia (see FINAL_SUMMARY.md for addresses)

## Development Patterns

### Contract Architecture

- **Solidity Version**: 0.8.28 with IR optimization enabled (viaIR: true)
- **Optimizer**: Enabled with 200 runs for balanced gas efficiency
- **Security**: All contracts use ReentrancyGuard on payable functions
- **Access Control**: Ownable for admin functions, custom modifiers for role-based access
- **Modularity**: Contracts are separate but interconnected via clean interfaces
- **Gas Optimization**: IR compilation for complex interactions, packed structs, efficient loops

### Key Implementation Patterns

**1. Bounty Lifecycle** (Quinty.sol):
```
Create → [OPREC (optional)] → OPEN → Submit Solutions → Select Winners →
PENDING_REVEAL → Reveal Solutions → RESOLVED
```

**Alternative Flow**:
```
OPEN → Deadline Passes → triggerSlash() → EXPIRED → Funds to DisputeResolver
```

**2. Team Submission Flow** (Quinty.sol:lines 256-294):
- Solver submits with teamMembers array (up to 10 members)
- Contract validates team members (no duplicates, no self-inclusion)
- Marks submission as `isTeam = true`
- On reveal: splits reward equally among leader + all members
- Mints Team Member badges for all participants

**3. Reputation Updates** (QuintyReputation.sol):
- Quinty calls `recordSubmission()`, `recordWin()`, `recordBountyCreation()`
- QuintyReputation checks milestone thresholds (1, 10, 25, 50, 100)
- Automatically mints achievement NFTs when milestones reached
- Updates season leaderboards for monthly champions

**4. Expiry Handling** (Quinty.sol:lines 427-446):
- Anyone can call `triggerSlash()` after deadline
- Calculates slash amount (25-50% of bounty)
- Transfers slash to DisputeResolver via `initiateExpiryVote()`
- Refunds remaining amount to creator
- Changes status to EXPIRED

**5. Soulbound Token Enforcement** (QuintyNFT.sol:lines 217-246):
```solidity
function _update(address to, uint256 tokenId, address auth) internal override {
    address from = _ownerOf(tokenId);
    // Allow minting (from == 0) and burning (to == 0)
    // Block all other transfers
    if (from != address(0) && to != address(0)) {
        revert("Soulbound: Transfer not allowed");
    }
    return super._update(to, tokenId, auth);
}
```

**6. Milestone-Based Crowdfunding** (Crowdfunding.sol:lines 232-253):
- Creator releases milestones sequentially
- Enforces order: milestone N-1 must be released before N
- Separate release and withdrawal for transparency
- Auto-marks as completed when all milestones withdrawn

### IPFS Integration

All off-chain data stored on IPFS:

- **Bounty Descriptions**: Full task details with images/videos
- **Submission CIDs**: Permanently tracked IPFS CIDs submitted by solvers (immutable)
- **Reveal CIDs**: Additional detailed solution CIDs that winners can reveal after selection
- **NFT Metadata**: Custom metadata for achievement badges
- **Grant Applications**: Project details, social proof, portfolios
- **Campaign Updates**: Progress updates with images/documents
- **Verification Proofs**: Social media verification screenshots

**Standard Format**: `ipfs://QmExampleCid/metadata.json`

### Testing Strategy

**Test Suite**: 68 tests across 9 test files

- **Quinty.test.ts** (21 tests):
  - Bounty creation and validation
  - Submission flow (solo and team)
  - Winner selection and reveal
  - Slash mechanism on expiry
  - Edge cases (no submissions, single submission)

- **QuintyOprec.test.ts** (9 tests):
  - Oprec application submission
  - Approval and rejection flow
  - Phase transition to OPEN
  - Team vs solo applications

- **AirdropBounty.test.ts** (26 tests):
  - Airdrop creation and escrow
  - Entry submission and verification
  - Verifier management
  - Batch verification
  - Auto-finalization
  - Cancellation logic

- **QuintyNFT.test.ts**: Soulbound behavior, minting authorization
- **GrantProgram.test.ts**: Application flow, selective approval
- **Crowdfunding.test.ts**: Milestone release, refund mechanism
- **LookingForGrant.test.ts**: Flexible funding model
- **NewContracts.test.ts** (12 tests): Integration tests
- **DisputeResolver.test.ts**: Voting mechanics (marked "coming soon")

**Mock Data**: Realistic ETH amounts (0.1-10 ETH), valid IPFS CID formats

**Edge Cases Covered**:
- Zero submissions on bounties
- Single submission edge cases
- Large bounty amounts (100 ETH+)
- Maximum participants (10 team members, 100 grant recipients)
- Attack vectors (re-entrancy, unauthorized access)

### Security Features

**1. ReentrancyGuard**: All payable and state-changing functions protected

**2. Access Control**:
- Ownable for admin functions
- Custom modifiers (`onlyCreator`, `bountyIsOpen`, `oprecIsActive`)
- Verifier authorization system
- NFT minting authorization

**3. Input Validation**:
- Amount checks (> 0, within limits)
- Deadline validation (future timestamps, reasonable limits)
- Array length validation (prevent DOS)
- Address validation (non-zero)
- IPFS CID validation (non-empty strings)

**4. Safe ETH Transfers**:
```solidity
(bool success, ) = payable(recipient).call{value: amount}("");
require(success, "Transfer failed");
```

**5. Overflow Protection**: Solidity 0.8.28 built-in overflow checks

**6. Immutable Submissions**: Submission IPFS CIDs are permanently tracked and cannot be changed

**7. Soulbound Enforcement**: Multiple layers (transfer, approve, setApprovalForAll all blocked)

### Gas Optimization Techniques

1. **IR Compilation** (`viaIR: true`): Better optimization for complex contracts
2. **Packed Structs**: Group smaller types together
3. **Immutable Variables**: Where applicable for deployed addresses
4. **Efficient Loops**: Early returns, minimal storage reads
5. **Batch Operations**: `batchMintBadges`, `verifyMultipleEntries`
6. **View Functions**: Extensive use for read-only operations
7. **Minimal Storage Writes**: Calculate in memory, write once

## Important Implementation Details

### Contract Interconnections

**Quinty ↔ QuintyReputation**:
- QuintyReputation ownership transferred to Quinty
- Quinty calls `recordSubmission()`, `recordWin()`, `recordBountyCreation()`
- Automated reputation updates on all bounty actions

**Quinty → DisputeResolver**:
- DisputeResolver deployed with Quinty address
- Quinty calls `initiateExpiryVote()` when bounty expires
- Transfers slash funds (25-50% of bounty) to DisputeResolver

**Quinty → QuintyNFT**:
- Quinty authorized to mint badges
- Mints Team Member badges for winning teams
- Integrates with reputation system

**GrantProgram/LookingForGrant/Crowdfunding → QuintyNFT**:
- All authorized to mint badges
- Grant programs mint GrantGiver and GrantRecipient badges
- Crowdfunding mints CrowdfundingDonor badges
- LookingForGrant mints LookingForGrantSupporter badges

### ETH Token Usage

**All transactions use native ETH**:
- No ERC-20 tokens involved
- Simplifies user experience
- Lower gas costs
- msg.value for all deposits

**Minimum Amounts**:
- Bounty submission deposit: 10% of bounty amount
- Voting stake: 0.0001 ETH
- Grant/crowdfunding: Any amount > 0

### Voting Mechanics (DisputeResolver)

**Weighted Voting System**:
- Voters stake minimum 0.0001 ETH
- Rank exactly 3 submissions in order
- Score = stake × rank position
- Higher scores win

**Reward Distribution**:
- 10% of slash to top-ranked non-winner
- 5% of slash split among correct voters
- Proportional to stake amount

### Deployment Requirements

**Required Environment Variables** (.env):
```bash
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

**Deployment Scripts**:
- `scripts/deploy.ts` - Full deployment pipeline with setup
- `scripts/setup-contracts.ts` - Post-deployment configuration
- `scripts/export-abis.ts` - Export ABIs for frontend

**Deployment Artifacts**:
- `deployments.json` - Contract addresses and network info
- `typechain-types/` - TypeScript contract types
- `artifacts/contracts/` - Compiled contract artifacts

### Known Issues & Limitations

1. **DisputeResolver Tests**: Marked as "coming soon", voting logic needs testing
2. **NFT Test Mismatches**: Some tests expect 3 event args but contract emits 4
3. **GrantProgram Test Issues**: Some function signature mismatches in tests
4. **Nonce Management**: Base Sepolia sometimes has nonce delays (2-second delays added)
5. **No Upgrade Path**: Simple deployment, no proxy pattern (intentional for security)
6. **Season Duration**: Hardcoded to 30 days, cannot be changed without redeployment

## Frontend Integration

**ABI Exports**: Run `npx hardhat run scripts/export-abis.ts`

**Contract Addresses**: See `deployments.json` or `FINAL_SUMMARY.md`

**Frontend Files** (if exported to fe-quinty/):
- Individual ABIs: `fe-quinty/contracts/*.json`
- Combined ABIs: `fe-quinty/contracts/all-abis.json`
- TypeScript constants: `fe-quinty/contracts/constants.ts`

**Documentation**: See `FRONTEND_INTEGRATION.md` for complete integration examples

## Development Workflow

### Adding New Features

1. Create feature branch
2. Write contract code with NatSpec comments
3. Add comprehensive tests
4. Run `npx hardhat compile` to check for errors
5. Run `npx hardhat test` to ensure all tests pass
6. Update documentation (this file, DEPLOYMENT_SUMMARY.md)
7. Deploy to testnet for verification

### Testing Workflow

1. Write tests before implementation (TDD)
2. Test happy path first
3. Add edge cases and failure scenarios
4. Test access control and permissions
5. Verify gas usage for expensive operations
6. Test integration between contracts

### Deployment Workflow

1. Test on local Hardhat network
2. Deploy to Base Sepolia testnet
3. Verify all contracts on explorer
4. Test all functions on testnet
5. Audit contract security
6. Deploy to Base Mainnet
7. Verify on mainnet explorer
8. Export ABIs for frontend

## Resources

- **Hardhat Documentation**: https://hardhat.org/docs
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts/
- **Base Network Docs**: https://docs.base.org/
- **Ethers.js v6**: https://docs.ethers.org/v6/
- **IPFS Documentation**: https://docs.ipfs.tech/
- **Solidity Docs**: https://docs.soliditylang.org/

## Project Structure

```
sc-quinty/
├── contracts/              # Solidity smart contracts (9 files)
│   ├── Quinty.sol         # Core bounty contract
│   ├── QuintyReputation.sol
│   ├── QuintyNFT.sol      # Soulbound badges
│   ├── DisputeResolver.sol
│   ├── AirdropBounty.sol
│   ├── SocialVerification.sol
│   ├── GrantProgram.sol
│   ├── LookingForGrant.sol
│   └── Crowdfunding.sol
├── test/                  # Test files (9 files, 68 tests)
├── scripts/               # Deployment and utility scripts
│   ├── deploy.ts         # Main deployment script
│   ├── setup-contracts.ts
│   └── export-abis.ts
├── typechain-types/       # Auto-generated TypeScript types
├── hardhat.config.ts      # Hardhat configuration
├── package.json           # Dependencies
├── deployments.json       # Deployed contract addresses
├── CLAUDE.md             # This file
├── DEPLOYMENT_SUMMARY.md  # Architecture overview
├── FINAL_SUMMARY.md      # Complete deployment summary
└── FRONTEND_INTEGRATION.md # Frontend integration guide
```

## Quick Reference

### Contract Sizes (Approximate)
- Quinty: ~20KB
- QuintyReputation: ~18KB
- QuintyNFT: ~12KB
- Crowdfunding: ~14KB
- GrantProgram: ~14KB
- LookingForGrant: ~12KB
- AirdropBounty: ~10KB
- DisputeResolver: ~8KB
- SocialVerification: ~6KB

### Gas Estimates
- Deploy all contracts: ~35M gas
- Create bounty: ~200k gas
- Submit solution: ~150k gas
- Select winners: ~100k gas
- Create grant: ~180k gas
- Create campaign: ~250k gas

### Test Coverage
- **Total Tests**: 68
- **Passing**: 34 (50%)
- **Failing/Skipped**: 34 (50% - mostly integration and advanced features)
- **Core Functionality**: ✅ Working
- **Advanced Features**: 🚧 In progress

Last Updated: January 2025
