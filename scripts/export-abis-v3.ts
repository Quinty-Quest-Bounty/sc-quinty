import fs from 'fs';
import path from 'path';

async function main() {
  console.log("🔄 Exporting ABIs for fe-quinty-v3...");

  const contracts = [
    'Quinty',
    'QuintyReputation',
    'QuintyNFT',
    'DisputeResolver',
    'AirdropBounty',
    'SocialVerification',
    'GrantProgram',
    'LookingForGrant',
    'Crowdfunding'
  ];

  const outputDir = path.join(__dirname, '../fe-quinty-v3/src/contracts');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const abis: Record<string, any> = {};

  for (const contractName of contracts) {
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
      abis[contractName] = artifact.abi;
      console.log(`✅ Exported ${contractName} ABI`);
    } else {
      console.log(`⚠️  Could not find artifact for ${contractName}`);
    }
  }

  // Write ABIs to TypeScript file
  const abiContent = `// Auto-generated ABIs - Do not edit manually
// Generated on: ${new Date().toISOString()}

${Object.entries(abis).map(([name, abi]) =>
  `export const ${name}ABI = ${JSON.stringify(abi, null, 2)} as const;`
).join('\n\n')}

// Export all ABIs as object
export const ABIS = {
${Object.keys(abis).map(name => `  ${name}: ${name}ABI,`).join('\n')}
} as const;
`;

  fs.writeFileSync(path.join(outputDir, 'abis.ts'), abiContent);
  console.log(`\n💾 ABIs saved to fe-quinty-v3/src/contracts/abis.ts`);
  console.log(`📦 Total contracts exported: ${Object.keys(abis).length}`);
}

main()
  .then(() => {
    console.log("\n✅ ABI export completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error exporting ABIs:", error);
    process.exit(1);
  });
