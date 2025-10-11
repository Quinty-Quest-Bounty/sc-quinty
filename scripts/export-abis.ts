import fs from 'fs';
import path from 'path';

const contracts = [
  'Quinty',
  'QuintyReputation',
  'DisputeResolver',
  'QuintyNFT',
  'AirdropBounty',
  'ZKVerification',
  'GrantProgram',
  'LookingForGrant',
  'Crowdfunding'
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

export interface ContractAddresses {
  Quinty: string;
  QuintyReputation: string;
  DisputeResolver: string;
  QuintyNFT: string;
  AirdropBounty: string;
  ZKVerification: string;
  GrantProgram: string;
  LookingForGrant: string;
  Crowdfunding: string;
}

export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  Quinty: "0x7169c907F80f95b20232F5B979B1Aac392bD282a",
  QuintyReputation: "0x2dc731f796Df125B282484E844485814B2DCd363",
  DisputeResolver: "0xF04b0Ec52bFe602D0D38bEA4f613ABb7cFA79FB5",
  QuintyNFT: "0x80edb4Aeb39913FaFfDAC2a86F3184508B57AAe2",
  AirdropBounty: "0x79dAe15C3612854F6bd025f7CDc6D4CDEE289049",
  ZKVerification: "0xe3cd834a963B3A6A550aed05ece2535B02C83E3a",
  GrantProgram: "0xf70fBEba52Cc2A6F1e511179A10BdB4B820c7879",
  LookingForGrant: "0x423fb3E158B8bA79Fabbd387dAEb844DC0709BeF",
  Crowdfunding: "0x64aC0a7A52f3E0a414D8344f6A4620b51dFfB6C2"
};

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia-explorer.base.org";

export enum BountyStatus {
  OPREC = 0,
  OPEN = 1,
  PENDING_REVEAL = 2,
  RESOLVED = 3,
  DISPUTED = 4,
  EXPIRED = 5
}

export enum BadgeType {
  BountyCreator = 0,
  BountySolver = 1,
  TeamMember = 2,
  GrantGiver = 3,
  GrantRecipient = 4,
  CrowdfundingDonor = 5,
  LookingForGrantSupporter = 6
}

export enum GrantStatus {
  Open = 0,
  SelectionPhase = 1,
  Active = 2,
  Completed = 3,
  Cancelled = 4
}

export enum CampaignStatus {
  Active = 0,
  Successful = 1,
  Failed = 2,
  Completed = 3
}

export enum RequestStatus {
  Active = 0,
  Funded = 1,
  Cancelled = 2
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
