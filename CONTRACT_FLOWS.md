# Quinty V2 - Contract Interactions & Flows

This document explains how all 9 smart contracts interact with each other and provides detailed flow diagrams for each major feature.

## Table of Contents

- [Contract Architecture](#contract-architecture)
- [Core Bounty Flow](#core-bounty-flow)
- [Oprec (Open Recruitment) Flow](#oprec-open-recruitment-flow)
- [Team Submission Flow](#team-submission-flow)
- [Reputation & Achievement Flow](#reputation--achievement-flow)
- [Grant Program Flow](#grant-program-flow)
- [Crowdfunding Flow](#crowdfunding-flow)
- [Looking For Grant Flow](#looking-for-grant-flow)
- [Airdrop Bounty Flow](#airdrop-bounty-flow)
- [Social Verification Flow](#social-verification-flow)
- [Dispute Resolution Flow](#dispute-resolution-flow)
- [NFT Badge Minting Flow](#nft-badge-minting-flow)

---

## Contract Architecture

### Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Quinty (Core Hub)                     │
│  - Main bounty logic                                     │
│  - Team submissions                                      │
│  - Oprec management                                      │
│  - Winner selection                                      │
│  - Slash mechanism                                       │
└──────────┬────────────┬──────────────┬───────────────────┘
           │            │              │
           ▼            ▼              ▼
  ┌────────────┐  ┌─────────┐  ┌──────────────┐
  │  Quinty    │  │Dispute  │  │  QuintyNFT   │
  │Reputation  │  │Resolver │  │  (Badges)    │
  │(Owned by   │  │(Receives│  │ (Authorized) │
  │  Quinty)   │  │ slash)  │  │              │
  └────────────┘  └─────────┘  └──────┬───────┘
                                       │
            ┌──────────────────────────┼─────────────────┐
            │                          │                 │
            ▼                          ▼                 ▼
    ┌──────────────┐          ┌───────────────┐  ┌─────────────┐
    │ GrantProgram │          │LookingForGrant│  │Crowdfunding │
    │(Authorized)  │          │ (Authorized)  │  │(Authorized) │
    └──────────────┘          └───────────────┘  └─────────────┘

    Standalone Contracts (no dependencies):
    ┌──────────────┐          ┌───────────────────┐
    │AirdropBounty │          │SocialVerification │
    └──────────────┘          └───────────────────┘
```

### Contract Relationships

**Quinty → QuintyReputation**
- Ownership: QuintyReputation owned by Quinty contract
- Calls: `recordSubmission()`, `recordWin()`, `recordBountyCreation()`
- Purpose: Automatic reputation tracking

**Quinty → DisputeResolver**
- Calls: `initiateExpiryVote()` when bounty expires
- Transfers: Slash funds (25-50% of bounty amount)
- Purpose: Community dispute resolution

**Quinty → QuintyNFT**
- Authorization: Quinty authorized to mint badges
- Calls: `mintBadge()` for team member badges
- Purpose: Reward team participants

**GrantProgram/LookingForGrant/Crowdfunding → QuintyNFT**
- Authorization: All three authorized to mint badges
- Calls: `mintBadge()` for respective badge types
- Purpose: Ecosystem participation rewards

---

## Core Bounty Flow

### Standard Bounty Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATOR CREATES BOUNTY                        │
│                                                                  │
│  1. Creator calls createBounty()                                │
│     - Sends full ETH amount (100% escrow)                       │
│     - Sets deadline, slash%, winner shares                      │
│     - Optional: Enable oprec with oprec deadline                │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Stores bounty data on-chain                               │
│     - Sets status = OPEN (or OPREC if enabled)                  │
│     - Emits BountyCreated event                                 │
│                                                                  │
│  3. QuintyReputation:                                           │
│     - Quinty calls recordBountyCreation(creator)                │
│     - Updates creator stats                                     │
│     - Checks if creator reached milestone (1,10,25,50,100)      │
│     - Mints achievement NFT if milestone reached                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SOLVERS SUBMIT SOLUTIONS                        │
│                                                                  │
│  1. Solver calls submitSolution()                               │
│     - Sends 10% deposit (of bounty amount)                      │
│     - Provides IPFS CID (permanently recorded)                  │
│     - Optional: Includes team member addresses                  │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Validates: deadline not passed, status = OPEN             │
│     - If oprec enabled: validates solver is approved            │
│     - Stores submission with IPFS CID (immutable)               │
│     - Marks isTeam = true if team members provided              │
│     - Emits SubmissionCreated event                             │
│                                                                  │
│  3. QuintyReputation:                                           │
│     - Quinty calls recordSubmission(solver)                     │
│     - Updates solver stats                                      │
│     - Checks milestone, mints achievement if reached            │
│                                                                  │
│  Note: Submission IPFS CID is permanently tracked and           │
│        cannot be changed by the submitter                       │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                CREATOR SELECTS WINNERS                           │
│                                                                  │
│  1. Creator calls selectWinners()                               │
│     - Provides winner addresses and submission IDs              │
│     - Can select anytime (before or after deadline)             │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Validates: correct number of winners                      │
│     - Sets status = PENDING_REVEAL                              │
│     - Refunds deposits to all non-winners                       │
│     - Stores selected winners and submission IDs                │
│     - Emits WinnersSelected event                               │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WINNERS REVEAL SOLUTIONS                        │
│                                                                  │
│  1. Winner calls revealSolution()                               │
│     - Provides reveal IPFS CID (detailed solution)              │
│     - Original submission CID remains tracked                   │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Validates: caller is selected winner                      │
│     - Stores reveal CID alongside submission CID                │
│     - Calculates prize amount (based on shares)                 │
│                                                                  │
│     IF SOLO SUBMISSION:                                         │
│     - Transfers prize + deposit to winner                       │
│                                                                  │
│     IF TEAM SUBMISSION:                                         │
│     - Splits prize equally: leader + all team members           │
│     - Splits deposit refund equally                             │
│     - Transfers to each team member                             │
│                                                                  │
│  3. QuintyNFT (if team):                                        │
│     - Quinty calls batchMintBadges()                            │
│     - Mints TeamMember badge to all participants                │
│     - Emits BadgeMinted events                                  │
│                                                                  │
│  4. QuintyReputation:                                           │
│     - Quinty calls recordWin() for each winner                  │
│     - If team: calls for leader + all members                   │
│     - Updates win stats                                         │
│     - Checks milestones, mints achievements                     │
│                                                                  │
│  5. Status Check:                                               │
│     - If all winners revealed: status = RESOLVED                │
│     - Emits BountyResolved event                                │
│     - ✅ Bounty Complete                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Alternative Flow: Bounty Expiry

```
┌─────────────────────────────────────────────────────────────────┐
│                  DEADLINE PASSES WITHOUT WINNER                  │
│                                                                  │
│  1. Anyone calls triggerSlash()                                 │
│     - After deadline passes                                     │
│     - Bounty must be in OPEN status                             │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Sets status = EXPIRED                                     │
│     - Calculates slash: 25-50% of bounty amount                 │
│     - Transfers slash to DisputeResolver                        │
│     - Calls DisputeResolver.initiateExpiryVote()                │
│     - Refunds remaining (50-75%) to creator                     │
│     - Emits BountySlashed event                                 │
│                                                                  │
│  3. DisputeResolver:                                            │
│     - Receives slash funds                                      │
│     - Creates expiry vote for community                         │
│     - Voting period begins (coming soon)                        │
│     - Eventually distributes funds to voters/top submissions    │
│                                                                  │
│  Note: Deposits remain with submitters (no winner selected)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Oprec (Open Recruitment) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               CREATOR ENABLES OPREC ON BOUNTY                    │
│                                                                  │
│  createBounty(..., hasOprec=true, oprecDeadline)                │
│  - Bounty status = OPREC                                        │
│  - Oprec deadline < bounty deadline                             │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  APPLICANTS APPLY TO OPREC                       │
│                                                                  │
│  1. Applicant calls applyToOprec()                              │
│     - Provides work examples (IPFS CID with portfolio)          │
│     - Provides skill description                                │
│     - Optional: Team member addresses (up to 10)                │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Validates: oprec deadline not passed                      │
│     - Validates: team members (max 10, no duplicates)           │
│     - Creates OprecApplication                                  │
│     - Sets status = Pending                                     │
│     - Emits OprecApplicationSubmitted event                     │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               CREATOR REVIEWS & APPROVES/REJECTS                 │
│                                                                  │
│  APPROVE:                                                        │
│  1. Creator calls approveOprecApplications([appIds])            │
│     - Can approve multiple applications at once                 │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Sets application.approved = true                          │
│     - Adds applicant to approvedParticipants mapping            │
│     - Emits OprecApplicationApproved event                      │
│                                                                  │
│  REJECT:                                                         │
│  1. Creator calls rejectOprecApplications([appIds])             │
│     - Can reject multiple at once                               │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Sets application.rejected = true                          │
│     - Emits OprecApplicationRejected event                      │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CREATOR ENDS OPREC PHASE                         │
│                                                                  │
│  1. Creator calls endOprecPhase()                               │
│     - Can call after oprec deadline                             │
│                                                                  │
│  2. Quinty contract:                                            │
│     - Changes status: OPREC → OPEN                              │
│     - Bounty now accepts submissions                            │
│     - Only approved participants can submit                     │
│     - Emits OprecPhaseEnded event                               │
│                                                                  │
│  3. Approved participants:                                      │
│     - Can now call submitSolution()                             │
│     - Must provide 10% deposit                                  │
│     - Follow normal submission flow                             │
│                                                                  │
│  4. Non-approved participants:                                  │
│     - submitSolution() will revert                              │
│     - "Not approved participant" error                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Team Submission Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                TEAM LEADER SUBMITS SOLUTION                      │
│                                                                  │
│  1. Team leader calls submitSolution()                          │
│     - Provides IPFS CID (submission tracked permanently)        │
│     - Provides team member addresses [addr1, addr2, ...]        │
│     - Sends 10% deposit                                         │
│     - Max 10 team members                                       │
│                                                                  │
│  2. Quinty contract validates:                                  │
│     - No duplicate team members                                 │
│     - No zero addresses                                         │
│     - Leader not in team members array                          │
│     - Team size ≤ 10                                            │
│                                                                  │
│  3. Quinty contract stores:                                     │
│     - submission.solver = team leader                           │
│     - submission.teamMembers = [addr1, addr2, ...]              │
│     - submission.isTeam = true                                  │
│     - submission.blindedIpfsCid = provided CID                  │
│     - submission.deposit = 10% of bounty                        │
│                                                                  │
│  4. Emits: SubmissionCreated(..., isTeam=true)                  │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              CREATOR SELECTS TEAM AS WINNER                      │
│                                                                  │
│  - Normal winner selection process                              │
│  - Team leader address in winners array                         │
│  - Submission ID that has isTeam = true                         │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               TEAM LEADER REVEALS SOLUTION                       │
│                                                                  │
│  1. Team leader calls revealSolution()                          │
│     - Provides reveal IPFS CID (detailed solution)              │
│                                                                  │
│  2. Quinty detects isTeam = true                                │
│                                                                  │
│  3. Calculate splits:                                           │
│     totalMembers = teamMembers.length + 1 (leader)              │
│     rewardPerMember = prizeAmount / totalMembers                │
│     depositPerMember = deposit / totalMembers                   │
│                                                                  │
│  4. Distribute rewards:                                         │
│     FOR leader:                                                 │
│       transfer(leader, rewardPerMember + depositPerMember)      │
│                                                                  │
│     FOR each team member:                                       │
│       transfer(member, rewardPerMember + depositPerMember)      │
│                                                                  │
│  5. QuintyNFT.batchMintBadges():                                │
│     allMembers = [leader, member1, member2, ...]                │
│     mintBadge(allMembers, BadgeType.TeamMember, metadata)       │
│     - All participants get TeamMember badge                     │
│                                                                  │
│  6. QuintyReputation.recordWin():                               │
│     FOR leader:                                                 │
│       recordWin(leader)                                         │
│                                                                  │
│     FOR each team member:                                       │
│       recordWin(member)                                         │
│     - All get win statistics updated                            │
│     - All can unlock achievement milestones                     │
│                                                                  │
│  Result: All team members treated equally                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reputation & Achievement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 USER TAKES ACTION IN QUINTY                      │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────┬──────────────────┬─────────────────────────────┐
│Create Bounty │Submit Solution   │Win Bounty                    │
└──────┬───────┴────────┬─────────┴──────────┬──────────────────┘
       │                │                    │
       ▼                ▼                    ▼
┌─────────────┐  ┌──────────────┐  ┌───────────────────┐
│  Quinty     │  │   Quinty     │  │     Quinty        │
│  calls:     │  │   calls:     │  │     calls:        │
│             │  │              │  │                   │
│recordBounty │  │ recordSub    │  │  recordWin()      │
│ Creation()  │  │  mission()   │  │                   │
└──────┬──────┘  └──────┬───────┘  └────────┬──────────┘
       │                │                    │
       │                │                    │
       └────────────────┼────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│            QUINTYREPUTATION CONTRACT LOGIC                       │
│                                                                  │
│  1. Update user stats:                                          │
│     - userStats[user].totalSubmissions++                        │
│     OR userStats[user].totalWins++                              │
│     OR userStats[user].totalBountiesCreated++                   │
│                                                                  │
│  2. Update activity tracking:                                   │
│     - If firstActivity == 0: set to block.timestamp             │
│     - Set lastActivity = block.timestamp                        │
│                                                                  │
│  3. Update season stats:                                        │
│     - Check if current season expired                           │
│     - If expired: end current season, start new season          │
│     - Update seasonStats[currentSeasonId][user]                 │
│     - Update season leaderboards (topSolver, topCreator)        │
│                                                                  │
│  4. Check achievement milestones:                               │
│                                                                  │
│     FOR SOLVER MILESTONES:                                      │
│     if (totalSubmissions >= [1, 10, 25, 50, 100]):              │
│       _mintAchievement(user, FIRST_SOLVER)                      │
│       _mintAchievement(user, ACTIVE_SOLVER)                     │
│       ... etc                                                   │
│                                                                  │
│     FOR WINNER MILESTONES:                                      │
│     if (totalWins >= [1, 10, 25, 50, 100]):                     │
│       _mintAchievement(user, FIRST_WIN)                         │
│       _mintAchievement(user, SKILLED_WINNER)                    │
│       ... etc                                                   │
│                                                                  │
│     FOR CREATOR MILESTONES:                                     │
│     if (totalBountiesCreated >= [1, 10, 25, 50, 100]):          │
│       _mintAchievement(user, FIRST_CREATOR)                     │
│       _mintAchievement(user, ACTIVE_CREATOR)                    │
│       ... etc                                                   │
│                                                                  │
│  5. Mint achievement NFT:                                       │
│     - Check: !hasAchievement[user][achievement]                 │
│     - If new milestone reached:                                 │
│       * tokenCounter++                                          │
│       * _safeMint(user, tokenId)                                │
│       * Set hasAchievement[user][achievement] = true            │
│       * Store achievementTokenIds[user][achievement]            │
│       * Emit AchievementUnlocked event                          │
│                                                                  │
│  6. Season completion:                                          │
│     When season ends (30 days):                                 │
│     - Mint MONTHLY_CHAMPION to topSolver                        │
│     - Mint MONTHLY_BUILDER to topCreator                        │
│     - Start new season automatically                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Grant Program Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                ORGANIZATION CREATES GRANT                        │
│                                                                  │
│  1. Giver calls createGrant()                                   │
│     - Sends total grant funds (ETH)                             │
│     - Sets application/distribution deadlines                   │
│     - Sets max applicants (e.g., 100)                           │
│                                                                  │
│  2. GrantProgram contract:                                      │
│     - Escrows all funds                                         │
│     - Creates grant with status = Open                          │
│     - Emits GrantCreated event                                  │
│                                                                  │
│  3. QuintyNFT:                                                  │
│     - GrantProgram calls mintBadge()                            │
│     - Mints GrantGiver badge to creator                         │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 APPLICANTS SUBMIT APPLICATIONS                   │
│                                                                  │
│  1. Applicant calls applyForGrant()                             │
│     - Provides project details (IPFS CID)                       │
│     - Provides social accounts proof (IPFS CID)                 │
│     - Requests specific amount                                  │
│                                                                  │
│  2. GrantProgram contract:                                      │
│     - Validates: not already applied                            │
│     - Validates: before application deadline                    │
│     - Validates: requested amount ≤ total funds                 │
│     - Creates Application with status = Pending                 │
│     - Sets hasApplied[grantId][applicant] = true                │
│     - Emits ApplicationSubmitted event                          │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              GIVER APPROVES SELECTED APPLICATIONS                │
│                                                                  │
│  1. Giver calls approveApplications()                           │
│     - Provides application IDs to approve                       │
│     - Provides approved amounts for each (can differ from       │
│       requested amounts)                                        │
│                                                                  │
│  2. GrantProgram contract validates:                            │
│     - Arrays same length                                        │
│     - Total approved ≤ grant funds                              │
│     - Selected count ≤ max applicants                           │
│     - Applications still pending                                │
│                                                                  │
│  3. For each approval:                                          │
│     - Set application.status = Approved                         │
│     - Add to selectedRecipients[]                               │
│     - Set recipientAmounts[applicant] = approved amount         │
│     - Emit ApplicationApproved event                            │
│                                                                  │
│  4. Update grant status:                                        │
│     - If first approval: status = SelectionPhase                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               GIVER FINALIZES SELECTION                          │
│                                                                  │
│  1. Giver calls finalizeSelection()                             │
│     - After reviewing all applications                          │
│                                                                  │
│  2. GrantProgram contract:                                      │
│     - Validates: status = SelectionPhase                        │
│     - Validates: at least one recipient selected                │
│     - Changes status: SelectionPhase → Active                   │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              RECIPIENTS CLAIM THEIR GRANTS                       │
│                                                                  │
│  1. Recipient calls claimGrant()                                │
│                                                                  │
│  2. GrantProgram contract validates:                            │
│     - Grant status = Active                                     │
│     - Caller is selected recipient                              │
│     - Not already claimed                                       │
│                                                                  │
│  3. Grant distribution:                                         │
│     amount = recipientAmounts[msg.sender]                       │
│     hasClaimed[msg.sender] = true                               │
│     fundsDistributed += amount                                  │
│     transfer(msg.sender, amount)                                │
│     Emit FundsClaimed event                                     │
│                                                                  │
│  4. QuintyNFT:                                                  │
│     - GrantProgram calls mintBadge()                            │
│     - Mints GrantRecipient badge to claimant                    │
│                                                                  │
│  5. Check completion:                                           │
│     - If all recipients claimed:                                │
│       * status = Completed                                      │
│       * Emit GrantCompleted event                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Crowdfunding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               CREATOR LAUNCHES CAMPAIGN                          │
│                                                                  │
│  1. Creator calls createCampaign()                              │
│     - Sets funding goal (e.g., 10 ETH)                          │
│     - Sets deadline                                             │
│     - Defines milestones with amounts                           │
│     - Milestone amounts must sum to funding goal                │
│                                                                  │
│  2. Crowdfunding contract validates:                            │
│     - Milestones sum exactly to goal                            │
│     - Milestone arrays same length                              │
│     - Deadline in future but < 365 days                         │
│                                                                  │
│  3. Create campaign:                                            │
│     - status = Active                                           │
│     - Create milestone structs                                  │
│     - Emit CampaignCreated event                                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKERS CONTRIBUTE                              │
│                                                                  │
│  1. Backer calls contribute()                                   │
│     - Sends ETH amount                                          │
│                                                                  │
│  2. Crowdfunding contract:                                      │
│     - Validates: campaign Active, before deadline               │
│     - Records contribution                                      │
│     - Updates donorContributions[backer]                        │
│     - Updates totalRaised                                       │
│     - Emit ContributionReceived event                           │
│                                                                  │
│  3. QuintyNFT (first contribution only):                        │
│     - If donorContributions[backer] == msg.value:               │
│       * Crowdfunding calls mintBadge()                          │
│       * Mints CrowdfundingDonor badge                           │
│                                                                  │
│  4. Check if goal reached:                                      │
│     - If totalRaised >= fundingGoal:                            │
│       * status = Successful                                     │
│       * Emit CampaignSuccessful event                           │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                FINALIZE AFTER DEADLINE                           │
│                                                                  │
│  Anyone calls finalizeCampaign() after deadline:                │
│                                                                  │
│  IF totalRaised >= fundingGoal:                                 │
│    - status = Successful                                        │
│    - Proceed to milestone release                               │
│                                                                  │
│  IF totalRaised < fundingGoal:                                  │
│    - status = Failed                                            │
│    - All backers can claim refunds                              │
└─────────────────────────────────────────────────────────────────┘
       │                                     │
       │ SUCCESS                             │ FAILED
       ▼                                     ▼
┌──────────────────────┐          ┌─────────────────────┐
│ MILESTONE RELEASE    │          │  REFUND PROCESS     │
│                      │          │                     │
│ Creator:             │          │ Each backer:        │
│                      │          │                     │
│ 1. releaseMilestone()│          │ 1. claimRefund()    │
│    - Sequential only │          │    - Get full amt   │
│    - M0 before M1    │          │                     │
│                      │          │ 2. Contract:        │
│ 2. Contract:         │          │    - Validates      │
│    - milestone.status│          │    - Returns ETH    │
│      = Released      │          │    - Marks refunded │
│                      │          │                     │
│ 3. withdrawMilestone│          └─────────────────────┘
│    ()                │
│    - Transfers funds │
│    - status =        │
│      Withdrawn       │
│                      │
│ 4. When all withdrawn│
│    - status =        │
│      Completed       │
└──────────────────────┘
```

---

## Looking For Grant Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PROJECT SEEKS VC/INVESTOR FUNDING                   │
│                                                                  │
│  1. Project calls createFundingRequest()                        │
│     - Provides project details (IPFS CID)                       │
│     - Provides progress/achievements (IPFS CID)                 │
│     - Provides social accounts (IPFS CID)                       │
│     - Specifies offering (tokens, equity, etc. - IPFS CID)      │
│     - Sets funding goal                                         │
│     - Optional deadline (can be 0 for no deadline)              │
│                                                                  │
│  2. LookingForGrant contract:                                   │
│     - Creates funding request                                   │
│     - status = Active                                           │
│     - Emit FundingRequestCreated event                          │
│                                                                  │
│  Key difference from Crowdfunding:                              │
│  - No all-or-nothing requirement                                │
│  - Creator can withdraw anytime                                 │
│  - No refunds (investors aware of risk)                         │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              INVESTORS/VCs PROVIDE SUPPORT                       │
│                                                                  │
│  1. Supporter calls supportRequest()                            │
│     - Sends ETH amount                                          │
│                                                                  │
│  2. LookingForGrant contract:                                   │
│     - Validates: request Active                                 │
│     - Validates: before deadline (if set)                       │
│     - Records supporter contribution                            │
│     - Updates supporterContributions[supporter]                 │
│     - Updates totalRaised                                       │
│     - Emit SupportReceived event                                │
│                                                                  │
│  3. QuintyNFT (first contribution only):                        │
│     - LookingForGrant calls mintBadge()                         │
│     - Mints LookingForGrantSupporter badge                      │
│                                                                  │
│  4. Check if goal reached:                                      │
│     - If totalRaised >= fundingGoal:                            │
│       * status = Funded                                         │
│       * Emit RequestFunded event                                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PROJECT WITHDRAWS FUNDS                             │
│                                                                  │
│  1. Requester calls withdrawFunds(amount)                       │
│     - Can withdraw any amount                                   │
│     - Can withdraw multiple times                               │
│     - No milestone restriction                                  │
│                                                                  │
│  2. LookingForGrant contract:                                   │
│     - Validates: caller is requester                            │
│     - Validates: amount ≤ totalRaised                           │
│     - Decrements totalRaised by amount                          │
│     - Transfers ETH to requester                                │
│     - Emit FundsWithdrawn event                                 │
│                                                                  │
│  3. Project updates:                                            │
│     - Requester calls postUpdate(ipfsCid)                       │
│     - Shares progress with supporters                           │
│     - Emit UpdatePosted event                                   │
│                                                                  │
│  4. Info updates:                                               │
│     - Requester calls updateProjectInfo()                       │
│     - Updates project details or progress CIDs                  │
│                                                                  │
│  Key feature: Complete flexibility                              │
│  - No refunds                                                   │
│  - Supporters accept risk                                       │
│  - Good for early-stage startups seeking VC                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Airdrop Bounty Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               CREATOR LAUNCHES AIRDROP CAMPAIGN                  │
│                                                                  │
│  1. Creator calls createAirdrop()                               │
│     - Sends: perQualifier × maxQualifiers (full escrow)         │
│     - Example: 0.01 ETH × 1000 people = 10 ETH total            │
│     - Sets deadline                                             │
│     - Provides requirements (IPFS CID)                          │
│                                                                  │
│  2. AirdropBounty contract validates:                           │
│     - msg.value == perQualifier × maxQualifiers                 │
│     - Deadline in future but < 365 days                         │
│     - maxQualifiers ≤ 10,000                                    │
│                                                                  │
│  3. Create airdrop:                                             │
│     - Escrow all funds                                          │
│     - resolved = false, cancelled = false                       │
│     - Emit AirdropCreated event                                 │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  USERS SUBMIT PROOF                              │
│                                                                  │
│  1. User calls submitEntry()                                    │
│     - Provides IPFS CID with social proof                       │
│       (e.g., X/Twitter post screenshot)                         │
│     - No payment required                                       │
│                                                                  │
│  2. AirdropBounty contract:                                     │
│     - Validates: before deadline                                │
│     - Validates: not already submitted                          │
│     - Validates: not resolved/cancelled                         │
│     - Creates Entry with status = Pending                       │
│     - Sets hasSubmitted[airdropId][user] = true                 │
│     - Stores submission index                                   │
│     - Emit EntrySubmitted event                                 │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              VERIFIERS REVIEW & APPROVE                          │
│                                                                  │
│  Single verification:                                           │
│  1. Verifier calls verifyEntry()                                │
│     - Provides entry ID                                         │
│     - Provides status (Approved/Rejected)                       │
│     - Optional feedback                                         │
│                                                                  │
│  Batch verification (more efficient):                           │
│  1. Verifier calls verifyMultipleEntries()                      │
│     - Provides up to 50 entry IDs                               │
│     - Provides statuses for each                                │
│     - Provides feedbacks for each                               │
│                                                                  │
│  2. AirdropBounty contract:                                     │
│     - Validates: caller is authorized verifier                  │
│     - Validates: entry status = Pending                         │
│     - Updates entry.status = Approved/Rejected                  │
│     - Stores feedback                                           │
│     - Records verifier approval                                 │
│     - Emit EntryVerified event                                  │
│                                                                  │
│  3. If approved:                                                │
│     - Increment qualifiersCount                                 │
│     - Check if qualifiersCount >= maxQualifiers                 │
│                                                                  │
│  4. Auto-finalization:                                          │
│     - If max qualifiers reached:                                │
│       * Automatically call _finalizeAirdrop()                   │
│       * Distribute rewards immediately                          │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 REWARDS DISTRIBUTED                              │
│                                                                  │
│  Automatic (when max reached) or Manual finalization:           │
│                                                                  │
│  1. Collect all approved entries                                │
│     - Loop through entries                                      │
│     - Find status = Approved                                    │
│     - Collect qualifiers (up to maxQualifiers)                  │
│                                                                  │
│  2. Distribute rewards:                                         │
│     FOR each qualified user:                                    │
│       transfer(user, perQualifier)                              │
│                                                                  │
│  3. Mark airdrop:                                               │
│     - resolved = true                                           │
│     - Emit QualifiedAndDistributed event                        │
│                                                                  │
│  If cancelled (before any approvals):                           │
│  - Creator can call cancelAirdrop()                             │
│  - Full refund to creator                                       │
│  - Can only cancel if qualifiersCount == 0                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Social Verification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                VERIFIER VERIFIES USER                            │
│                                                                  │
│  1. Verifier calls verifyUser()                                 │
│     - Provides user address                                     │
│     - Provides social handle (e.g., @username on X)             │
│     - Provides institution name (optional)                      │
│     - Provides proof hash (hash of verification data)           │
│                                                                  │
│  2. SocialVerification contract:                                │
│     - Validates: caller is authorized verifier                  │
│     - Validates: social handle not already linked               │
│     - Creates VerificationRecord:                               │
│       * isVerified = true                                       │
│       * verifiedAt = block.timestamp                            │
│       * socialHandle = provided handle                          │
│       * institutionName = provided name                         │
│       * proofHash = provided hash                               │
│     - Maps: verifications[userAddress]                          │
│     - Maps: socialHandleToAddress[handle] = user                │
│     - Emit UserVerified event                                   │
│                                                                  │
│  3. Duplicate prevention:                                       │
│     - socialHandleToAddress prevents same handle               │
│       being linked to multiple addresses                        │
│     - One social account = one wallet                           │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              INSTITUTION VERIFICATION                            │
│                                                                  │
│  1. Verifier calls verifyInstitution()                          │
│     - Provides institution address                              │
│     - Provides institution name                                 │
│                                                                  │
│  2. SocialVerification contract:                                │
│     - Sets verifiedInstitutions[address] = true                 │
│     - Creates VerificationRecord (without social handle)        │
│     - Emit InstitutionVerified event                            │
│                                                                  │
│  Use case:                                                       │
│  - Universities, Companies, DAOs                                │
│  - Verified organizations can create grants                     │
│  - Adds credibility to grant programs                           │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VERIFICATION QUERIES                            │
│                                                                  │
│  Anyone can check:                                              │
│                                                                  │
│  1. isVerified(address) → bool                                  │
│     - Check if user has been verified                           │
│                                                                  │
│  2. verifications[address] → VerificationRecord                 │
│     - Get full verification details                             │
│     - socialHandle, institution, verifiedAt                     │
│                                                                  │
│  3. socialHandleToAddress[handle] → address                     │
│     - Reverse lookup: find address by social handle             │
│                                                                  │
│  4. verifiedInstitutions[address] → bool                        │
│     - Check if address is verified institution                  │
│                                                                  │
│  Revocation:                                                     │
│  - Verifier can call revokeVerification(address)                │
│  - Removes all verification data                                │
│  - Frees up social handle for relinking                         │
│  - Emit VerificationRevoked event                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dispute Resolution Flow

*Note: This feature is marked "coming soon" - logic not fully implemented in tests*

```
┌─────────────────────────────────────────────────────────────────┐
│                BOUNTY EXPIRES (Slash Triggered)                  │
│                                                                  │
│  From Quinty contract:                                          │
│  - triggerSlash() called after deadline                         │
│  - Calculates slash: 25-50% of bounty amount                    │
│  - Transfers slash funds to DisputeResolver                     │
│  - Calls: initiateExpiryVote(bountyId, slashAmount)             │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│            DISPUTERESOLVER CREATES VOTE                          │
│                                                                  │
│  1. DisputeResolver receives call from Quinty                   │
│     - Validates: caller is Quinty contract                      │
│                                                                  │
│  2. Create expiry vote:                                         │
│     - Store bountyId and slash amount                           │
│     - Set voting deadline (e.g., 7 days)                        │
│     - Initialize vote tallies                                   │
│     - Emit ExpiryVoteInitiated event                            │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              COMMUNITY MEMBERS VOTE                              │
│                                                                  │
│  1. Voter calls submitVote()                                    │
│     - Sends minimum 0.0001 ETH stake                            │
│     - Ranks exactly 3 submissions in order                      │
│     - Example: [subId5, subId2, subId8]                         │
│                                                                  │
│  2. DisputeResolver validates:                                  │
│     - Stake >= 0.0001 ETH                                       │
│     - Exactly 3 unique submissions ranked                       │
│     - Voter hasn't already voted                                │
│     - Before voting deadline                                    │
│                                                                  │
│  3. Record vote:                                                │
│     - Store voter stake amount                                  │
│     - Store ranked submissions                                  │
│     - Add to vote tally                                         │
│     - Emit VoteSubmitted event                                  │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CALCULATE RESULTS                              │
│                                                                  │
│  After voting period ends:                                      │
│                                                                  │
│  1. Weighted voting calculation:                                │
│     FOR each submission:                                        │
│       totalScore = 0                                            │
│       FOR each vote:                                            │
│         IF submission == vote.rank1:                            │
│           score += stake × 3                                    │
│         ELSE IF submission == vote.rank2:                       │
│           score += stake × 2                                    │
│         ELSE IF submission == vote.rank3:                       │
│           score += stake × 1                                    │
│         totalScore += score                                     │
│                                                                  │
│  2. Determine winners:                                          │
│     - Sort submissions by totalScore                            │
│     - Top submission = community winner                         │
│                                                                  │
│  3. Reward distribution:                                        │
│     slashAmount breakdown:                                      │
│     - 10% to top-ranked non-winner submission                   │
│     - 5% split among voters who ranked winner in top 3          │
│     - Proportional to voter stake amounts                       │
│                                                                  │
│  4. Transfer rewards:                                           │
│     - transfer(topSubmission.solver, 10% of slash)              │
│     - FOR each correct voter:                                   │
│         reward = (5% of slash) × (voterStake / totalStake)      │
│         transfer(voter, reward + voterStake)                    │
│     - Return stakes to incorrect voters                         │
│     - Emit VoteResolved event                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## NFT Badge Minting Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              CONTRACT REQUESTS BADGE MINT                        │
│                                                                  │
│  Authorized contracts can mint badges:                          │
│  - Quinty (TeamMember badges)                                   │
│  - GrantProgram (GrantGiver, GrantRecipient)                    │
│  - LookingForGrant (LookingForGrantSupporter)                   │
│  - Crowdfunding (CrowdfundingDonor)                             │
│  - Owner (any badge type)                                       │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SINGLE BADGE MINT                               │
│                                                                  │
│  Contract calls: mintBadge(recipient, badgeType, metadataURI)   │
│                                                                  │
│  Example:                                                        │
│  GrantProgram.createGrant() →                                   │
│    QuintyNFT.mintBadge(creator, BadgeType.GrantGiver, uri)      │
│                                                                  │
│  QuintyNFT process:                                             │
│  1. Validate: caller is authorized                              │
│  2. Validate: recipient != address(0)                           │
│  3. Mint NFT:                                                   │
│     - tokenCounter++                                            │
│     - _safeMint(recipient, tokenCounter)                        │
│  4. Store badge data:                                           │
│     - badges[tokenId].badgeType = badgeType                     │
│     - badges[tokenId].issuedAt = block.timestamp                │
│     - badges[tokenId].metadataURI = uri                         │
│     - badges[tokenId].issuer = msg.sender (contract)            │
│  5. Update user data:                                           │
│     - userBadges[recipient].push(tokenId)                       │
│     - userBadgeCount[recipient][badgeType]++                    │
│  6. Emit: BadgeMinted(tokenId, recipient, badgeType, issuer)    │
│  7. Return: tokenId                                             │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BATCH BADGE MINT                                │
│                                                                  │
│  Contract calls: batchMintBadges(recipients[], badgeType, uri)  │
│                                                                  │
│  Example:                                                        │
│  Quinty.revealSolution() (team win) →                           │
│    QuintyNFT.batchMintBadges(                                   │
│      [leader, member1, member2],                                │
│      BadgeType.TeamMember,                                      │
│      "ipfs://team-badge/"                                       │
│    )                                                            │
│                                                                  │
│  QuintyNFT process:                                             │
│  1. Validate: recipients.length > 0 and ≤ 100                   │
│  2. FOR each recipient:                                         │
│     - tokenCounter++                                            │
│     - _safeMint(recipient, tokenCounter)                        │
│     - Store badge data                                          │
│     - Update user mappings                                      │
│     - Emit BadgeMinted event                                    │
│  3. All recipients get same badge type                          │
│  4. All get same metadata URI                                   │
│  5. Efficient for team rewards                                  │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SOULBOUND ENFORCEMENT                           │
│                                                                  │
│  Badges are non-transferable:                                   │
│                                                                  │
│  If user tries: transferFrom(owner, newOwner, tokenId)          │
│  → _update() override catches it                                │
│  → Checks: from != 0 && to != 0                                 │
│  → Reverts: "Soulbound: Transfer not allowed"                   │
│                                                                  │
│  If user tries: approve(spender, tokenId)                       │
│  → approve() override                                           │
│  → Reverts: "Soulbound: Approval not allowed"                   │
│                                                                  │
│  If user tries: setApprovalForAll(operator, true)               │
│  → setApprovalForAll() override                                 │
│  → Reverts: "Soulbound: Approval not allowed"                   │
│                                                                  │
│  Only allowed operations:                                       │
│  ✅ Minting: from == 0, to != 0                                 │
│  ✅ Burning: from != 0, to == 0 (if implemented)                │
│  ❌ Transfers: from != 0, to != 0 (blocked)                     │
│                                                                  │
│  Result: True achievement badges - earned, not bought           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

This document covers all major flows in the Quinty V2 ecosystem. Key takeaways:

1. **Quinty** is the central hub that orchestrates reputation, badges, and dispute resolution
2. **Submissions are immutable** - IPFS CIDs permanently tracked, winners reveal detailed solutions
3. **Teams get equal treatment** - all members receive equal rewards, reputation, and badges
4. **Multiple funding models** - each with specific use cases and flows
5. **Automated reputation** - achievements unlock automatically at milestones
6. **Soulbound badges** - true proof of participation, cannot be transferred
7. **Community governance** - dispute resolution through weighted voting (coming soon)

For implementation details, see the source contracts in `/contracts/` directory.
