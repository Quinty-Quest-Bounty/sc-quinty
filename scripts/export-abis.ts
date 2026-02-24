import fs from 'fs';
import path from 'path';

const contracts = [
  'Quinty',
  'Quest',
  'QuintyReputation',
  'QuintyNFT',
];

const exportDir = path.join(__dirname, '../exported-abis');

// Create export directory if it doesn't exist
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

console.log('📦 Exporting ABIs for frontend integration...\n');

contracts.forEach(contractName => {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;

    // Export ABI as JSON
    const exportPath = path.join(exportDir, `${contractName}.json`);
    fs.writeFileSync(exportPath, JSON.stringify(abi, null, 2));

    console.log(`✅ ${contractName}.json exported`);
  } catch (error: any) {
    console.error(`❌ Failed to export ${contractName}:`, error.message);
  }
});

// Also create a combined file with all ABIs
const allABIs: Record<string, any> = {};
contracts.forEach(contractName => {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    allABIs[contractName] = artifact.abi;
  } catch (error) {
    // Skip if file doesn't exist
  }
});

const combinedPath = path.join(exportDir, 'all-abis.json');
fs.writeFileSync(combinedPath, JSON.stringify(allABIs, null, 2));
console.log('\n✅ all-abis.json (combined) exported');

// Create TypeScript definitions file
const tsDefinitions = `
// Auto-generated TypeScript definitions for Quinty V2 contracts
// Generated: ${new Date().toISOString()}
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
`;

const tsPath = path.join(exportDir, 'constants.ts');
fs.writeFileSync(tsPath, tsDefinitions);
console.log('✅ constants.ts (TypeScript definitions) exported');

console.log(`\n📁 All files exported to: ${exportDir}`);
console.log('\n📋 To use in your frontend:');
console.log('   1. Copy the exported-abis folder to your frontend project');
console.log('   2. Import ABIs: import QuintyABI from "./exported-abis/Quinty.json"');
console.log('   3. Import constants: import { BASE_SEPOLIA_ADDRESSES } from "./exported-abis/constants"');
