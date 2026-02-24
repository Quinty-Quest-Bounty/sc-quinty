
// Auto-generated TypeScript definitions for Quinty V2 contracts
// Generated: 2026-02-24T23:18:38.110Z
// incuBase Milestone - Phases, 1% Deposit, Slash Mechanism

export interface ContractAddresses {
  Quinty: string;
  Quest: string;
  QuintyReputation: string;
  QuintyNFT: string;
}

// Deployed addresses on Base Sepolia (2026-02-09)
export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  Quinty: "0x034cf0b72BcB1b529a2B0458275E0307CD6b5459",
  Quest: "0x86cc170e725784812A31F548c434e425bc0181B1",
  QuintyReputation: "0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014",
  QuintyNFT: "0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884",
};

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia-explorer.base.org";

// Bounty Status Enum (incuBase milestone - phase-based)
export enum BountyStatus {
  OPEN = 0,      // Accepting submissions (before openDeadline)
  JUDGING = 1,   // Creator judging (before judgingDeadline)
  RESOLVED = 2,  // Winner selected and paid
  SLASHED = 3    // Creator slashed for not selecting winner
}

// Quest Entry Verification Status
export enum VerificationStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2
}

export enum BadgeType {
  BountyCreator = 0,
  BountySolver = 1,
  TeamMember = 2
}
