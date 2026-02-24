# CLAUDE.md - incuBase Milestone

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Smart Contract Development

- **Compile**: `npx hardhat compile` - Compiles all contracts with IR optimization
- **Test**: `npx hardhat test` - Runs comprehensive test suite (99 tests)
- **Test specific file**: `npx hardhat test test/Quinty.test.ts`
- **Deploy locally**: `npx hardhat run scripts/deploy.ts --network hardhat`
- **Deploy to Base Sepolia**: `npx hardhat run scripts/deploy.ts --network baseSepolia`
- **Export ABIs**: `npx ts-node scripts/export-abis.ts`

## Architecture Overview

Quinty is an on-chain task bounty system for Base network with three core smart contracts:

### Core Contract System

1. **Quinty.sol** - Main bounty contract with phases, 1% deposit, and slash mechanism
2. **Quest.sol** - Social quests/promotion tasks with fixed ETH rewards
3. **QuintyReputation.sol** - Soulbound ERC-721 NFT reputation system

---

## Bounty System (Quinty.sol)

### Key Features

- **1% Deposit**: Submitters pay 1% of bounty amount as deposit
- **Slash Mechanism**: Creator gets slashed (25-50%) if they don't select winner on time
- **Phase Deadlines**: Creator sets open deadline and judging deadline at creation
- **Social Verification**: All participants' social accounts stored on-chain
- **NO CANCELLATION**: Once created, bounty cannot be cancelled

### Bounty Flow

```
1. CREATION
   - Creator sets: title, description, escrow amount
   - Creator sets: openDeadline (when submissions close)
   - Creator sets: judgingDeadline (when must select winner)
   - Creator sets: slashPercent (25-50%)

2. OPEN PHASE (until openDeadline)
   - Submitters pay 1% deposit
   - Submitters provide IPFS CID + social handle
   - Social accounts stored on-chain

3. JUDGING PHASE (openDeadline -> judgingDeadline)
   - Creator reviews submissions
   - Creator must select winner before judgingDeadline

4. RESOLUTION
   Option A: Winner Selected (before judgingDeadline)
   - Winner receives: escrow + their deposit
   - Non-winners receive: their deposits refunded
   - Status: RESOLVED

   Option B: No Winner Selected (after judgingDeadline)
   - Anyone can call triggerSlash()
   - Slash amount (25-50%) distributed equally to all submitters
   - Each submitter receives: (slashAmount / submitterCount) + their deposit
   - Creator receives: remaining (50-75%) of escrow
   - Status: SLASHED

5. SPECIAL CASE: No Submissions
   - If no submissions after openDeadline, creator can call refundNoSubmissions()
   - Creator receives full escrow back (no slash)
```

### Bounty Status Enum

```solidity
enum BountyStatus { OPEN, JUDGING, RESOLVED, SLASHED }
```

### Key Functions

| Function | Description |
|----------|-------------|
| `createBounty(title, desc, openDeadline, judgingDeadline, slashPercent)` | Create bounty with phase deadlines |
| `submitToBounty(bountyId, ipfsCid, socialHandle)` | Submit work with 1% deposit |
| `moveToJudging(bountyId)` | Manually move to judging (auto-triggered) |
| `selectWinner(bountyId, submissionId)` | Select winner, pay escrow |
| `triggerSlash(bountyId)` | Slash creator if deadline passed |
| `refundNoSubmissions(bountyId)` | Refund if no submissions |
| `linkSocialAccount(xHandle, email)` | Link social account to wallet |

### Social Account Storage

All users who interact with the contract have their social accounts stored on-chain:

```solidity
struct SocialAccount {
    string xHandle;      // X/Twitter handle
    string email;        // Email (optional)
    uint256 linkedAt;    // Timestamp
    bool verified;       // Verification status
}
```

---

## Quest System (Quest.sol)

### Quest Flow

```
1. Creator creates quest with escrow (perQualifier * maxQualifiers)
2. Users submit entries with IPFS proof and social handle
3. Creator approves entries -> immediate payout
4. Quest finalizes when max qualifiers reached or deadline passes
```

### Key Differences from Bounty

| Feature | Bounty | Quest |
|---------|--------|-------|
| Winners | Single winner | Multiple qualifiers |
| Deposit | 1% required | No deposit |
| Phases | OPEN -> JUDGING -> RESOLVED | Single active phase |
| Slash | Yes, if no winner selected | No slash |
| Cancellation | Not allowed | Allowed (if no approvals) |

---

## Reputation System (QuintyReputation.sol)

Tracks user activity and mints achievement NFTs:

- **Submissions**: 1, 10, 25, 50, 100 milestones
- **Wins**: 1, 10, 25, 50, 100 milestones  
- **Bounties Created**: 1, 10, 25, 50, 100 milestones
- **Monthly Champions**: Top solver and creator each month

---

## Network Configuration

### Base Sepolia (Testnet)
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia-explorer.base.org

### Base Mainnet
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://base.blockscout.com/

---

## Testing

### Test Results

```
99 passing tests:
- 20 Quinty tests (phases, deposit, slash)
- 24 Quest tests (creation, verification)
- 26 AirdropBounty tests (legacy)
- 29 QuintyNFT tests (soulbound, badges)
```

### Key Test Scenarios

1. **Bounty with Winner Selection**
   - Create bounty with deadlines
   - Submit with 1% deposit
   - Wait for judging phase
   - Select winner
   - Verify payouts

2. **Bounty with Slash**
   - Create bounty
   - Submit entries
   - Let judging deadline pass
   - Call triggerSlash
   - Verify slash distribution

3. **Social Account Storage**
   - Link social account
   - Verify on-chain storage
   - Auto-link during submission

---

## Frontend Integration

### Updated Contract Interfaces

**Bounty Creation:**
```typescript
createBounty(
  title: string,
  description: string,
  openDeadline: bigint,      // When submissions close
  judgingDeadline: bigint,   // When must select winner
  slashPercent: bigint       // 2500-5000 (25%-50%)
)
```

**Submit to Bounty:**
```typescript
submitToBounty(
  bountyId: bigint,
  ipfsCid: string,
  socialHandle: string,
  { value: depositAmount }   // 1% of bounty amount
)
```

**Get Required Deposit:**
```typescript
getRequiredDeposit(bountyId) // Returns 1% of bounty amount
```

### ABI Export

```bash
npx ts-node scripts/export-abis.ts
cp exported-abis/*.json ../fe-quinty/contracts/
```

---

## Environment Variables

```env
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key
```

---

## Deployment Checklist

1. [ ] Compile contracts: `npx hardhat compile`
2. [ ] Run tests: `npx hardhat test`
3. [ ] Deploy: `npx hardhat run scripts/deploy.ts --network baseSepolia`
4. [ ] Export ABIs: `npx ts-node scripts/export-abis.ts`
5. [ ] Update frontend contract addresses
6. [ ] Set reputation address: `quinty.setReputationAddress(...)`
7. [ ] Transfer reputation ownership to Quinty contract
