# Quinty V2 - Decentralized Work & Funding Platform

**Quinty V2** is a comprehensive on-chain task bounty and funding ecosystem built for the Base network. It combines multiple funding models (bounties, grants, crowdfunding, VC funding) with a reputation system and soulbound NFT badges to create a complete decentralized work platform.

## Features

### Core Bounty System
- **100% ETH Escrow**: All bounties require full upfront payment in native ETH
- **Tracked IPFS Submissions**: Submissions are permanently recorded on-chain via IPFS CIDs; winners can reveal detailed solutions after selection
- **Team Collaboration**: Built-in support for team submissions with automatic reward splitting
- **Multiple Winners**: Customizable winner shares using basis points
- **Oprec (Open Recruitment)**: Optional pre-bounty application phase for curated participants
- **Automatic Slashing**: 25-50% penalty on expired bounties with community voting

### Funding Models

1. **Bounties** - Task-based rewards with escrow and winner selection
2. **Grant Programs** - Institutional grant distribution with application-based selection
3. **Crowdfunding** - All-or-nothing campaigns with milestone-based fund release
4. **Looking For Grant** - Flexible VC/investor funding without all-or-nothing constraints

### Reputation & Achievements

- **Soulbound NFT Badges**: Non-transferable achievement NFTs for ecosystem participation
- **Achievement Milestones**: Unlock badges at 1, 10, 25, 50, 100 actions
- **Monthly Seasons**: Compete for top solver and top creator badges
- **Dynamic Metadata**: Custom IPFS images and on-chain SVG generation

### Social Verification

- **X/Twitter Verification**: Link wallet addresses to social accounts on-chain
- **Institution Verification**: Special verification for organizations
- **Manual & Automated**: Ready for ZK proof integration (Reclaim Protocol compatible)

## Smart Contracts

| Contract | Purpose | Features |
|----------|---------|----------|
| **Quinty.sol** | Core bounty system | ETH escrow, team submissions, oprec, slashing |
| **QuintyReputation.sol** | Achievement tracking | Soulbound NFTs, seasons, milestones |
| **QuintyNFT.sol** | Badge system | 7 badge types, soulbound, authorization |
| **DisputeResolver.sol** | Voting system | Weighted voting, rewards (coming soon) |
| **AirdropBounty.sol** | Promotion tasks | Fixed rewards, verifier system |
| **GrantProgram.sol** | Institutional grants | Application-based, selective approval |
| **Crowdfunding.sol** | All-or-nothing | Milestone-based, refunds |
| **LookingForGrant.sol** | VC funding | Flexible, no deadlines required |
| **SocialVerification.sol** | Social proof | X/Twitter linking, institution verification |

## Quick Start

### Installation

```bash
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/Quinty.test.ts
```

### Deploy

```bash
# Deploy to local network
npx hardhat run scripts/deploy.ts --network hardhat

# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy.ts --network baseSepolia

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.ts --network baseMainnet
```

## Environment Setup

Create a `.env` file:

```bash
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

## Architecture

### Contract Dependencies

```
Quinty (Core)
├── → QuintyReputation (reputation updates)
├── → DisputeResolver (slash funds)
└── → QuintyNFT (mint badges)

QuintyNFT (Badges)
├── ← Quinty (authorized)
├── ← GrantProgram (authorized)
├── ← LookingForGrant (authorized)
└── ← Crowdfunding (authorized)
```

### Key Flows

#### 1. Bounty Lifecycle

```
Create Bounty → [Oprec Phase] → Open → Submit Solutions → Select Winners → Reveal Solutions → Resolved
```

#### 2. Team Submission

```
Team Leader Submits → Equal Split (Leader + Members) → Team Member Badges → Reputation Updates
```

#### 3. Expiry & Slashing

```
Deadline Passes → triggerSlash() → 25-50% to DisputeResolver → Refund Remainder → Community Vote
```

#### 4. Grant Distribution

```
Create Grant → Applications → Selective Approval → Claim Funds → Completion
```

## Network Information

### Base Mainnet
- **Chain ID**: 8453
- **RPC**: https://mainnet.base.org
- **Explorer**: https://base.blockscout.com/
- **Native Token**: ETH

### Base Sepolia (Testnet)
- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia-explorer.base.org
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Badge Types

| ID | Badge Type | Description |
|----|-----------|-------------|
| 0 | BountyCreator | Minted when creating bounties |
| 1 | BountySolver | For bounty participation |
| 2 | TeamMember | For team-based bounty wins |
| 3 | GrantGiver | For creating grant programs |
| 4 | GrantRecipient | For receiving grants |
| 5 | CrowdfundingDonor | For contributing to campaigns |
| 6 | LookingForGrantSupporter | For VC/investor support |

## Achievement Milestones

### Solver Achievements
- **First Solver** (1 submission) - Common
- **Active Solver** (10 submissions) - Uncommon
- **Skilled Solver** (25 submissions) - Rare
- **Expert Solver** (50 submissions) - Epic
- **Legend Solver** (100 submissions) - Legendary

### Winner Achievements
- **First Win** (1 win) - Common
- **Skilled Winner** (10 wins) - Uncommon
- **Expert Winner** (25 wins) - Rare
- **Champion Winner** (50 wins) - Epic
- **Legend Winner** (100 wins) - Legendary

### Creator Achievements
- **First Creator** (1 bounty) - Common
- **Active Creator** (10 bounties) - Uncommon
- **Skilled Creator** (25 bounties) - Rare
- **Expert Creator** (50 bounties) - Epic
- **Legend Creator** (100 bounties) - Legendary

### Season Achievements
- **Monthly Champion** - Top solver this month (Mythic)
- **Monthly Builder** - Top creator this month (Mythic)

## Testing

### Test Suite

- **Total Tests**: 68
- **Test Files**: 9
- **Coverage**: Core functionality working, advanced features in progress

### Run Tests

```bash
# All tests
npx hardhat test

# Core bounty tests (21 tests)
npx hardhat test test/Quinty.test.ts

# Oprec & team tests (9 tests)
npx hardhat test test/QuintyOprec.test.ts

# Airdrop tests (26 tests)
npx hardhat test test/AirdropBounty.test.ts

# Grant program tests
npx hardhat test test/GrantProgram.test.ts

# Crowdfunding tests
npx hardhat test test/Crowdfunding.test.ts

# NFT badge tests
npx hardhat test test/QuintyNFT.test.ts
```

## Security

### Security Features

- **ReentrancyGuard**: All payable functions protected
- **Access Control**: Ownable + custom modifiers
- **Input Validation**: Comprehensive checks on all inputs
- **Safe ETH Transfers**: Using call{value:} pattern
- **Soulbound Enforcement**: Multiple layers preventing transfers
- **Immutable Submissions**: Submission CIDs are permanently tracked on-chain

### Audit Status

- **Status**: Not yet audited
- **Recommendation**: Do NOT use in production without professional audit

## Gas Estimates

| Operation | Estimated Gas |
|-----------|--------------|
| Deploy all contracts | ~35M gas |
| Create bounty | ~200k gas |
| Submit solution | ~150k gas |
| Select winners | ~100k gas |
| Create grant | ~180k gas |
| Create campaign | ~250k gas |

## Frontend Integration

### ABI Exports

```bash
npx hardhat run scripts/export-abis.ts
```

### Example Usage

```typescript
import { ethers } from 'ethers';
import QuintyABI from './abis/Quinty.json';

const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
const quinty = new ethers.Contract(QUINTY_ADDRESS, QuintyABI.abi, provider);

// Create a bounty
const tx = await quinty.createBounty(
  "Build a DeFi dashboard",
  deadline,
  false, // single winner
  [],
  3000, // 30% slash
  false, // no oprec
  0,
  { value: ethers.parseEther("1.0") }
);
```

For complete examples, see [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)

## Deployment

### Current Deployment (Base Sepolia)

See [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) for deployed contract addresses.

### Deployment Order

1. QuintyReputation
2. Quinty
3. DisputeResolver
4. QuintyNFT
5. AirdropBounty
6. SocialVerification
7. GrantProgram
8. LookingForGrant
9. Crowdfunding

### Post-Deployment Setup

```bash
# Set contract addresses
quinty.setAddresses(reputation, dispute, nft)

# Transfer ownership
reputation.transferOwnership(quinty)

# Authorize minters
nft.authorizeMinter(quinty)
nft.authorizeMinter(grantProgram)
nft.authorizeMinter(lookingForGrant)
nft.authorizeMinter(crowdfunding)
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive development guide
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Architecture overview
- **[FINAL_SUMMARY.md](./FINAL_SUMMARY.md)** - Complete deployment summary
- **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** - Frontend integration guide

## Project Structure

```
sc-quinty/
├── contracts/              # 9 Solidity smart contracts
│   ├── Quinty.sol
│   ├── QuintyReputation.sol
│   ├── QuintyNFT.sol
│   ├── DisputeResolver.sol
│   ├── AirdropBounty.sol
│   ├── SocialVerification.sol
│   ├── GrantProgram.sol
│   ├── LookingForGrant.sol
│   └── Crowdfunding.sol
├── test/                  # 9 test files, 68 tests
├── scripts/               # Deployment scripts
│   ├── deploy.ts
│   ├── setup-contracts.ts
│   └── export-abis.ts
├── typechain-types/       # Auto-generated TypeScript types
├── hardhat.config.ts
├── package.json
└── deployments.json       # Contract addresses
```

## Technology Stack

- **Solidity**: 0.8.28
- **Hardhat**: Development environment
- **OpenZeppelin**: Security-audited contract libraries
- **TypeScript**: Type-safe development
- **Ethers.js**: Ethereum interaction library
- **Base Network**: L2 blockchain (OP Stack)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Update documentation
6. Submit a pull request

## License

MIT License

## Links

- **Base Network**: https://base.org
- **Block Explorer (Mainnet)**: https://base.blockscout.com
- **Block Explorer (Testnet)**: https://sepolia-explorer.base.org
- **Hardhat**: https://hardhat.org
- **OpenZeppelin**: https://openzeppelin.com

## Support

For questions or issues:
- Review the documentation files
- Check test files for implementation examples
- Explore contracts on Base Sepolia explorer

## Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. Always conduct a professional security audit before deploying to mainnet.

---

**Built with ❤️ for the Base ecosystem**

Last Updated: January 2025
