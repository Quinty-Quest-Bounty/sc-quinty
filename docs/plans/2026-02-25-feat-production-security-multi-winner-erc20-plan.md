---
title: "feat: Production Security Upgrade + Multi-Winner + ERC-20"
type: feat
status: completed
date: 2026-02-25
origin: docs/brainstorms/2026-02-25-production-security-upgrade-brainstorm.md
---

# Production Security Upgrade + Multi-Winner Bounties + ERC-20 Support

## Overview

Major upgrade to the Quinty smart contract system on Base Sepolia. Four pillars:

1. **Security hardening** -- Pausable, pull-based withdrawals, fix stuck-funds vulnerabilities
2. **Multi-winner bounties** -- N winners with declared prize tiers at creation
3. **ERC-20 token support** -- Owner-managed whitelist (USDC, etc.) alongside native ETH
4. **Code cleanup** -- Remove AirdropBounty, social accounts, legacy references

All decisions carried forward from brainstorm (see brainstorm: `docs/brainstorms/2026-02-25-production-security-upgrade-brainstorm.md`).

---

## Implementation Phases

### Phase 1: Cleanup & Foundation

Delete legacy code and prepare base infrastructure.

#### 1.1 Delete AirdropBounty and Legacy Files

- [x] Delete `contracts/AirdropBounty.sol`
- [x] Delete `test/AirdropBounty.test.ts`
- [x] Delete `exported-abis/AirdropBounty.json`
- [x] Delete `scripts/list-airdrops.ts`
- [x] Delete `typechain-types/contracts/AirdropBounty.ts`
- [x] Delete `typechain-types/factories/contracts/AirdropBounty__factory.ts`
- [x] Update `exported-abis/constants.ts` -- remove `AirdropBounty` field from `ContractAddresses` interface and `BASE_SEPOLIA_ADDRESSES`
- [x] Update `scripts/export-abis.ts` -- remove AirdropBounty from artifact list
- [x] Update `scripts/deploy.ts` -- remove AirdropBounty deployment
- [x] Update all scripts that reference "airdrop": deleted 9 legacy scripts (`check-all.ts`, `check-state.ts`, `complete-flow.ts`, `inspect-subs.ts`, `solver-test.ts`, `sync-abis.ts`, `test-full-flow.ts`, `test-interaction.ts`, `create-active-quest.ts`), updated `setup-contracts.ts` addresses
- [x] Run `npx hardhat compile` to regenerate typechain without AirdropBounty
- [x] Run `npx hardhat test` -- 73 tests pass

#### 1.2 Remove SocialAccount from Contracts

- [x] `contracts/Quinty.sol` -- Remove `SocialAccount` struct, `socialAccounts` mapping, `linkSocialAccount()` function, `SocialAccountLinked` event, `getSocialAccount()` view function
- [x] `contracts/Quinty.sol` -- Remove `socialHandle` parameter from `submitToBounty()` and `Submission` struct. Keep only `ipfsCid`.
- [x] `contracts/Quinty.sol` -- Remove auto-link logic inside `submitToBounty()`
- [x] `contracts/Quest.sol` -- Same removal: `SocialAccount` struct, mapping, `linkSocialAccount()`, event, `getSocialAccount()`
- [x] `contracts/Quest.sol` -- Remove `socialHandle` from `submitEntry()` and `Entry` struct
- [x] Update `SubmissionCreated` event in Quinty.sol -- remove `socialHandle` field
- [x] Update `EntrySubmitted` event in Quest.sol -- remove `socialHandle` field
- [x] Update all tests to remove `socialHandle` arguments from submit calls
- [x] Compile + test -- 70 tests pass

#### 1.3 Remove `receive()` from Non-Escrow Contracts

- [x] `contracts/QuintyReputation.sol` -- No `receive()` found, already clean
- [x] `contracts/QuintyNFT.sol` -- No `receive()` found, already clean
- [x] Compile + test -- confirmed

---

### Phase 2: Security Infrastructure

#### 2.1 Add Pausable to Quinty.sol

```solidity
// contracts/Quinty.sol
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Quinty is Ownable, ReentrancyGuard, Pausable {
    // ...

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
```

Apply `whenNotPaused` modifier to:
- [x] `createBounty()` -- `whenNotPaused nonReentrant`
- [x] `submitToBounty()` -- `whenNotPaused nonReentrant`
- [x] `selectWinners()` -- `whenNotPaused nonReentrant`
- [x] `triggerSlash()` -- `whenNotPaused nonReentrant`
- [x] `moveToJudging()` -- `whenNotPaused`

**NOT paused** (always available):
- `withdraw()` -- users must always be able to pull funds
- `refundNoSubmissions()` -- effectively a refund, should be available
- All view functions

Modifier ordering convention: `whenNotPaused` first, then `nonReentrant` (fail fast on pause check before consuming reentrancy slot).

#### 2.2 Add Pausable to Quest.sol

Same pattern:
- [x] Add `Pausable` inheritance
- [x] Add `pause()`/`unpause()` functions
- [x] Apply `whenNotPaused` to: `createQuest()`, `submitEntry()`, `verifyEntry()`, `verifyMultipleEntries()`, `finalizeQuest()`
- [x] Keep `cancelQuest()` available during pause (it's a refund)
- [x] Keep `withdraw()` available during pause

#### 2.3 Implement Pull-Based Withdrawals in Quinty.sol

Replace all push payments with pull-based credits.

**New state variables:**

```solidity
// token => user => amount
// address(0) = native ETH
mapping(address => mapping(address => uint256)) public pendingWithdrawals;

// Track total escrowed per token (for safe rescueERC20)
mapping(address => uint256) public totalEscrowed;
```

**New events:**

```solidity
event FundsCredited(address indexed token, address indexed recipient, uint256 amount);
event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
```

**New functions:**

```solidity
// contracts/Quinty.sol

/// @notice Withdraw ETH credited to msg.sender
function withdrawETH() external nonReentrant {
    uint256 amount = pendingWithdrawals[address(0)][msg.sender];
    require(amount > 0, "Nothing to withdraw");

    pendingWithdrawals[address(0)][msg.sender] = 0;  // Effect before Interact
    totalEscrowed[address(0)] -= amount;

    (bool ok, ) = payable(msg.sender).call{value: amount}("");
    require(ok, "ETH transfer failed");

    emit Withdrawn(address(0), msg.sender, amount);
}

/// @notice Withdraw ERC-20 credited to msg.sender
function withdrawToken(address _token) external nonReentrant {
    require(_token != address(0), "Use withdrawETH");

    uint256 amount = pendingWithdrawals[_token][msg.sender];
    require(amount > 0, "Nothing to withdraw");

    pendingWithdrawals[_token][msg.sender] = 0;
    totalEscrowed[_token] -= amount;

    IERC20(_token).safeTransfer(msg.sender, amount);

    emit Withdrawn(_token, msg.sender, amount);
}

/// @notice View pending balance for any token
function pendingBalance(address _token, address _user) external view returns (uint256) {
    return pendingWithdrawals[_token][_user];
}
```

**Internal helper:**

```solidity
function _credit(address _token, address _recipient, uint256 _amount) internal {
    pendingWithdrawals[_token][_recipient] += _amount;
    emit FundsCredited(_token, _recipient, _amount);
}
```

**Refactor `selectWinners()`** -- replace all `.call{value:}` pushes with `_credit()` calls.

**Refactor `triggerSlash()`** -- replace push loop with credit loop. Credit dust remainder to creator.

**Refactor `refundNoSubmissions()`** -- credit full escrow to creator.

#### 2.4 Implement Pull-Based Withdrawals in Quest.sol

Same pattern. Refactor:
- [x] `verifyEntry()` on approve: credit solver via `_credit()` instead of push
- [x] `finalizeQuest()`: credit unused escrow to creator via `_credit()`
- [x] `cancelQuest()`: credit full escrow to creator via `_credit()`
- [x] Add `withdrawETH()`, `withdrawToken()`, `pendingBalance()` functions

#### 2.5 Add `rescueERC20` to Quinty.sol and Quest.sol

```solidity
/// @notice Rescue accidentally sent ERC-20 tokens (cannot drain active escrow)
function rescueERC20(address _token, uint256 _amount) external onlyOwner {
    require(_token != address(0), "Cannot rescue ETH");

    uint256 contractBalance = IERC20(_token).balanceOf(address(this));
    uint256 escrowed = totalEscrowed[_token];
    require(_amount <= contractBalance - escrowed, "Cannot drain escrow");

    IERC20(_token).safeTransfer(owner(), _amount);
}
```

#### 2.6 Write Security Tests

File: `test/Quinty.test.ts` (extend existing)

- [x] Test `pause()` / `unpause()` by owner
- [x] Test non-owner cannot pause (revert `OwnableUnauthorizedAccount`)
- [x] Test all `whenNotPaused` functions revert with `EnforcedPause` when paused
- [x] Test `withdrawETH()` / `withdrawToken()` work during pause
- [x] Test `refundNoSubmissions()` works during pause
- [x] Test pull withdrawal: credit amounts are correct after `selectWinners()`
- [x] Test pull withdrawal: credit amounts are correct after `triggerSlash()`
- [x] Test `rescueERC20` cannot drain active escrow
- [x] Test `rescueERC20` can rescue accidentally sent tokens

---

### Phase 3: ERC-20 Token Support

#### 3.1 Token Whitelist (Quinty.sol)

```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

// Whitelist
mapping(address => bool) public allowedTokens;

event TokenAllowed(address indexed token);
event TokenRevoked(address indexed token);

function allowToken(address _token) external onlyOwner {
    require(_token != address(0), "Use address(0) for ETH");
    allowedTokens[_token] = true;
    emit TokenAllowed(_token);
}

function revokeToken(address _token) external onlyOwner {
    allowedTokens[_token] = false;
    emit TokenRevoked(_token);
}

modifier onlyAllowedToken(address _token) {
    require(_token == address(0) || allowedTokens[_token], "Token not allowed");
    _;
}
```

Note: Using `mapping(address => bool)` instead of `EnumerableSet` for simplicity. `address(0)` is implicitly always allowed (native ETH). Whitelist check applies only to `createBounty`/`createQuest`, NOT to `withdraw` (see brainstorm: users must always be able to withdraw).

#### 3.2 Update Bounty Struct

```solidity
struct Bounty {
    address creator;
    string title;
    string description;
    address token;            // NEW: address(0) for ETH, token address for ERC-20
    uint256[] prizes;         // NEW: [rank1Amount, rank2Amount, ...] replaces single `amount`
    uint256 totalAmount;      // NEW: sum of prizes (computed at creation)
    uint256 openDeadline;
    uint256 judgingDeadline;
    uint256 slashPercent;
    BountyStatus status;
    Submission[] submissions;
    uint256 totalDeposits;

    // REMOVED: selectedWinner, selectedSubmissionId (replaced by multi-winner)
}

struct Submission {
    address submitter;
    string ipfsCid;
    uint256 deposit;
    uint256 timestamp;
    // REMOVED: socialHandle
}
```

#### 3.3 Update `createBounty()`

```solidity
function createBounty(
    string memory _title,
    string memory _description,
    uint256 _openDeadline,
    uint256 _judgingDeadline,
    uint256 _slashPercent,
    uint256[] calldata _prizes,     // NEW
    address _token                   // NEW: address(0) for ETH
) external payable whenNotPaused nonReentrant onlyAllowedToken(_token) {
    require(bytes(_title).length > 0, "Empty title");
    require(_prizes.length > 0, "No prizes");
    require(_prizes.length <= 10, "Max 10 winners");
    require(_openDeadline > block.timestamp, "Open deadline must be future");
    require(_judgingDeadline > _openDeadline, "Judging must be after open");
    require(_judgingDeadline <= block.timestamp + 365 days, "Max 365 days");
    require(_slashPercent >= 2500 && _slashPercent <= 5000, "Slash 25-50%");

    uint256 total = 0;
    for (uint256 i = 0; i < _prizes.length; ) {
        require(_prizes[i] > 0, "Prize must be > 0");
        total += _prizes[i];
        unchecked { ++i; }
    }

    // Receive payment
    if (_token == address(0)) {
        require(msg.value == total, "ETH amount mismatch");
    } else {
        require(msg.value == 0, "Do not send ETH for token bounty");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), total);
    }

    totalEscrowed[_token] += total;

    bountyCounter++;
    Bounty storage b = bounties[bountyCounter];
    b.creator = msg.sender;
    b.title = _title;
    b.description = _description;
    b.token = _token;
    b.totalAmount = total;
    b.openDeadline = _openDeadline;
    b.judgingDeadline = _judgingDeadline;
    b.slashPercent = _slashPercent;
    b.status = BountyStatus.OPEN;

    // Copy prizes array
    for (uint256 i = 0; i < _prizes.length; ) {
        b.prizes.push(_prizes[i]);
        unchecked { ++i; }
    }

    // Record in reputation
    if (reputationAddress != address(0)) {
        IQuintyReputation(reputationAddress).recordBountyCreation(msg.sender);
    }

    emit BountyCreated(bountyCounter, msg.sender, _title, total, _openDeadline, _judgingDeadline, _slashPercent);
}
```

#### 3.4 Update `submitToBounty()`

```solidity
function submitToBounty(
    uint256 _bountyId,
    string memory _ipfsCid
    // REMOVED: socialHandle
) external payable validBounty(_bountyId) whenNotPaused nonReentrant {
    Bounty storage b = bounties[_bountyId];
    require(b.status == BountyStatus.OPEN, "Not open");
    require(block.timestamp <= b.openDeadline, "Submissions closed");
    require(bytes(_ipfsCid).length > 0, "Empty IPFS CID");
    require(!hasSubmitted[_bountyId][msg.sender], "Already submitted");
    require(msg.sender != b.creator, "Creator cannot submit");

    uint256 deposit = b.totalAmount * DEPOSIT_PERCENT / 10000;

    // Receive deposit
    if (b.token == address(0)) {
        require(msg.value == deposit, "Incorrect deposit");
    } else {
        require(msg.value == 0, "Do not send ETH");
        IERC20(b.token).safeTransferFrom(msg.sender, address(this), deposit);
    }

    totalEscrowed[b.token] += deposit;
    b.totalDeposits += deposit;
    hasSubmitted[_bountyId][msg.sender] = true;

    b.submissions.push(Submission({
        submitter: msg.sender,
        ipfsCid: _ipfsCid,
        deposit: deposit,
        timestamp: block.timestamp
    }));

    uint256 subId = b.submissions.length - 1;

    if (reputationAddress != address(0)) {
        IQuintyReputation(reputationAddress).recordSubmission(msg.sender);
    }

    emit SubmissionCreated(_bountyId, subId, msg.sender, _ipfsCid, deposit);
}
```

#### 3.5 Implement `selectWinners()` (Multi-Winner)

```solidity
/// @notice Select multiple winners. submissionIds ordered by rank (index 0 = rank 1).
///         If fewer winners than prize tiers, unused prizes refunded to creator.
function selectWinners(
    uint256 _bountyId,
    uint256[] calldata _submissionIds
) external validBounty(_bountyId) onlyCreator(_bountyId) whenNotPaused nonReentrant {
    Bounty storage b = bounties[_bountyId];

    // Auto-move to judging if deadline passed
    if (b.status == BountyStatus.OPEN && block.timestamp > b.openDeadline) {
        b.status = BountyStatus.JUDGING;
        emit BountyMovedToJudging(_bountyId);
    }

    require(b.status == BountyStatus.JUDGING, "Not in judging");
    require(block.timestamp <= b.judgingDeadline, "Judging deadline passed");
    require(_submissionIds.length > 0, "No winners");
    require(_submissionIds.length <= b.prizes.length, "Too many winners");

    b.status = BountyStatus.RESOLVED;

    // Validate no duplicate submission IDs
    for (uint256 i = 0; i < _submissionIds.length; ) {
        require(_submissionIds[i] < b.submissions.length, "Invalid submission ID");
        for (uint256 j = 0; j < i; ) {
            require(_submissionIds[i] != _submissionIds[j], "Duplicate winner");
            unchecked { ++j; }
        }
        unchecked { ++i; }
    }

    // Track which submitters are winners (for deposit refund logic)
    mapping(address => bool) storage isWinner;
    // Note: cannot use mapping in memory. Use a different approach:
    // Mark winners in a local array instead.

    address[] memory winners = new address[](_submissionIds.length);
    uint256 usedPrizes = 0;

    // Credit prize + deposit to each winner
    for (uint256 i = 0; i < _submissionIds.length; ) {
        Submission storage sub = b.submissions[_submissionIds[i]];
        winners[i] = sub.submitter;

        uint256 prize = b.prizes[i];
        _credit(b.token, sub.submitter, prize + sub.deposit);
        totalEscrowed[b.token] -= (prize + sub.deposit);
        usedPrizes += prize;
        sub.deposit = 0;  // Mark as paid

        if (reputationAddress != address(0)) {
            IQuintyReputation(reputationAddress).recordWin(sub.submitter);
        }

        unchecked { ++i; }
    }

    // Refund deposits to non-winners
    for (uint256 i = 0; i < b.submissions.length; ) {
        Submission storage sub = b.submissions[i];
        if (sub.deposit > 0) {
            // Still has deposit = not a winner
            _credit(b.token, sub.submitter, sub.deposit);
            totalEscrowed[b.token] -= sub.deposit;
            sub.deposit = 0;
        }
        unchecked { ++i; }
    }

    // Refund unused prize tiers to creator
    uint256 unusedPrizes = b.totalAmount - usedPrizes;
    if (unusedPrizes > 0) {
        _credit(b.token, b.creator, unusedPrizes);
        totalEscrowed[b.token] -= unusedPrizes;
    }

    emit WinnersSelected(_bountyId, winners, _submissionIds);
}
```

#### 3.6 Refactor `triggerSlash()` (Pull-Based)

```solidity
function triggerSlash(uint256 _bountyId) external validBounty(_bountyId) whenNotPaused nonReentrant {
    Bounty storage b = bounties[_bountyId];

    // Auto-move to judging if needed
    if (b.status == BountyStatus.OPEN && block.timestamp > b.openDeadline) {
        b.status = BountyStatus.JUDGING;
        emit BountyMovedToJudging(_bountyId);
    }

    require(b.status == BountyStatus.JUDGING, "Not in judging");
    require(block.timestamp > b.judgingDeadline, "Deadline not passed");
    require(b.submissions.length > 0, "No submissions");

    b.status = BountyStatus.SLASHED;

    uint256 slashAmount = b.totalAmount * b.slashPercent / 10000;
    uint256 refundToCreator = b.totalAmount - slashAmount;
    uint256 submitterCount = b.submissions.length;
    uint256 slashPerSubmitter = slashAmount / submitterCount;
    uint256 remainder = slashAmount - (slashPerSubmitter * submitterCount);

    // Credit slash + deposit to each submitter
    for (uint256 i = 0; i < submitterCount; ) {
        Submission storage sub = b.submissions[i];
        uint256 payout = slashPerSubmitter + sub.deposit;

        // Last submitter gets the dust remainder
        if (i == submitterCount - 1) {
            payout += remainder;
        }

        _credit(b.token, sub.submitter, payout);
        totalEscrowed[b.token] -= payout;
        sub.deposit = 0;

        unchecked { ++i; }
    }

    // Credit creator refund
    _credit(b.token, b.creator, refundToCreator);
    totalEscrowed[b.token] -= refundToCreator;

    emit BountySlashed(_bountyId, slashAmount, refundToCreator);
}
```

#### 3.7 Update Quest.sol for ERC-20

Same token pattern as Quinty:
- [x] Add `token` field to `QuestData` struct
- [x] Add token whitelist (`allowedTokens` mapping + `allowToken`/`revokeToken`)
- [x] Update `createQuest()` to accept `_token` parameter, use `safeTransferFrom` for ERC-20
- [x] Update `verifyEntry()` to credit via `_credit()` instead of push
- [x] Update `finalizeQuest()` and `cancelQuest()` to use `_credit()`
- [x] Add `withdrawETH()`, `withdrawToken()`, `pendingBalance()`
- [x] Add `rescueERC20()`
- [x] Add `totalEscrowed` tracking

#### 3.8 Write ERC-20 Tests

File: `test/Quinty.test.ts` (extend)

- [x] Deploy a mock ERC-20 token for testing
- [x] Test `allowToken()` / `revokeToken()` by owner
- [x] Test creating bounty with ERC-20 token
- [x] Test creating bounty with non-whitelisted token reverts
- [x] Test submitting to ERC-20 bounty (approve + submit)
- [x] Test `selectWinners()` credits correct ERC-20 amounts
- [x] Test `withdrawToken()` transfers ERC-20 to user
- [x] Test `triggerSlash()` with ERC-20 bounty
- [x] Test cannot send ETH for ERC-20 bounty (and vice versa)
- [x] Test `rescueERC20` with active escrow protection

File: `test/Quest.test.ts` (extend)
- [x] Same pattern for Quest ERC-20 tests

---

### Phase 4: Quest Enhancements

#### 4.1 Delegated Verifiers

```solidity
// In Quest.sol
// questId => verifier address => isAuthorized
mapping(uint256 => mapping(address => bool)) public questVerifiers;

event VerifierAdded(uint256 indexed questId, address indexed verifier);
event VerifierRemoved(uint256 indexed questId, address indexed verifier);

function addVerifier(uint256 _questId, address _verifier) external {
    require(msg.sender == quests[_questId].creator, "Not quest creator");
    require(_verifier != address(0), "Zero address");
    questVerifiers[_questId][_verifier] = true;
    emit VerifierAdded(_questId, _verifier);
}

function removeVerifier(uint256 _questId, address _verifier) external {
    require(msg.sender == quests[_questId].creator, "Not quest creator");
    questVerifiers[_questId][_verifier] = false;
    emit VerifierRemoved(_questId, _verifier);
}

modifier onlyQuestVerifier(uint256 _questId) {
    require(
        msg.sender == quests[_questId].creator ||
        questVerifiers[_questId][msg.sender],
        "Not authorized verifier"
    );
    _;
}
```

Update `verifyEntry()` and `verifyMultipleEntries()`:
- [x] Replace `onlyCreator` with `onlyQuestVerifier`
- [x] Add self-approval check: `require(msg.sender != entries[_questId][_entryId].solver, "Cannot verify own entry")`

#### 4.2 Quest Reputation Integration

**Problem:** `QuintyReputation` uses `onlyOwner` and ownership is transferred to Quinty.sol. Quest.sol cannot call it.

**Solution:** Replace `onlyOwner` on record functions with authorized callers pattern:

```solidity
// In QuintyReputation.sol
mapping(address => bool) public authorizedCallers;

event CallerAuthorized(address indexed caller);
event CallerRevoked(address indexed caller);

modifier onlyAuthorized() {
    require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
    _;
}

function authorizeCaller(address _caller) external onlyOwner {
    authorizedCallers[_caller] = true;
    emit CallerAuthorized(_caller);
}

function revokeCaller(address _caller) external onlyOwner {
    authorizedCallers[_caller] = false;
    emit CallerRevoked(_caller);
}
```

Change `recordSubmission`, `recordWin`, `recordBountyCreation` from `onlyOwner` to `onlyAuthorized`.

**Deploy script update:**
```typescript
// Post-deploy wiring:
await reputation.authorizeCaller(quintyAddress);
await reputation.authorizeCaller(questAddress);
// Ownership stays with deployer (for future caller management)
// Do NOT transferOwnership to Quinty anymore
```

**Quest reputation mapping:**
- Quest submission → `recordSubmission(solver)` -- counts toward solver milestones
- Quest approval → NO `recordWin()` call (quests are simpler tasks, not competitive wins)
- Quest creation → `recordBountyCreation(creator)` -- counts toward creator milestones

#### 4.3 Write Quest Enhancement Tests

File: `test/Quest.test.ts` (extend)

- [x] Test adding/removing delegated verifiers
- [x] Test delegated verifier can approve entries
- [x] Test delegated verifier cannot approve own submission
- [x] Test non-verifier cannot approve
- [x] Test quest reputation integration (submission count, creator count)
- [x] Test quest approval does NOT trigger `recordWin`

---

### Phase 5: Multi-Winner Tests & Edge Cases

File: `test/Quinty.test.ts` (new describe blocks)

#### 5.1 Multi-Winner Core Tests

- [x] Create bounty with 3 prize tiers [1000, 500, 250]
- [x] Select 3 winners -- verify each gets correct prize + deposit
- [x] Verify non-winners get deposit refund via withdrawal
- [x] Verify all funds withdrawable via `withdrawETH()` / `withdrawToken()`

#### 5.2 Multi-Winner Edge Cases

- [x] Select fewer winners than prize slots (2 of 3) -- unused prize refunded to creator
- [x] Select 1 winner for 1-prize bounty (backwards compatible behavior)
- [x] Empty winners array reverts
- [x] Duplicate submission ID in winners array reverts
- [x] Invalid submission ID reverts
- [x] More winners than prize slots reverts

#### 5.3 Slash Edge Cases

- [x] Slash with dust remainder -- last submitter gets extra wei
- [x] Slash with single submitter -- gets full slash amount
- [x] Slash with ERC-20 token -- correct token credited

#### 5.4 Withdrawal Tests

- [x] Withdraw ETH after winning bounty
- [x] Withdraw ERC-20 after winning bounty
- [x] Withdraw with zero balance reverts
- [x] Multiple withdrawals (win 2 bounties, withdraw once gets cumulative)
- [x] Withdraw during pause works

---

### Phase 6: Deploy Script & ABI Export Update

#### 6.1 Update `scripts/deploy.ts`

```typescript
// New deployment order:
// 1. QuintyReputation (keep deployer as owner)
// 2. Quinty
// 3. Quest
// 4. QuintyNFT
// 5. Post-deploy wiring:
//    - quinty.setReputationAddress(reputation)
//    - reputation.authorizeCaller(quinty)    // NEW: instead of transferOwnership
//    - reputation.authorizeCaller(quest)     // NEW: quest can record reputation
//    - nft.authorizeMinter(quinty)
//    - quinty.allowToken(USDC_BASE_SEPOLIA)  // Whitelist USDC
//    - quest.allowToken(USDC_BASE_SEPOLIA)   // Whitelist USDC on Quest too
```

**USDC Base Sepolia address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals, official Circle deployment)

#### 6.2 Update `scripts/export-abis.ts`

- [x] Remove AirdropBounty from artifact list
- [x] Update `constants.ts` template: remove AirdropBounty, add USDC address constant

#### 6.3 Update `exported-abis/constants.ts`

```typescript
export interface ContractAddresses {
  Quinty: string;
  Quest: string;
  QuintyReputation: string;
  QuintyNFT: string;
}

export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = { ... };

export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
```

---

## System-Wide Impact

### Interaction Graph

```
User -> Quinty.createBounty() -> IERC20.transferFrom() [if ERC-20]
                               -> QuintyReputation.recordBountyCreation()

User -> Quinty.submitToBounty() -> IERC20.transferFrom() [if ERC-20]
                                -> QuintyReputation.recordSubmission()

Creator -> Quinty.selectWinners() -> _credit() to pendingWithdrawals
                                  -> QuintyReputation.recordWin()

Anyone -> Quinty.triggerSlash() -> _credit() to pendingWithdrawals

User -> Quinty.withdrawETH() -> .call{value}()
User -> Quinty.withdrawToken() -> IERC20.safeTransfer()

User -> Quest.createQuest() -> IERC20.transferFrom() [if ERC-20]
                             -> QuintyReputation.recordBountyCreation()

User -> Quest.submitEntry() -> QuintyReputation.recordSubmission()

Verifier -> Quest.verifyEntry() -> _credit() on approve

Owner -> Quinty.pause() / unpause()
Owner -> Quest.pause() / unpause()
Owner -> Quinty.allowToken() / revokeToken()
Owner -> Quinty.rescueERC20()
```

### Error Propagation

| Error Source | Handler | Behavior |
|---|---|---|
| ERC-20 transferFrom fails (no approval) | Reverts entire tx | User sees "SafeERC20: low-level call failed" |
| Withdraw ETH fails (recipient reverts) | Reverts withdraw tx only | User retries or uses different wallet |
| Reputation call fails | Reverts bounty creation/submission | This is a risk -- consider try/catch |

### State Lifecycle Risks

| Risk | Mitigation |
|---|---|
| Partial `selectWinners` failure | Atomic: all credits happen in one tx |
| `totalEscrowed` desync | Increment on receive, decrement on credit. Test invariant: `totalEscrowed[token] == sum(all active escrows + pending withdrawals)` |
| Pause during judging | Slash disabled during pause; `refundNoSubmissions` allowed |

---

## Acceptance Criteria

### Functional Requirements

- [x] Bounty with 1-10 prize tiers works end-to-end (ETH and USDC)
- [x] 1% deposit based on total bounty amount
- [x] Winner selection credits correct prizes per rank
- [x] Fewer winners than prizes refunds unused to creator
- [x] Slash distributes correctly with dust to last submitter
- [x] Pull-based withdrawal works for ETH and ERC-20
- [x] Pause blocks all operations except withdraw and view
- [x] Token whitelist: only whitelisted tokens for creation, always withdrawable
- [x] Quest with delegated verifiers works
- [x] Quest reputation integration (submissions, creation)
- [x] Self-approval check on quest verification
- [x] `rescueERC20` cannot drain active escrow
- [x] All AirdropBounty/social account code removed
- [x] No `receive()` on non-escrow contracts

### Quality Gates

- [x] All new tests pass (`npx hardhat test`) -- 115 passing
- [x] Zero compiler warnings (except existing unused param in QuintyReputation)
- [x] CLAUDE.md updated with new contract interfaces
- [x] ABIs exported and constants updated
- [x] Deploy script updated with new wiring pattern

---

## Dependencies & Prerequisites

- OpenZeppelin v5.4.0 already installed (has Pausable, SafeERC20, IERC20)
- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- No new npm packages needed

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-25-production-security-upgrade-brainstorm.md](../brainstorms/2026-02-25-production-security-upgrade-brainstorm.md)
- Key decisions: pull-based withdrawal, global pause, fixed prize tiers, ERC-20 whitelist, delegated verifiers, remove social accounts

### Internal References

- Current Quinty.sol: `contracts/Quinty.sol`
- Current Quest.sol: `contracts/Quest.sol`
- Current QuintyReputation.sol: `contracts/QuintyReputation.sol`
- Deploy script: `scripts/deploy.ts`
- Test patterns: `test/Quinty.test.ts`, `test/Quest.test.ts`

### External References

- [OpenZeppelin Pausable v5 docs](https://docs.openzeppelin.com/contracts/5.x/api/utils#Pausable)
- [OpenZeppelin SafeERC20 v5 docs](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20)
- [Solidity Pull Over Push Pattern](https://docs.soliditylang.org/en/latest/common-patterns.html)
- [Circle USDC Contract Addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Base Sepolia USDC on BaseScan](https://sepolia.basescan.org/token/0x036cbd53842c5426634e7929541ec2318f3dcf7e)
