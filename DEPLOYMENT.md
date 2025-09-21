# Quinty Smart Contracts Deployment Guide

## Overview

Quinty is a complete on-chain task bounty system built for the Somnia Testnet. The system includes:

- **Core Quinty Contract**: Handles bounty creation, submission management, and escrow
- **Reputation System**: NFT-based soulbound badges with IPFS metadata
- **Dispute Resolution**: voting system with staking for expiry and pengadilan disputes
- **Airdrop Bounties**: Transparent promotion task rewards

## Quick Start

### 1. Environment Setup

Create a `.env` file with:

```bash
SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network/
PRIVATE_KEY=your_private_key_here
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile Contracts

```bash
npx hardhat compile
```

### 4. Deploy to Somnia Testnet

```bash
npx hardhat run scripts/deploy.ts --network somniaTestnet
```

## Contract Architecture

### Core Contracts

1. **Quinty.sol** - Main bounty contract with escrow management

   - 100% STT escrow for all bounties
   - Blinded IPFS submissions
   - Winner selection and reward distribution
   - Automatic slashing on expiry (25-50%)

2. **DisputeResolver.sol** - Voting and dispute system

   - Expiry voting: Community ranks top submissions
   - Pengadilan disputes: Overturn winner decisions
   - Staking: 0.0001 STT minimum
   - Reward distribution: 10% top solver, 5% correct voters

3. **QuintyReputation.sol** - NFT-based reputation

   - Soulbound ERC-721 tokens
   - IPFS-hosted badge images and metadata
   - Dynamic levels: Bronze/Silver/Gold
   - Separate creator and solver tracking

4. **AirdropBounty.sol** - Transparent promotion tasks
   - Fixed STT rewards per qualifier
   - IPFS proof submissions (X posts, etc.)
   - Verifier-based approval system
   - First-come-first-served distribution

### Key Features

- **Native STT Token**: All operations use Somnia's native token
- **IPFS Integration**: Decentralized storage for submissions and NFT metadata
- **Low-Cost Voting**: 0.0001 STT stake requirement for accessibility
- **Modular Design**: Contracts can be upgraded or extended
- **Security**: ReentrancyGuard, proper access controls

## Testing

Run the comprehensive test suite:

```bash
npx hardhat test
```

Tests cover:

- Bounty creation and management
- Solution submissions and reveals
- Winner selection and payouts
- Slashing and expiry mechanics
- Dispute resolution voting
- Reputation NFT minting
- Airdrop task verification

## Deployment Process

The deployment script (`scripts/deploy.ts`) follows this sequence:

1. Deploy **QuintyReputation** contract
2. Deploy **DisputeResolver** contract
3. Deploy **Quinty** main contract
4. Deploy **AirdropBounty** contract
5. Connect contracts (set addresses)
6. Transfer ownership appropriately

## Network Configuration

### Somnia Testnet

- Chain ID: 50312
- RPC: https://dream-rpc.somnia.network/
- Native Token: STT
- Block Explorer: https://shannon-explorer.somnia.network

## Usage Examples

### Creating a Bounty

```solidity
quinty.createBounty{value: 1 ether}(
    "Build a DeFi dashboard",
    block.timestamp + 7 days,
    false,      // single winner
    [],         // no multiple winner shares
    3000        // 30% slash on expiry
);
```

### Submitting a Solution

```solidity
quinty.submitSolution{value: 0.1 ether}(
    1,                    // bounty ID
    "QmIPFSCidHere"      // blinded submission CID
);
```

### Voting on Expiry

```solidity
disputeResolver.vote{value: 0.0001 ether}(
    1,              // dispute ID
    [2, 0, 1]       // ranked submission IDs
);
```

## Future Enhancements

- Oracle integration for automated verification
- Layer 2 scaling solutions
- Advanced governance mechanisms
- Cross-chain interoperability
- Enhanced reputation algorithms

## Security Considerations

- All contracts use OpenZeppelin security patterns
- Extensive test coverage
- Proper access controls and modifiers
- ReentrancyGuard on all state-changing functions
- Thorough validation of user inputs

## Support

For issues and questions:

- Check the comprehensive test suite for usage examples
- Review contract comments and documentation
- Test on local network before mainnet deployment

---

Built for Somnia Testnet with ❤️ using Hardhat and OpenZeppelin.
