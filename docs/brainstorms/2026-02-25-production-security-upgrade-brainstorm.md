# Brainstorm: Production Security Upgrade + Multi-Winner + ERC-20 Support

**Date:** 2026-02-25
**Status:** Approved
**Scope:** Quinty.sol, Quest.sol, QuintyReputation.sol, QuintyNFT.sol

---

## What We're Building

A production-grade upgrade to the Quinty smart contract system with four major pillars:

1. **Security hardening** -- Pausable emergency mechanism, pull-based withdrawals, fix stuck-funds vulnerabilities
2. **Multi-winner bounties** -- Creators declare N winners with specific prize per rank at creation time
3. **ERC-20 token support** -- Whitelisted tokens (USDC, etc.) alongside native ETH, chosen per-bounty
4. **Code cleanup** -- Remove on-chain social accounts (move off-chain), delete legacy AirdropBounty.sol

---

## Why This Approach

### Pull-based withdrawals (over push payments)
Push-payment loops are the #1 vulnerability in the current code. If any recipient is a contract that reverts on receive, funds get stuck permanently. Pull-based withdrawal is the industry-standard pattern (used by OpenZeppelin, Uniswap, etc.) and eliminates this entire class of bugs.

### Global pause by owner (over per-bounty or multi-sig)
Simple and effective for an emergency stop. Deadline timers keep running during pause (no complex freeze logic). Slash is disabled during pause to prevent unfair slashing while the system is halted.

### Fixed prize tiers at creation (over mutable)
Submitters need to know exactly what they're competing for before they put down a deposit. Immutable prize tiers = full transparency.

### Whitelisted ERC-20 (over hardcoded USDC)
Owner-managed whitelist allows adding future tokens (DAI, WETH) without contract redeployment. Minimal extra complexity vs hardcoding.

---

## Key Decisions

### 1. Multi-Winner Bounties

| Decision | Choice |
|----------|--------|
| When are prizes declared? | At bounty creation (immutable) |
| Prize structure | Array of amounts per rank: [rank1, rank2, ...rankN] |
| Deposit calculation | 1% of **total bounty amount** (sum of all prizes) |
| Winner selection | Creator calls `selectWinners(bountyId, submissionIds[])` with ordered array |
| Total escrow | Sum of all prize amounts, sent as msg.value (ETH) or approved (ERC-20) |

**Example:**
```
Creator creates bounty with prizes = [1000 USDC, 500 USDC, 250 USDC]
Total escrow = 1750 USDC
Deposit per submitter = 17.5 USDC (1% of 1750)
Creator selects 3 winners in order: [submissionId_7, submissionId_3, submissionId_12]
  - submissionId_7 (rank 1) -> claims 1000 USDC + their 17.5 deposit
  - submissionId_3 (rank 2) -> claims 500 USDC + their 17.5 deposit
  - submissionId_12 (rank 3) -> claims 250 USDC + their 17.5 deposit
  - All other submitters -> claim their 17.5 deposit refund
```

### 2. ERC-20 Token Support

| Decision | Choice |
|----------|--------|
| Token selection | Per-bounty/quest: creator chooses ETH or one whitelisted ERC-20 |
| Whitelist management | Owner can add/remove allowed token addresses |
| ETH representation | `address(0)` in the token field means native ETH |
| Deposit token | Same token as the bounty (if bounty is USDC, deposit is USDC) |
| Transfer mechanism | `IERC20.transferFrom()` for creation/deposit, credited to `pendingWithdrawals` for claiming |

### 3. Security: Pausable

| Decision | Choice |
|----------|--------|
| Scope | Global pause on all contracts (Quinty, Quest) |
| Who can pause | Contract owner only |
| What's blocked during pause | All mutating functions: create, submit, selectWinners, triggerSlash, verify, finalize |
| What's allowed during pause | View functions, `withdraw()` (so users can still pull their funds) |
| Deadline behavior | Deadlines keep running. Slash disabled while paused. |

### 4. Security: Pull-Based Withdrawals

| Decision | Choice |
|----------|--------|
| Pattern | `pendingWithdrawals[token][address] += amount` then user calls `withdraw(token)` |
| When funds are credited | On `selectWinners()`, `triggerSlash()`, `refundNoSubmissions()`, quest `verifyEntry()` |
| Withdraw during pause | Allowed (users should always be able to pull their funds) |
| ETH withdrawals | `pendingWithdrawals[address(0)][user]` for native ETH |

### 5. Quest.sol Upgrades

| Decision | Choice |
|----------|--------|
| Verification model | Creator + delegated verifiers (creator can assign verifier addresses per quest) |
| ERC-20 support | Same whitelist as Quinty |
| Pause | Same global pause mechanism |
| Pull-based payments | Yes, same pattern as Quinty |
| Reputation integration | Quest activity (submissions, approvals) recorded in QuintyReputation |

### 6. Social Accounts

| Decision | Choice |
|----------|--------|
| On-chain storage | Remove from both Quinty.sol and Quest.sol |
| Social data | Handled off-chain (backend/database) |
| Submission fields | Keep `ipfsCid` only. Remove `socialHandle` parameter. |

### 7. Code Cleanup

| Decision | Choice |
|----------|--------|
| AirdropBounty.sol | Delete from repo (already deployed on-chain, file not needed) |
| `receive()` on non-escrow contracts | Remove from QuintyReputation and QuintyNFT |
| `verified` field in SocialAccount | N/A (social accounts being removed entirely) |
| Unused QuintyNFT authorization | Evaluate if Quinty should mint badges on milestones, or remove |

---

## Vulnerability Fixes Checklist

| Issue | Fix |
|-------|-----|
| Stuck funds on push payment (selectWinner, triggerSlash) | Pull-based withdrawals eliminate this entirely |
| Creator refund revert blocks entire triggerSlash | Pull-based: credit amounts, no revert risk |
| Dust/rounding loss in triggerSlash | Credit remainder to last submitter or to creator |
| `receive()` trapping ETH on non-escrow contracts | Remove `receive()` from QuintyReputation, QuintyNFT |
| No emergency stop | OpenZeppelin Pausable with `whenNotPaused` modifier |
| No admin fund rescue | Owner `rescueERC20(token, amount)` for accidentally sent tokens |
| `moveToJudging()` missing event in triggerSlash auto-transition | Emit event consistently |

---

## Contract Architecture (Post-Upgrade)

```
                    +-------------------+
                    |   Quinty.sol V3   |
                    | Ownable           |
                    | ReentrancyGuard   |
                    | Pausable          |
                    | Multi-winner      |
                    | ERC-20 whitelist  |
                    | Pull withdrawals  |
                    +--------+----------+
                             |
                    setReputationAddress()
                             |
                             v
                    +-------------------+
                    | QuintyReputation  |
                    | (Ownable by       |
                    |  Quinty V3)       |
                    | + Quest tracking  |
                    +-------------------+

                    +-------------------+
                    |   Quest.sol V2    |
                    | Ownable           |
                    | ReentrancyGuard   |
                    | Pausable          |
                    | ERC-20 whitelist  |
                    | Pull withdrawals  |
                    | Delegated verify  |
                    +-------------------+

                    +-------------------+
                    |   QuintyNFT.sol   |
                    | (Unchanged,       |
                    |  remove receive) |
                    +-------------------+

                    DELETED:
                    - AirdropBounty.sol
                    - AirdropBounty.test.ts
                    - AirdropBounty.json (exported ABI)
                    - AirdropBounty typechain-types
                    - SocialAccount structs
                    - list-airdrops.ts (legacy script)
                    - All "airdrop" references in constants, scripts, README
```

---

## Airdrop Cleanup (Confirmed via fe-quinty audit)

Frontend has fully migrated to Quest contract. AirdropBounty references are unused legacy artifacts.

**sc-quinty cleanup:**
- Delete: `contracts/AirdropBounty.sol`, `test/AirdropBounty.test.ts`, `exported-abis/AirdropBounty.json`
- Delete: `typechain-types/contracts/AirdropBounty.ts`, `typechain-types/factories/contracts/AirdropBounty__factory.ts`
- Delete: `scripts/list-airdrops.ts`
- Update: `exported-abis/constants.ts` -- remove `AirdropBounty` field
- Update: `scripts/export-abis.ts`, `scripts/deploy.ts` -- remove airdrop references
- Update: `exported-abis/all-abis.json` -- remove AirdropBounty entry
- Regenerate typechain after contract changes

**fe-quinty cleanup (separate PR):**
- Delete: `contracts/AirdropBounty.json`
- Update: `contracts/constants.ts` -- remove `AirdropBounty` field
- Update: `src/utils/contracts.ts` -- remove `AIRDROP_ABI` import and export

---

## Quest Edge Cases

| Scenario | Behavior |
|----------|----------|
| Submitters < maxQualifiers | `finalizeQuest()` refunds unused escrow to creator. Already works this way. |
| Cancel quest | `cancelQuest()` exists -- only if no entries approved yet. Full refund to creator. Retained in V2. |
| Quest has no slash | Correct by design. Quests are simpler than bounties -- no deposit, no slash. |

---

## Open Questions

None -- all questions resolved during brainstorming session.

---

## Out of Scope

- Multi-sig governance (keep simple owner model for now)
- Rate limiting / cooldown (handle at frontend level)
- On-chain social verification (moved off-chain)
- Cross-chain support
- Upgradeable proxy pattern (contracts are redeployed, not upgraded)
