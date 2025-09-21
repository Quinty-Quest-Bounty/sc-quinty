# Quinty DAO - Smart Contract Suite

A comprehensive decentralized bounty DAO system built for Somnia Testnet with innovative reputation NFT achievements and community-driven dispute resolution.

## 🎯 System Overview

Quinty is a next-generation bounty platform that combines task management, reputation systems, and DAO governance. Users can create bounties, submit solutions, resolve disputes through community voting, and earn milestone-based NFT achievements.

### Core Features

- **🎯 Bounty Management**: Escrow-based task system with automatic slashing
- **⚖️ DAO Dispute Resolution**: Community voting with weighted stakes
- **🏆 NFT Achievement System**: Milestone-based soulbound reputation tokens
- **🎁 Airdrop Campaigns**: Transparent promotion task distribution
- **📊 Season Tracking**: Monthly leaderboards and seasonal rewards

## 🏗️ Smart Contract Architecture

### Contract System (4 Interconnected Contracts)

1. **Quinty.sol** - Core bounty contract with 100% STT escrow
2. **QuintyReputation.sol** - Soulbound NFT achievement system
3. **DisputeResolver.sol** - DAO voting for expiry and dispute resolution
4. **AirdropBounty.sol** - Transparent promotion task rewards

### Key Innovations

- **Blinded IPFS Submissions**: Solutions hidden until winner selection
- **Automatic Slashing**: 25-50% penalty for expired bounties
- **Milestone NFT Achievements**: 1→10→25→50→100 progression system
- **Custom IPFS Artwork**: Unique badge images for each achievement
- **Weighted DAO Voting**: 0.0001 STT minimum stake with proportional power

## 🚀 Deployment Information

### Latest Contract Addresses (Somnia Testnet)
```
Quinty Core:        0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15
QuintyReputation:   0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F
DisputeResolver:    0x25e505A0E77BAc255bEA230e2Ad1b93c1490d7F2
AirdropBounty:      0xaa00D6519d7bbECb27a5e0cF07dC5Bc0f75F46Df
```

### Network Configuration
- **Network**: Somnia Testnet
- **Chain ID**: 50312
- **RPC**: https://dream-rpc.somnia.network/
- **Native Token**: STT (Somnia Test Token)
- **Explorer**: https://shannon-explorer.somnia.network

## 🔧 Development Setup

### Prerequisites
- Node.js v18+
- Hardhat v2.19+
- Somnia Testnet STT tokens

### Installation
```bash
npm install
```

### Environment Variables
```bash
SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network/
PRIVATE_KEY=your_private_key_here
```

### Build & Test
```bash
# Compile contracts with IR optimization
npx hardhat compile

# Run comprehensive test suite (65 tests)
npx hardhat test

# Deploy to Somnia Testnet
npx hardhat run scripts/deploy.ts --network somniaTestnet
```

## 🏆 NFT Achievement System

### Achievement Categories

#### 🔧 Solver Badges (Blue Theme)
- **First Solver** (1 submission) - Simple circuit icon
- **Active Solver** (10 submissions) - Circuit with gears
- **Skilled Solver** (25 submissions) - Advanced circuit pattern
- **Expert Solver** (50 submissions) - Complex circuit with shine
- **Legend Solver** (100 submissions) - Legendary circuit with aura

#### 🏆 Winner Badges (Gold Theme)
- **First Victory** (1 win) - Simple trophy
- **Skilled Winner** (10 wins) - Trophy with laurels
- **Expert Winner** (25 wins) - Ornate trophy
- **Champion Winner** (50 wins) - Champion cup
- **Legend Winner** (100 wins) - Legendary crown

#### 💡 Creator Badges (Green Theme)
- **First Creator** (1 bounty) - Light bulb icon
- **Active Creator** (10 bounties) - Light bulb with gears
- **Skilled Creator** (25 bounties) - Multiple light bulbs
- **Expert Creator** (50 bounties) - Bright shining bulb
- **Legend Creator** (100 bounties) - Cosmic light bulb

#### 👑 Season Badges (Purple Theme)
- **Monthly Champion** - Top solver of the month
- **Monthly Builder** - Top creator of the month

### NFT Features
- **Soulbound Tokens**: Non-transferable reputation records
- **Custom IPFS Artwork**: Unique images for each achievement type
- **MetaMask Compatible**: Proper base64 metadata encoding
- **Dynamic Generation**: SVG fallbacks for achievements without custom images

## ⚖️ Dispute Resolution System

### Expiry Disputes
1. **Trigger**: Bounty deadline passes without winner selection
2. **Slashing**: 25-50% of bounty amount goes to DisputeResolver
3. **Community Vote**: Stake 0.0001 STT to rank top 3 submissions
4. **Rewards**: 10% to top-ranked submission, 5% to correct voters

### Pengadilan (Court) Disputes
1. **Initiation**: Creators can dispute winner selections
2. **Evidence**: Submit reasoning for dispute
3. **DAO Decision**: Community votes on dispute validity
4. **Resolution**: Majority decision determines final outcome

## 🎁 Airdrop Campaign System

### Campaign Features
- **Fixed STT Rewards**: Predetermined payout amounts
- **Social Media Integration**: Twitter/X post verification
- **IPFS Proof Storage**: Decentralized evidence storage
- **First-Come-First-Served**: Transparent reward distribution
- **Progress Tracking**: Real-time campaign status

## 🔄 Key Workflows

### Bounty Lifecycle
1. **Create** → Escrow 100% STT amount
2. **Submit** → IPFS submission + 10% deposit
3. **Select** → Creator chooses winners
4. **Reveal** → Winners reveal actual solutions
5. **Resolve** → Automatic reputation updates and NFT minting

### Achievement Progression
1. **Action Performed** → recordSubmission/recordWin/recordBountyCreation
2. **Milestone Check** → Contract validates achievement thresholds
3. **NFT Minting** → Automatic soulbound token creation
4. **Metadata Generation** → Base64 encoded JSON with IPFS images
5. **Wallet Display** → Visible in MetaMask and other NFT-compatible wallets

## 📊 Technical Specifications

### Security Features
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable Access Control**: Restricted function access
- **STT Native Integration**: Direct value transfers without ERC-20 overhead
- **Soulbound NFTs**: Prevents reputation trading

### Gas Optimization
- **IR Compilation**: Enabled for complex contract interactions
- **Packed Structs**: Efficient storage layout
- **Immutable Variables**: Reduced gas costs for constants
- **Early Returns**: Optimized validation functions

### IPFS Integration
- **Blinded Submissions**: CIDs hidden during active bounty period
- **Custom Artwork**: Achievement badges hosted on IPFS
- **Metadata Storage**: Standardized JSON format for NFT compatibility
- **Gateway Agnostic**: Works with any IPFS gateway

## 🔮 Future Enhancements

### Planned Features
- **Cross-chain Compatibility**: Expand beyond Somnia Testnet
- **Oracle Integration**: Automated verification systems
- **Governance Tokens**: Enhanced DAO voting mechanisms
- **Advanced Analytics**: Comprehensive reputation metrics

### Scalability Improvements
- **Layer 2 Integration**: Reduced transaction costs
- **Batch Operations**: Efficient multi-action transactions
- **Caching Systems**: Optimized metadata retrieval
- **Event Indexing**: Enhanced query performance

## 📚 Documentation

For detailed implementation guides and API references, see:
- [CLAUDE.md](./CLAUDE.md) - Development guidelines and patterns
- [Frontend README](./FRONTEND/README.md) - UI implementation details
- [Test Suite](./test/) - Comprehensive testing documentation

## 🤝 Contributing

This project represents a complete implementation of a decentralized bounty DAO with innovative NFT achievements. Contributions are welcome for:

1. **Security Enhancements**: Additional safety measures
2. **Gas Optimizations**: Further efficiency improvements
3. **Feature Additions**: New achievement types and mechanics
4. **Integration Support**: Third-party service connections

## 📄 License

Open source implementation for the Quinty DAO ecosystem on Somnia Testnet.
