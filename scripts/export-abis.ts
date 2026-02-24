import fs from 'fs';
import path from 'path';

// Map contract name -> artifact subpath (some live under ContractName.sol/)
const contracts: Record<string, string> = {
  Quinty: 'Quinty.sol/Quinty.json',
  Quest: 'Quest.sol/Quest.json',
  QuintyReputation: 'QuintyReputation.sol/QuintyReputation.json',
  QuintyNFT: 'QuintyNFT.sol/QuintyNFT.json',
};

const exportDir = path.join(__dirname, '../exported-abis');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

console.log('Exporting ABIs for frontend integration...\n');

const allABIs: Record<string, any> = {};

for (const [name, artifactSub] of Object.entries(contracts)) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${artifactSub}`);

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;

    fs.writeFileSync(path.join(exportDir, `${name}.json`), JSON.stringify(abi, null, 2));
    allABIs[name] = abi;
    console.log(`  ${name}.json exported`);
  } catch (error: any) {
    console.error(`  Failed to export ${name}: ${error.message}`);
  }
}

fs.writeFileSync(path.join(exportDir, 'all-abis.json'), JSON.stringify(allABIs, null, 2));
console.log('\n  all-abis.json (combined) exported');

// USDC on Base Sepolia
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const tsDefinitions = `// Auto-generated TypeScript definitions for Quinty V3 contracts
// Generated: ${new Date().toISOString()}
// V3: Multi-winner, ERC-20, Pausable, Pull Withdrawals

export interface ContractAddresses {
  Quinty: string;
  Quest: string;
  QuintyReputation: string;
  QuintyNFT: string;
}

// Deployed addresses on Base Sepolia (updated on deploy)
export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  Quinty: "0x034cf0b72BcB1b529a2B0458275E0307CD6b5459",
  Quest: "0x86cc170e725784812A31F548c434e425bc0181B1",
  QuintyReputation: "0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014",
  QuintyNFT: "0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884",
};

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia-explorer.base.org";

// USDC on Base Sepolia (6 decimals)
export const USDC_BASE_SEPOLIA = "${USDC_BASE_SEPOLIA}";

// address(0) sentinel for native ETH
export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

export enum BountyStatus {
  OPEN = 0,
  JUDGING = 1,
  RESOLVED = 2,
  SLASHED = 3,
}

export enum VerificationStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
}

export enum BadgeType {
  BountyCreator = 0,
  BountySolver = 1,
  TeamMember = 2,
}
`;

fs.writeFileSync(path.join(exportDir, 'constants.ts'), tsDefinitions);
console.log('  constants.ts exported');

console.log(`\nAll files exported to: ${exportDir}`);
