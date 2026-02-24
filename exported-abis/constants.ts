
// Auto-generated TypeScript definitions for Quinty V2 contracts
// Generated: 2026-02-05T23:05:24.770Z
// incuBase Milestone - Phases, 1% Deposit, Slash Mechanism

export interface ContractAddresses {
  Quinty: string;
  Quest: string;
  QuintyReputation: string;
  QuintyNFT: string;
  AirdropBounty: string; // Legacy
}

// Deployed addresses on Base Sepolia (2026-02-06)
export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  Quinty: "0xdB6511DC9869a10Ed00C3706Ff9332820db87463",
  Quest: "0xFeFAB11BA3Bc2d74B8B4804044f39A12E55BE4ae",
  QuintyReputation: "0xE84dA988177707e9e8371894C082049D2C4F5e5e",
  QuintyNFT: "0xDe5eB0e3232B40ED445E94f33708dc7E425E84F8",
  AirdropBounty: "0xFeFAB11BA3Bc2d74B8B4804044f39A12E55BE4ae", // Legacy alias
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
