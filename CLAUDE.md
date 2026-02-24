# CLAUDE.md - Quinty Smart Contracts

## Quick Reference

```bash
npx hardhat compile          # Compile all contracts
npx hardhat test             # Run all tests
npx hardhat test test/Quinty.test.ts   # Run specific test
npx hardhat run scripts/deploy.ts --network baseSepolia  # Deploy
npx ts-node scripts/export-abis.ts     # Export ABIs to exported-abis/
```

## Network: Base Sepolia (Chain ID: 84532)

RPC: `https://sepolia.base.org`
Explorer: `https://sepolia-explorer.base.org`

## Deployed Contracts (2026-02-09)

| Contract | Address | Purpose |
|----------|---------|---------|
| Quinty | `0x034cf0b72BcB1b529a2B0458275E0307CD6b5459` | Bounty system |
| Quest | `0x86cc170e725784812A31F548c434e425bc0181B1` | Social quests |
| QuintyReputation | `0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014` | Soulbound achievement NFTs |
| QuintyNFT | `0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884` | Badge NFTs |

## Tech Stack

- Solidity 0.8.28, Hardhat, TypeScript
- OpenZeppelin v5.4.0 (Ownable, ReentrancyGuard, ERC721URIStorage)
- IR optimization enabled (viaIR: true, runs: 200)

---

## Contract 1: Quinty.sol (Bounty System)

Single-winner bounty system with 1% deposit, phase deadlines, and slash mechanism.

### Status Enum

```
OPEN (0) -> JUDGING (1) -> RESOLVED (2) or SLASHED (3)
```

### Bounty Flow

```
1. Creator calls createBounty() with ETH escrow
   - Sets: title, description, openDeadline, judgingDeadline, slashPercent (2500-5000 basis points)

2. OPEN PHASE (now -> openDeadline)
   - Submitters call submitToBounty() paying 1% deposit of bounty amount
   - Each submission has: ipfsCid, socialHandle

3. JUDGING PHASE (openDeadline -> judgingDeadline)
   - Anyone can call moveToJudging() after openDeadline
   - Creator calls selectWinner(bountyId, submissionId)
     -> Winner gets: escrow + their deposit
     -> Non-winners get: their deposits refunded

4. SLASH (if creator misses judgingDeadline)
   - Anyone calls triggerSlash()
   - slashAmount = escrow * slashPercent / 10000
   - Each submitter gets: (slashAmount / submitterCount) + their deposit
   - Creator gets: escrow - slashAmount

5. NO SUBMISSIONS
   - Creator/owner calls refundNoSubmissions() after openDeadline
   - Full escrow refunded to creator
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createBounty(title, desc, openDeadline, judgingDeadline, slashPercent)` | Anyone (payable) | Create bounty with ETH escrow |
| `submitToBounty(bountyId, ipfsCid, socialHandle)` | Anyone (payable, 1% deposit) | Submit work |
| `selectWinner(bountyId, submissionId)` | Bounty creator | Pick winner, distribute funds |
| `triggerSlash(bountyId)` | Anyone (after judgingDeadline) | Slash creator, pay submitters |
| `refundNoSubmissions(bountyId)` | Creator or owner | Refund if zero submissions |
| `moveToJudging(bountyId)` | Anyone (after openDeadline) | Transition to judging phase |
| `linkSocialAccount(xHandle, email)` | Anyone | Store social account on-chain |
| `setReputationAddress(addr)` | Owner only | Connect to QuintyReputation |

### View Functions

| Function | Returns |
|----------|---------|
| `getBounty(id)` | All bounty fields |
| `getSubmission(bountyId, subId)` | Single submission data |
| `getAllSubmissions(bountyId)` | Full submissions array |
| `getSubmissionCount(bountyId)` | Number of submissions |
| `hasUserSubmitted(bountyId, addr)` | Boolean |
| `getRequiredDeposit(bountyId)` | 1% of bounty amount |
| `getCurrentPhase(bountyId)` | "OPEN", "JUDGING", "SLASH_PENDING", "RESOLVED", "SLASHED" |

### Events

```solidity
BountyCreated(id, creator, title, amount, openDeadline, judgingDeadline, slashPercent)
SubmissionCreated(bountyId, submissionId, submitter, ipfsCid, socialHandle, deposit)
BountyMovedToJudging(bountyId)
WinnerSelected(bountyId, winner, submissionId, reward)
BountySlashed(bountyId, slashAmount, refundToCreator)
DepositsRefunded(bountyId, totalRefunded)
SocialAccountLinked(wallet, xHandle, email)
```

---

## Contract 2: Quest.sol (Social Quests)

Fixed-reward quest system for social/promotion tasks. Multiple qualifiers, no deposit required.

### Quest Flow

```
1. Creator calls createQuest() with ETH escrow = perQualifier * maxQualifiers
   - Sets: title, description, requirements, perQualifier, maxQualifiers, deadline

2. ACTIVE PHASE
   - Users call submitEntry(questId, ipfsCid, socialHandle) -- no deposit
   - Max submissions capped at maxQualifiers * 3

3. VERIFICATION
   - Creator calls verifyEntry(questId, entryId, status, feedback)
   - On Approved: solver immediately receives perQualifier ETH
   - On max qualifiers reached: quest auto-finalizes

4. FINALIZATION
   - Creator, owner, or anyone (after deadline) calls finalizeQuest()
   - Unused escrow refunded to creator

5. CANCELLATION
   - Creator calls cancelQuest() -- only if no entries approved yet
   - Full escrow refunded
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createQuest(title, desc, requirements, perQualifier, maxQualifiers, deadline)` | Anyone (payable) | Create quest |
| `submitEntry(questId, ipfsCid, socialHandle)` | Anyone | Submit proof |
| `verifyEntry(questId, entryId, status, feedback)` | Quest creator | Approve/reject, pays on approve |
| `verifyMultipleEntries(questId, entryIds[], statuses[], feedbacks[])` | Quest creator | Batch verify (max 50) |
| `finalizeQuest(questId)` | Creator/owner/anyone after deadline | End quest, refund unused |
| `cancelQuest(questId)` | Quest creator (no approvals yet) | Cancel and refund |

### View Functions

| Function | Returns |
|----------|---------|
| `getQuest(id)` | All quest fields |
| `getEntry(questId, entryId)` | Single entry data |
| `getEntryCount(questId)` | Number of entries |
| `getUserSubmission(questId, addr)` | User's entry data |
| `getQuestStats(questId)` | Pending/approved/rejected counts |

### Events

```solidity
QuestCreated(id, creator, title, totalAmount, perQualifier, maxQualifiers, deadline)
EntrySubmitted(questId, entryId, solver, ipfsProofCid, socialHandle)
EntryVerified(questId, entryId, solver, status, feedback, reward)
QuestFinalized(questId, qualifiersCount, unusedRefund)
QuestCancelled(questId, refundAmount)
SocialAccountLinked(wallet, xHandle, email)
```

---

## Contract 3: QuintyReputation.sol (Soulbound Achievement NFTs)

ERC-721 soulbound token (non-transferable). Tracks user statistics and mints achievement badges at milestones.

**Owner:** Quinty contract (ownership transferred during deploy). Only Quinty can call record functions.

### Record Functions (called by Quinty contract)

| Function | Effect |
|----------|--------|
| `recordSubmission(addr)` | +1 submission count, check solver milestones |
| `recordWin(addr)` | +1 win count, check winner milestones, update leaderboard |
| `recordBountyCreation(addr)` | +1 bounty created count, check creator milestones, update leaderboard |

### Achievement Milestones

| Category | Milestones (submissions/wins/bounties) |
|----------|---------------------------------------|
| Solver | 1, 10, 25, 50, 100 |
| Winner | 1, 10, 25, 50, 100 |
| Creator | 1, 10, 25, 50, 100 |
| Season | Monthly Champion (top solver), Monthly Builder (top creator) |

### Key Detail

- Tokens are **soulbound** -- transfer reverts, only minting allowed
- Metadata is generated fully on-chain (base64 JSON with SVG or IPFS image)
- Seasons rotate every 30 days

---

## Contract 4: QuintyNFT.sol (Badge NFTs)

Simpler soulbound badge system with 3 types: BountyCreator, BountySolver, TeamMember.

- Owner can authorize minter addresses (`authorizeMinter`)
- Supports batch minting (up to 100 recipients)
- Each badge has custom metadataURI
- Soulbound: `approve()` and `setApprovalForAll()` both revert

---

## Contract Relationships

```
Quinty.sol --[calls]--> QuintyReputation.sol (recordSubmission, recordWin, recordBountyCreation)
Quinty.sol --[authorized minter]--> QuintyNFT.sol (but NOT currently used in code)
Quest.sol  -- standalone, no cross-contract calls
```

Deploy order: QuintyReputation -> Quinty -> Quest -> QuintyNFT
Post-deploy: quinty.setReputationAddress(), reputation.transferOwnership(quinty), nft.authorizeMinter(quinty)

---

## Payment Flow (ETH Only)

All payments use native ETH via `msg.value` and `.call{value: amount}("")`.

- **Bounty escrow:** `msg.value` on `createBounty()`
- **Submission deposit:** `msg.value` on `submitToBounty()` (exactly 1% of bounty amount)
- **Winner payout:** Push payment in `selectWinner()`
- **Slash payout:** Push payment loop in `triggerSlash()`
- **Quest escrow:** `msg.value` on `createQuest()` (must equal perQualifier * maxQualifiers)
- **Quest reward:** Push payment on `verifyEntry()` approval

---

## Frontend Integration

### Required Files

ABIs are exported to `exported-abis/`:
- `Quinty.json` -- Bounty contract ABI
- `Quest.json` -- Quest contract ABI
- `all-abis.json` -- All ABIs in one file
- `constants.ts` -- Contract addresses and TypeScript types

### Integration Pattern (ethers.js / viem)

```typescript
// Read contract addresses from constants.ts or deployments.json
const QUINTY_ADDRESS = "0x034cf0b72BcB1b529a2B0458275E0307CD6b5459";
const QUEST_ADDRESS = "0x86cc170e725784812A31F548c434e425bc0181B1";

// Create bounty
await quintyContract.createBounty(title, desc, openDeadline, judgingDeadline, slashPercent, {
  value: escrowAmount
});

// Submit to bounty (1% deposit)
const deposit = await quintyContract.getRequiredDeposit(bountyId);
await quintyContract.submitToBounty(bountyId, ipfsCid, socialHandle, { value: deposit });

// Select winner
await quintyContract.selectWinner(bountyId, submissionId);

// Create quest
await questContract.createQuest(title, desc, requirements, perQualifier, maxQualifiers, deadline, {
  value: perQualifier * maxQualifiers
});

// Submit quest entry (no deposit)
await questContract.submitEntry(questId, ipfsCid, socialHandle);

// Verify quest entry
await questContract.verifyEntry(questId, entryId, 1, "Approved!"); // 1 = Approved
```

---

## Environment Variables

```env
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key_without_0x
```

---

## Known Limitations (Current Version)

1. **ETH only** -- No ERC-20 token support
2. **Single winner** per bounty
3. **No pause mechanism** -- No emergency stop
4. **Push payments** -- Funds can get stuck if recipient is a reverting contract
5. **Quest has no reputation integration** -- Only Quinty calls QuintyReputation
6. **Duplicated SocialAccount** storage in both Quinty.sol and Quest.sol
7. **`receive()` on non-escrow contracts** traps accidentally sent ETH
