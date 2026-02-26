import { ethers } from "hardhat";

// Use the most recent deployment addresses
const ADDRESSES = {
  QuintyReputation: "0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014",
  Quinty: "0x034cf0b72BcB1b529a2B0458275E0307CD6b5459",
  Quest: "0x86cc170e725784812A31F548c434e425bc0181B1",
  QuintyNFT: "0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔧 Setting up contracts with account:", deployer.address);

  // Helper function to wait for transaction
  const waitForTx = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    try {
      const tx = await txPromise;
      const receipt = await tx.wait();
      console.log(`✅ ${description} - tx: ${receipt.hash}`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      return receipt;
    } catch (error: any) {
      console.error(`❌ ${description} failed:`, error.message);
      throw error;
    }
  };

  // Get contract instances
  const quinty = await ethers.getContractAt("Quinty", ADDRESSES.Quinty);
  const reputation = await ethers.getContractAt("QuintyReputation", ADDRESSES.QuintyReputation);
  const nft = await ethers.getContractAt("QuintyNFT", ADDRESSES.QuintyNFT);

  console.log("\n🚀 Step 1: Setting addresses in Quinty contract");
  await waitForTx(
    quinty.setAddresses(
      ADDRESSES.QuintyReputation,
      ADDRESSES.QuintyNFT
    ),
    "Setting addresses in Quinty"
  );

  console.log("\n🚀 Step 2: Transferring QuintyReputation ownership");
  await waitForTx(
    reputation.transferOwnership(ADDRESSES.Quinty),
    "Transferring QuintyReputation ownership to Quinty"
  );

  console.log("\n🚀 Step 3: Authorizing Quinty to mint NFT badges");
  await waitForTx(
    nft.authorizeMinter(ADDRESSES.Quinty),
    "Authorizing Quinty to mint badges"
  );



  console.log("\n✨ Setup completed successfully!");
  console.log("\n📋 Final Contract Addresses:");
  console.log(JSON.stringify(ADDRESSES, null, 2));

  const fs = require("fs");
  const deploymentInfo = {
    chainId: 84532,
    network: "Base Sepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    status: "complete",
    contracts: ADDRESSES
  };

  fs.writeFileSync(
    'deployments-base-sepolia-complete.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployments-base-sepolia-complete.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
