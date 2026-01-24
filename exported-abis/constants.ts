
// Auto-generated TypeScript definitions for Quinty V2 contracts
// Updated: 2026-01-24

export interface ContractAddresses {
  Quinty: string;
  QuintyReputation: string;
  QuintyNFT: string;
  AirdropBounty: string;
}

export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  Quinty: "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85",
  QuintyReputation: "0xeA6C17Bafa574f33f2ceCfD64E553A17444e5E94",
  QuintyNFT: "0x5f821a06cB7BBBbD3F470ebB6Cb1e43E84853B05",
  AirdropBounty: "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938",
};

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia-explorer.base.org";

export enum BountyStatus {
  OPREC = 0,
  OPEN = 1,
  PENDING_REVEAL = 2,
  RESOLVED = 3,
  EXPIRED = 4
}

export enum BadgeType {
  BountyCreator = 0,
  BountySolver = 1,
  TeamMember = 2
}
