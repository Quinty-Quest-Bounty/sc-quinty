# Quinty V2 - Frontend Integration Guide

## 🚀 Quick Start

### 1. Contract Addresses (Base Sepolia)

```typescript
export const QUINTY_CONTRACTS = {
  Quinty: "0x7169c907F80f95b20232F5B979B1Aac392bD282a",
  QuintyReputation: "0x2dc731f796Df125B282484E844485814B2DCd363",
  DisputeResolver: "0xF04b0Ec52bFe602D0D38bEA4f613ABb7cFA79FB5",
  QuintyNFT: "0x80edb4Aeb39913FaFfDAC2a86F3184508B57AAe2",
  AirdropBounty: "0x79dAe15C3612854F6bd025f7CDc6D4CDEE289049",
  SocialVerification: "0xe3cd834a963B3A6A550aed05ece2535B02C83E3a",
  GrantProgram: "0xf70fBEba52Cc2A6F1e511179A10BdB4B820c7879",
  LookingForGrant: "0x423fb3E158B8bA79Fabbd387dAEb844DC0709BeF",
  Crowdfunding: "0x64aC0a7A52f3E0a414D8344f6A4620b51dFfB6C2"
} as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
```

### 2. Import ABIs

ABIs are located in `artifacts/contracts/[ContractName].sol/[ContractName].json`

```typescript
import QuintyABI from './artifacts/contracts/Quinty.sol/Quinty.json';
import QuintyNFTABI from './artifacts/contracts/QuintyNFT.sol/QuintyNFT.json';
import GrantProgramABI from './artifacts/contracts/GrantProgram.sol/GrantProgram.json';
// ... etc
```

### 3. Setup Ethers.js Contract Instances

```typescript
import { ethers } from 'ethers';
import { QUINTY_CONTRACTS } from './constants';
import QuintyABI from './abis/Quinty.json';

// Connect to provider
const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);

// For read-only operations
const quintyContract = new ethers.Contract(
  QUINTY_CONTRACTS.Quinty,
  QuintyABI.abi,
  provider
);

// For write operations (with signer)
const signer = await provider.getSigner();
const quintyWithSigner = new ethers.Contract(
  QUINTY_CONTRACTS.Quinty,
  QuintyABI.abi,
  signer
);
```

## 📋 Common Operations

### Bounty System

#### Create a Bounty
```typescript
async function createBounty(
  description: string,
  deadline: number,
  allowMultipleWinners: boolean,
  winnerShares: number[],
  slashPercent: number,
  hasOprec: boolean,
  oprecDeadline: number,
  amount: bigint
) {
  const tx = await quintyContract.createBounty(
    description,
    deadline,
    allowMultipleWinners,
    winnerShares,
    slashPercent,
    hasOprec,
    oprecDeadline,
    { value: amount }
  );
  return await tx.wait();
}

// Example usage
const bountyAmount = ethers.parseEther("1.0"); // 1 ETH
const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
const slashPercent = 3000; // 30%

await createBounty(
  "Build a DeFi dashboard",
  deadline,
  false, // single winner
  [],
  slashPercent,
  false, // no oprec
  0,
  bountyAmount
);
```

#### Submit Solution
```typescript
async function submitSolution(
  bountyId: number,
  ipfsCid: string,
  teamMembers: string[],
  deposit: bigint
) {
  const tx = await quintyContract.submitSolution(
    bountyId,
    ipfsCid,
    teamMembers,
    { value: deposit }
  );
  return await tx.wait();
}

// Example: Solo submission
const depositAmount = ethers.parseEther("0.1"); // 10% of bounty
await submitSolution(1, "QmYourIPFSCid", [], depositAmount);

// Example: Team submission
await submitSolution(
  1,
  "QmYourIPFSCid",
  ["0xTeamMember1Address", "0xTeamMember2Address"],
  depositAmount
);
```

#### Select Winners
```typescript
async function selectWinners(
  bountyId: number,
  winners: string[],
  submissionIds: number[]
) {
  const tx = await quintyContract.selectWinners(
    bountyId,
    winners,
    submissionIds
  );
  return await tx.wait();
}
```

#### Reveal Solution
```typescript
async function revealSolution(
  bountyId: number,
  submissionId: number,
  revealCid: string
) {
  const tx = await quintyContract.revealSolution(
    bountyId,
    submissionId,
    revealCid
  );
  return await tx.wait();
}
```

### Oprec (Open Recruitment)

#### Apply to Oprec
```typescript
async function applyToOprec(
  bountyId: number,
  workExamples: string,
  skillDescription: string,
  teamMembers: string[]
) {
  const tx = await quintyContract.applyToOprec(
    bountyId,
    workExamples,
    skillDescription,
    teamMembers
  );
  return await tx.wait();
}
```

### Grant Program

#### Create Grant
```typescript
async function createGrant(
  title: string,
  description: string,
  maxApplicants: number,
  applicationDeadline: number,
  distributionDeadline: number,
  amount: bigint
) {
  const grantProgram = new ethers.Contract(
    QUINTY_CONTRACTS.GrantProgram,
    GrantProgramABI.abi,
    signer
  );

  const tx = await grantProgram.createGrant(
    title,
    description,
    maxApplicants,
    applicationDeadline,
    distributionDeadline,
    { value: amount }
  );
  return await tx.wait();
}
```

#### Apply for Grant
```typescript
async function applyForGrant(
  grantId: number,
  projectDetails: string,
  socialAccounts: string,
  requestedAmount: bigint
) {
  const grantProgram = new ethers.Contract(
    QUINTY_CONTRACTS.GrantProgram,
    GrantProgramABI.abi,
    signer
  );

  const tx = await grantProgram.applyForGrant(
    grantId,
    projectDetails,
    socialAccounts,
    requestedAmount
  );
  return await tx.wait();
}
```

### Looking For Grant

#### Create Funding Request
```typescript
async function createFundingRequest(
  title: string,
  projectDetails: string,
  progress: string,
  socialAccounts: string,
  offering: string,
  fundingGoal: bigint,
  deadline: number
) {
  const lookingForGrant = new ethers.Contract(
    QUINTY_CONTRACTS.LookingForGrant,
    LookingForGrantABI.abi,
    signer
  );

  const tx = await lookingForGrant.createFundingRequest(
    title,
    projectDetails,
    progress,
    socialAccounts,
    offering,
    fundingGoal,
    deadline
  );
  return await tx.wait();
}
```

#### Support Request
```typescript
async function supportRequest(requestId: number, amount: bigint) {
  const lookingForGrant = new ethers.Contract(
    QUINTY_CONTRACTS.LookingForGrant,
    LookingForGrantABI.abi,
    signer
  );

  const tx = await lookingForGrant.supportRequest(requestId, { value: amount });
  return await tx.wait();
}
```

### Crowdfunding

#### Create Campaign
```typescript
async function createCampaign(
  title: string,
  projectDetails: string,
  socialAccounts: string,
  fundingGoal: bigint,
  deadline: number,
  milestoneDescriptions: string[],
  milestoneAmounts: bigint[]
) {
  const crowdfunding = new ethers.Contract(
    QUINTY_CONTRACTS.Crowdfunding,
    CrowdfundingABI.abi,
    signer
  );

  const tx = await crowdfunding.createCampaign(
    title,
    projectDetails,
    socialAccounts,
    fundingGoal,
    deadline,
    milestoneDescriptions,
    milestoneAmounts
  );
  return await tx.wait();
}
```

#### Contribute to Campaign
```typescript
async function contribute(campaignId: number, amount: bigint) {
  const crowdfunding = new ethers.Contract(
    QUINTY_CONTRACTS.Crowdfunding,
    CrowdfundingABI.abi,
    signer
  );

  const tx = await crowdfunding.contribute(campaignId, { value: amount });
  return await tx.wait();
}
```

### NFT Badges

#### Get User Badges
```typescript
async function getUserBadges(userAddress: string) {
  const nftContract = new ethers.Contract(
    QUINTY_CONTRACTS.QuintyNFT,
    QuintyNFTABI.abi,
    provider
  );

  const badges = await nftContract.getUserBadges(userAddress);
  return badges;
}
```

#### Check Badge Ownership
```typescript
async function hasBadgeType(userAddress: string, badgeType: number) {
  const nftContract = new ethers.Contract(
    QUINTY_CONTRACTS.QuintyNFT,
    QuintyNFTABI.abi,
    provider
  );

  return await nftContract.hasBadgeType(userAddress, badgeType);
}

// Badge Types:
// 0 = BountyCreator
// 1 = BountySolver
// 2 = TeamMember
// 3 = GrantGiver
// 4 = GrantRecipient
// 5 = CrowdfundingDonor
// 6 = LookingForGrantSupporter
```

### Reputation System

#### Get User Stats
```typescript
async function getUserStats(userAddress: string) {
  const reputationContract = new ethers.Contract(
    QUINTY_CONTRACTS.QuintyReputation,
    QuintyReputationABI.abi,
    provider
  );

  const stats = await reputationContract.getUserStats(userAddress);
  return {
    totalSubmissions: stats.totalSubmissions,
    totalWins: stats.totalWins,
    totalBountiesCreated: stats.totalBountiesCreated,
    firstActivity: stats.firstActivity,
    lastActivity: stats.lastActivity
  };
}
```

#### Get User Achievements
```typescript
async function getUserAchievements(userAddress: string) {
  const reputationContract = new ethers.Contract(
    QUINTY_CONTRACTS.QuintyReputation,
    QuintyReputationABI.abi,
    provider
  );

  const [achievements, tokenIds] = await reputationContract.getUserAchievements(userAddress);
  return achievements.map((achievement: number, i: number) => ({
    type: achievement,
    tokenId: tokenIds[i]
  }));
}
```

## 🎧 Event Listening

### Listen for Bounty Creation
```typescript
quintyContract.on("BountyCreated", (bountyId, creator, amount, deadline, hasOprec) => {
  console.log("New bounty created:", {
    bountyId: bountyId.toString(),
    creator,
    amount: ethers.formatEther(amount),
    deadline: new Date(deadline * 1000),
    hasOprec
  });
});
```

### Listen for Submissions
```typescript
quintyContract.on("SubmissionCreated", (bountyId, subId, solver, ipfsCid, isTeam) => {
  console.log("New submission:", {
    bountyId: bountyId.toString(),
    submissionId: subId.toString(),
    solver,
    isTeam
  });
});
```

### Listen for NFT Badge Minting
```typescript
const nftContract = new ethers.Contract(
  QUINTY_CONTRACTS.QuintyNFT,
  QuintyNFTABI.abi,
  provider
);

nftContract.on("BadgeMinted", (recipient, tokenId, badgeType) => {
  console.log("Badge minted:", {
    recipient,
    tokenId: tokenId.toString(),
    badgeType: badgeType.toString()
  });
});
```

## 🔍 Reading Contract Data

### Get Bounty Data
```typescript
async function getBountyData(bountyId: number) {
  const data = await quintyContract.getBountyData(bountyId);
  return {
    creator: data.creator,
    description: data.description,
    amount: data.amount,
    deadline: data.deadline,
    status: data.status, // 0=OPREC, 1=OPEN, 2=PENDING_REVEAL, 3=RESOLVED, 4=DISPUTED, 5=EXPIRED
    allowMultipleWinners: data.allowMultipleWinners,
    winnerShares: data.winnerShares,
    slashPercent: data.slashPercent,
    selectedWinners: data.selectedWinners,
    selectedSubmissionIds: data.selectedSubmissionIds,
    hasOprec: data.hasOprec,
    oprecDeadline: data.oprecDeadline
  };
}
```

### Get Submission
```typescript
async function getSubmission(bountyId: number, submissionId: number) {
  const submission = await quintyContract.getSubmission(bountyId, submissionId);
  return {
    solver: submission.solver,
    teamMembers: submission.teamMembers,
    blindedIpfsCid: submission.blindedIpfsCid,
    revealIpfsCid: submission.revealIpfsCid,
    deposit: submission.deposit,
    revealed: submission.revealed,
    isTeam: submission.isTeam
  };
}
```

## 🌐 Explorer Links

All transactions can be viewed on Base Sepolia Explorer:
- Base URL: https://sepolia-explorer.base.org

Examples:
- Quinty Contract: https://sepolia-explorer.base.org/address/0x7169c907F80f95b20232F5B979B1Aac392bD282a
- Transaction: https://sepolia-explorer.base.org/tx/[TX_HASH]

## 💡 Best Practices

1. **Always check transaction status**:
```typescript
const tx = await contract.someFunction();
const receipt = await tx.wait();
if (receipt.status === 1) {
  console.log("Transaction successful!");
}
```

2. **Handle errors gracefully**:
```typescript
try {
  const tx = await contract.createBounty(...);
  await tx.wait();
} catch (error: any) {
  if (error.code === 'ACTION_REJECTED') {
    console.log("User rejected transaction");
  } else {
    console.error("Transaction failed:", error.message);
  }
}
```

3. **Use BigInt for amounts**:
```typescript
const amount = ethers.parseEther("1.5"); // 1.5 ETH
const formatted = ethers.formatEther(amount); // "1.5"
```

4. **Listen for events before sending transactions**:
```typescript
const filter = contract.filters.BountyCreated();
contract.once(filter, (bountyId) => {
  console.log("Your bounty ID is:", bountyId.toString());
});

await contract.createBounty(...);
```

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "ethers": "^6.15.0",
    "wagmi": "^2.x.x", // Optional: For React hooks
    "viem": "^2.x.x" // Optional: Alternative to ethers
  }
}
```

## 🔐 Security Notes

1. **Never expose private keys** in frontend code
2. **Always validate user input** before sending transactions
3. **Use environmental variables** for RPC endpoints
4. **Implement rate limiting** for contract calls
5. **Verify contract addresses** match deployment addresses

## 📚 Additional Resources

- **Ethers.js Docs**: https://docs.ethers.org/v6/
- **Base Network Docs**: https://docs.base.org/
- **Contract ABIs**: Located in `artifacts/contracts/`
- **Test Examples**: See `test/` folder for usage examples
