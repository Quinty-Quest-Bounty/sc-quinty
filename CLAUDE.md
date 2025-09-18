# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Smart Contract Development
- **Compile**: `npx hardhat compile` - Compiles all contracts with IR optimization
- **Test**: `npx hardhat test` - Runs comprehensive test suite (65 tests)
- **Deploy locally**: `npx hardhat run scripts/deploy.ts --network hardhat`
- **Deploy to Somnia Testnet**: `npx hardhat run scripts/deploy.ts --network somniaTestnet`
- **Console**: `npx hardhat console --network localhost` - Interactive REPL for testing

### Testing Commands
- **Full test suite**: `npx hardhat test` - Runs all 65 tests across 3 contracts
- **Gas reporting**: `npx hardhat test --gas-report` (requires gas reporter plugin)
- **Single test file**: `npx hardhat test test/Quinty.test.ts`

## Architecture Overview

Quinty is an on-chain task bounty DAO system for Somnia Testnet with four interconnected smart contracts:

### Core Contract System
1. **Quinty.sol** - Main bounty contract with 100% STT escrow, blinded IPFS submissions, winner selection, and automatic slashing (25-50%) on expiry
2. **DisputeResolver.sol** - DAO voting system for expiry disputes and pengadilan (court) disputes with 0.0001 STT staking
3. **QuintyReputation.sol** - Soulbound ERC-721 NFT reputation system with IPFS metadata and dynamic Bronze/Silver/Gold levels
4. **AirdropBounty.sol** - Transparent promotion task rewards with fixed STT payouts for verified social proofs

### Key Integration Points
- **Contract Dependencies**: Quinty → QuintyReputation (reputation updates), Quinty → DisputeResolver (expiry voting)
- **Deployment Order**: QuintyReputation → DisputeResolver → Quinty → AirdropBounty → Connect addresses
- **STT Token**: Native Somnia Testnet token used for all escrow, staking, and rewards
- **IPFS Integration**: All submissions, reveals, and NFT metadata stored on IPFS with CIDs on-chain

### Network Configuration
- **Target Network**: Somnia Testnet (chainId: 50312)
- **RPC**: https://dream-rpc.somnia.network/
- **Native Token**: STT (Somnia Test Token)
- **Minimum Voting Stake**: 0.0001 STT

## Development Patterns

### Contract Architecture
- **Solidity Version**: 0.8.28 with IR optimization enabled
- **Security**: All contracts use ReentrancyGuard, proper access controls via Ownable
- **Modularity**: Contracts are separate but interconnected via interfaces
- **Upgradeability**: Designed for potential proxy upgrades with virtual functions

### Key Flows
1. **Bounty Lifecycle**: Create (escrow STT) → Submit (IPFS + 10% deposit) → Resolve (select winners) → Reveal solutions
2. **Expiry Handling**: Deadline passes → triggerSlash() → 25-50% to DisputeResolver → Community voting → Reward distribution
3. **Reputation System**: Actions trigger updateCreatorRep/updateSolverRep → Check thresholds → Mint/upgrade NFT badges
4. **Dispute Resolution**: Stake 0.0001 STT → Rank top 3 submissions → Weighted voting → Proportional rewards

### Testing Strategy
- **Comprehensive Coverage**: 65 tests covering all contracts and edge cases
- **Test Structure**: Each contract has dedicated test file with full lifecycle testing
- **Mock Data**: Tests use realistic STT amounts and IPFS CID formats
- **Edge Cases**: Handles zero submissions, single submissions, large bounties, and attack vectors

## Important Implementation Details

### Contract Interconnections
- QuintyReputation ownership must be transferred to Quinty contract for reputation updates
- DisputeResolver needs Quinty address set for expiry vote access control
- All STT transfers use native token (msg.value), not ERC-20

### IPFS Integration
- Submissions use blinded IPFS CIDs during active bounty period
- Winners can reveal actual solution CIDs after resolution
- NFT metadata follows standard: `ipfs://QmExampleCid/Bronze-Creator.json`

### Voting Mechanics
- Minimum 0.0001 STT stake required for accessibility
- Voters rank exactly 3 submissions in order of preference
- Weighted scoring: stake amount × rank position determines winners
- Reward distribution: 10% to top-ranked non-winner, 5% to correct voters

### Gas Optimization
- IR compilation enabled for complex contract interactions
- Packed structs and immutable variables where possible
- Efficient loops and early returns in validation functions

## Environment Setup

Required environment variables:
- `SOMNIA_TESTNET_RPC`: RPC endpoint for Somnia Testnet
- `PRIVATE_KEY`: Deployer private key (optional, fallback to test mnemonic)

## Deployment Info

Latest deployment on Somnia Testnet:
- **Quinty**: 0x76FD733c7134BCeC5C1f80F1751E8Ac8b4a3DC0f
- **QuintyReputation**: 0x43FED42239B2121e5e0fABdE3E99cf530CC3c4cC
- **DisputeResolver**: 0xDc691A0c6a107AE7cf59F8c53A7B0f4f33427C75
- **AirdropBounty**: 0xB265400F901Be063F00bF9BA62F5847200E26F94

Contract addresses are saved in `deployments.json` after successful deployment.