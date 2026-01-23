import { ethers } from "hardhat";

// Use the most recent deployment addresses
const ADDRESSES = {
  QuintyReputation: "0x2dc731f796Df125B282484E844485814B2DCd363",
  Quinty: "0x7169c907F80f95b20232F5B979B1Aac392bD282a",
  DisputeResolver: "0xF04b0Ec52bFe602D0D38bEA4f613ABb7cFA79FB5",
  QuintyNFT: "0x80edb4Aeb39913FaFfDAC2a86F3184508B57AAe2",
  AirdropBounty: "0x79dAe15C3612854F6bd025f7CDc6D4CDEE289049",
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
      ADDRESSES.DisputeResolver,
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
