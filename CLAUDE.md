# CLAUDE.md - Quinty Smart Contracts

## Quick Reference

```bash
npx hardhat compile          # Compile all contracts
npx hardhat test             # Run all tests (115 tests)
npx hardhat test test/Quinty.test.ts   # Run specific test
npx hardhat run scripts/deploy.ts --network baseSepolia  # Deploy
npx ts-node scripts/export-abis.ts     # Export ABIs to exported-abis/
```

## Network: Base Sepolia (Chain ID: 84532)

RPC: `https://sepolia.base.org`
Explorer: `https://sepolia-explorer.base.org`
USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals)

## Deployed Contracts (2026-03-07)

| Contract | Address | Purpose |
|----------|---------|---------|
| Quinty | `0x4E84aaDC0471AB53B28c1d3b52FEF7c9742f0D53` | Bounty system (V3) |
| Quest | `0x65Af33E2Aa718f075EE8a94587E65DeeA4dbA257` | Social quests (V2) |
| QuintyReputation | `0xF40fAC4Ce037835Fa8fA3BEba32184E9f50A589c` | Soulbound achievement NFTs |
| QuintyNFT | `0x49f96178Bd217C4C50f94BcDE74Fbc06D9b51C96` | Badge NFTs |

## Tech Stack

- Solidity 0.8.28, Hardhat, TypeScript
- OpenZeppelin v5.4.0 (Ownable, ReentrancyGuard, Pausable, SafeERC20, ERC721URIStorage)
- IR optimization enabled (viaIR: true, runs: 200)

---

## Contract 1: Quinty.sol V3 (Bounty System)

Multi-winner bounty system with ERC-20 support, 1% deposit, phase deadlines, slash mechanism, pull-based withdrawals, and emergency pause.

### Status Enum

```
OPEN (0) -> JUDGING (1) -> RESOLVED (2) or SLASHED (3)
```

### Bounty Flow

```
1. Creator calls createBounty() with ETH or ERC-20 escrow
   - Sets: title, description, openDeadline, judgingDeadline, slashPercent (2500-5000 basis points)
   - prizes[] array defines ranked prize tiers (up to 10 winners)
   - token param: address(0) for ETH, whitelisted ERC-20 address otherwise
   - For ERC-20: must approve() token transfer first, no msg.value

2. OPEN PHASE (now -> openDeadline)
   - Submitters call submitToBounty() paying 1% deposit of total bounty amount
   - For ETH: deposit sent as msg.value
   - For ERC-20: submitter approves + contract pulls deposit via SafeERC20

3. JUDGING PHASE (openDeadline -> judgingDeadline)
   - Anyone can call moveToJudging() or selectWinners auto-transitions
   - Creator calls selectWinners(bountyId, submissionIds[]) ordered by rank
     -> Winners get: prizes[rank] + their deposit (credited to pull balance)
     -> Non-winners get: deposits refunded (credited to pull balance)
     -> Fewer winners than prize slots: unused prizes refunded to creator
   - All payouts via pull pattern (pendingWithdrawals mapping)

4. SLASH (if creator misses judgingDeadline)
   - Anyone calls triggerSlash()
   - slashAmount = totalAmount * slashPercent / 10000
   - Each submitter gets: (slashAmount / submitterCount) + their deposit
   - Last submitter gets dust remainder
   - Creator gets: totalAmount - slashAmount
   - All credits via pull pattern

5. NO SUBMISSIONS
   - Creator/owner calls refundNoSubmissions() after openDeadline (NOT paused)
   - Full escrow credited to creator via pull pattern

6. WITHDRAWAL
   - withdrawETH() / withdrawToken(tokenAddr) -- always available, even during pause
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createBounty(title, desc, openDeadline, judgingDeadline, slashPercent, prizes[], token)` | Anyone (payable) | Create bounty with ETH/ERC-20 |
| `submitToBounty(bountyId, ipfsCid)` | Anyone (payable for ETH, approve for ERC-20) | Submit work with 1% deposit |
| `selectWinners(bountyId, submissionIds[])` | Bounty creator | Pick winners by rank |
| `triggerSlash(bountyId)` | Anyone (after judgingDeadline) | Slash creator, credit submitters |
| `refundNoSubmissions(bountyId)` | Creator or owner | Refund if zero submissions |
| `withdrawETH()` | Anyone with balance | Withdraw pending ETH |
| `withdrawToken(tokenAddr)` | Anyone with balance | Withdraw pending ERC-20 |
| `pause() / unpause()` | Owner only | Emergency pause |
| `allowToken(addr) / revokeToken(addr)` | Owner only | Manage ERC-20 whitelist |
| `rescueERC20(token, amount)` | Owner only | Rescue accidentally sent tokens (cannot drain escrow) |
| `setReputationAddress(addr)` | Owner only | Connect to QuintyReputation |

### View Functions

| Function | Returns |
|----------|---------|
| `getBounty(id)` | All bounty fields including token, prizes[], totalAmount |
| `getSubmission(bountyId, subId)` | Single submission data |
| `getAllSubmissions(bountyId)` | Full submissions array |
| `getSubmissionCount(bountyId)` | Number of submissions |
| `hasUserSubmitted(bountyId, addr)` | Boolean |
| `getRequiredDeposit(bountyId)` | 1% of bounty totalAmount |
| `getCurrentPhase(bountyId)` | "OPEN", "JUDGING", "SLASH_PENDING", "RESOLVED", "SLASHED" |
| `pendingBalance(token, user)` | Pending withdrawal amount |
| `allowedTokens(addr)` | Whether token is whitelisted |
| `totalEscrowed(token)` | Total escrowed per token |

### Events

```solidity
BountyCreated(id, creator, title, token, totalAmount, openDeadline, judgingDeadline, slashPercent)
SubmissionCreated(bountyId, submissionId, submitter, ipfsCid, deposit)
BountyMovedToJudging(bountyId)
WinnersSelected(bountyId, winners[], submissionIds[])
BountySlashed(bountyId, slashAmount, refundToCreator)
FundsCredited(token, recipient, amount)
Withdrawn(token, recipient, amount)
TokenAllowed(token)
TokenRevoked(token)
```

---

## Contract 2: Quest.sol V2 (Social Quests)

Fixed-reward quest system with ERC-20 support, pull-based withdrawals, delegated verifiers, reputation integration, and emergency pause.

### Quest Flow

```
1. Creator calls createQuest() with ETH or ERC-20 escrow = perQualifier * maxQualifiers
   - Sets: title, description, requirements, perQualifier, maxQualifiers, deadline, token
   - For ERC-20: approve() then call without msg.value

2. ACTIVE PHASE
   - Users call submitEntry(questId, ipfsCid) -- no deposit
   - Max submissions capped at maxQualifiers * 3

3. VERIFICATION
   - Creator or delegated verifier calls verifyEntry(questId, entryId, status, feedback)
   - Self-approval prevented (verifier cannot approve own entry)
   - On Approved: perQualifier credited to solver's pull balance
   - On max qualifiers reached: quest auto-finalizes

4. FINALIZATION
   - Creator, owner, or anyone (after deadline) calls finalizeQuest()
   - Unused escrow credited to creator via pull pattern

5. CANCELLATION
   - Creator calls cancelQuest() -- only if no entries approved yet
   - Available during pause (refund safety)
   - Escrow credited to creator via pull pattern

6. WITHDRAWAL
   - withdrawETH() / withdrawToken(tokenAddr) -- always available
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createQuest(title, desc, perQualifier, maxQualifiers, deadline, requirements, token)` | Anyone (payable) | Create quest |
| `submitEntry(questId, ipfsCid)` | Anyone | Submit proof |
| `verifyEntry(questId, entryId, status, feedback)` | Creator or delegated verifier | Approve/reject |
| `verifyMultipleEntries(questId, entryIds[], statuses[], feedbacks[])` | Creator or delegated verifier | Batch verify (max 50) |
| `addVerifier(questId, verifier)` | Quest creator | Add delegated verifier |
| `removeVerifier(questId, verifier)` | Quest creator | Remove delegated verifier |
| `finalizeQuest(questId)` | Creator/owner/anyone after deadline | End quest, refund unused |
| `cancelQuest(questId)` | Quest creator (no approvals yet) | Cancel and refund (works during pause) |
| `withdrawETH()` | Anyone with balance | Withdraw pending ETH |
| `withdrawToken(tokenAddr)` | Anyone with balance | Withdraw pending ERC-20 |
| `pause() / unpause()` | Owner only | Emergency pause |
| `allowToken(addr) / revokeToken(addr)` | Owner only | Manage ERC-20 whitelist |
| `rescueERC20(token, amount)` | Owner only | Rescue tokens (cannot drain escrow) |
| `setReputationAddress(addr)` | Owner only | Connect to QuintyReputation |

### View Functions

| Function | Returns |
|----------|---------|
| `getQuest(id)` | All quest fields including token |
| `getEntry(questId, entryId)` | Single entry data |
| `getEntryCount(questId)` | Number of entries |
| `getUserSubmission(questId, addr)` | User's entry data |
| `getQuestStats(questId)` | Pending/approved/rejected counts, remainingSlots |
| `pendingBalance(token, user)` | Pending withdrawal amount |
| `questVerifiers(questId, addr)` | Whether address is a verifier |

### Events

```solidity
QuestCreated(id, creator, title, token, perQualifier, maxQualifiers, deadline)
EntrySubmitted(id, solver, ipfsProofCid)
EntryVerified(questId, entryId, verifier, status)
QuestFinalized(id, qualifiers[], totalDistributed)
QuestCancelled(id, refundAmount)
VerifierAdded(questId, verifier)
VerifierRemoved(questId, verifier)
FundsCredited(token, recipient, amount)
Withdrawn(token, recipient, amount)
TokenAllowed(token)
TokenRevoked(token)
```

---

## Contract 3: QuintyReputation.sol (Soulbound Achievement NFTs)

ERC-721 soulbound token (non-transferable). Tracks user statistics and mints achievement badges at milestones.

**Owner:** Deployer (retains ownership for caller management). Both Quinty and Quest are authorized callers.

### Record Functions (called by authorized contracts)

| Function | Effect |
|----------|--------|
| `recordSubmission(addr)` | +1 submission count, check solver milestones |
| `recordWin(addr)` | +1 win count, check winner milestones, update leaderboard |
| `recordBountyCreation(addr)` | +1 bounty created count, check creator milestones, update leaderboard |

### Admin Functions

| Function | Access | Description |
|----------|--------|-------------|
| `authorizeCaller(addr)` | Owner only | Allow contract to call record functions |
| `revokeCaller(addr)` | Owner only | Remove caller authorization |

### Achievement Milestones

| Category | Milestones (submissions/wins/bounties) |
|----------|---------------------------------------|
| Solver | 1, 10, 25, 50, 100 |
| Winner | 1, 10, 25, 50, 100 |
| Creator | 1, 10, 25, 50, 100 |
| Season | Monthly Champion (top solver), Monthly Builder (top creator) |

### Key Details

- Tokens are **soulbound** -- transfer reverts, only minting allowed
- Metadata is generated fully on-chain (base64 JSON with SVG or IPFS image)
- Seasons rotate every 30 days
- Uses `onlyAuthorized` modifier (not `onlyOwner`) for record functions

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
Quinty.sol --[authorized caller]--> QuintyReputation.sol (recordSubmission, recordWin, recordBountyCreation)
Quest.sol  --[authorized caller]--> QuintyReputation.sol (recordBountyCreation, recordSubmission)
Quinty.sol --[authorized minter]--> QuintyNFT.sol
```

Deploy order: QuintyReputation -> Quinty -> Quest -> QuintyNFT
Post-deploy:
  quinty.setReputationAddress(reputation)
  quest.setReputationAddress(reputation)
  reputation.authorizeCaller(quinty)
  reputation.authorizeCaller(quest)
  quinty.allowToken(USDC)
  quest.allowToken(USDC)
  nft.authorizeMinter(quinty)

---

## Payment Flow (ETH + ERC-20, Pull-Based)

All payouts use pull-based withdrawals via `pendingWithdrawals` mapping. Users call `withdrawETH()` or `withdrawToken(addr)` to claim.

- **Bounty escrow:** `msg.value` for ETH or `safeTransferFrom` for ERC-20 on `createBounty()`
- **Submission deposit:** 1% of bounty amount (ETH via `msg.value`, ERC-20 via `safeTransferFrom`)
- **Winner payout:** Credits via `_credit()` in `selectWinners()`
- **Slash payout:** Credits via `_credit()` in `triggerSlash()`
- **Quest escrow:** `msg.value` for ETH or `safeTransferFrom` for ERC-20 on `createQuest()`
- **Quest reward:** Credits via `_credit()` in `verifyEntry()` approval
- **Token whitelist:** `address(0)` = ETH (always allowed), ERC-20 must be whitelisted by owner
- **Rescue:** Owner can rescue accidentally sent ERC-20 tokens that exceed `totalEscrowed`

---

## Frontend Integration

### Required Files

ABIs are exported to `exported-abis/`:
- `Quinty.json` -- Bounty contract ABI
- `Quest.json` -- Quest contract ABI
- `all-abis.json` -- All ABIs in one file
- `constants.ts` -- Contract addresses, enums, USDC address

### Integration Pattern (ethers.js / viem)

```typescript
import { BASE_SEPOLIA_ADDRESSES, ETH_ADDRESS, USDC_BASE_SEPOLIA } from "./exported-abis/constants";

// Create ETH bounty (single winner)
await quintyContract.createBounty(
  title, desc, openDeadline, judgingDeadline, slashPercent,
  [prizeAmount],  // prizes array
  ETH_ADDRESS,    // token (address(0) for ETH)
  { value: prizeAmount }
);

// Create ERC-20 bounty (multi-winner)
await usdcContract.approve(quintyAddress, totalPrizes);
await quintyContract.createBounty(
  title, desc, openDeadline, judgingDeadline, slashPercent,
  [prize1, prize2, prize3],  // ranked prizes
  USDC_BASE_SEPOLIA          // USDC token address
);

// Submit to bounty (1% deposit)
const deposit = await quintyContract.getRequiredDeposit(bountyId);
await quintyContract.submitToBounty(bountyId, ipfsCid, { value: deposit });

// Select winners (ranked by submission ID)
await quintyContract.selectWinners(bountyId, [subId1, subId2, subId3]);

// Withdraw winnings
await quintyContract.withdrawETH();
// or for ERC-20:
await quintyContract.withdrawToken(USDC_BASE_SEPOLIA);

// Create ETH quest
await questContract.createQuest(
  title, desc, perQualifier, maxQualifiers, deadline, requirements,
  ETH_ADDRESS, { value: perQualifier * maxQualifiers }
);

// Submit quest entry (no deposit)
await questContract.submitEntry(questId, ipfsCid);

// Verify quest entry (creator or delegated verifier)
await questContract.verifyEntry(questId, entryId, 1, "Approved!");

// Withdraw quest reward
await questContract.withdrawETH();
```

---

## Environment Variables

```env
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key_without_0x
```

---

## Security Features (V3)

- **Pausable:** Owner can pause/unpause. Pauses createBounty, submitToBounty, selectWinners, triggerSlash, createQuest, submitEntry, verifyEntry. Does NOT pause withdrawals, cancelQuest, or refundNoSubmissions.
- **Pull Withdrawals:** No push payments. All funds credited to `pendingWithdrawals` mapping, users pull via `withdrawETH()`/`withdrawToken()`.
- **ReentrancyGuard:** On all state-changing functions.
- **SafeERC20:** All ERC-20 transfers use `safeTransfer`/`safeTransferFrom`.
- **Token Whitelist:** Only owner-approved ERC-20 tokens can be used.
- **Rescue ERC20:** Owner can rescue accidentally sent tokens, but cannot drain active escrow (`totalEscrowed` tracking).
- **Self-Approval Prevention:** Quest verifiers cannot approve their own entries.
- **Modifier Ordering:** `whenNotPaused` first, then `nonReentrant`.
