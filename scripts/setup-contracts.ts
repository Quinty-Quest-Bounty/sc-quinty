import { ethers } from "hardhat";

// Use the most recent deployment addresses
const ADDRESSES = {
  QuintyReputation: "0x2dc731f796Df125B282484E844485814B2DCd363",
  Quinty: "0x7169c907F80f95b20232F5B979B1Aac392bD282a",
  DisputeResolver: "0xF04b0Ec52bFe602D0D38bEA4f613ABb7cFA79FB5",
  QuintyNFT: "0x80edb4Aeb39913FaFfDAC2a86F3184508B57AAe2",
  AirdropBounty: "0x79dAe15C3612854F6bd025f7CDc6D4CDEE289049",
  ZKVerification: "0xe3cd834a963B3A6A550aed05ece2535B02C83E3a",
  // These need to be deployed still
  GrantProgram: "",
  LookingForGrant: "",
  Crowdfunding: ""
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

  // Deploy remaining contracts if needed
  if (!ADDRESSES.GrantProgram) {
    console.log("\n💰 Deploying GrantProgram contract...");
    const GrantProgram = await ethers.getContractFactory("GrantProgram");
    const grantProgram = await GrantProgram.deploy();
    await grantProgram.waitForDeployment();
    const grantProgramAddress = await grantProgram.getAddress();
    console.log("✅ GrantProgram deployed to:", grantProgramAddress);
    ADDRESSES.GrantProgram = grantProgramAddress;

    await new Promise(resolve => setTimeout(resolve, 5000));

    await waitForTx(
      grantProgram.setNFTAddress(ADDRESSES.QuintyNFT),
      "Setting NFT address in GrantProgram"
    );

    await waitForTx(
      nft.authorizeMinter(grantProgramAddress),
      "Authorizing GrantProgram to mint badges"
    );
  }

  if (!ADDRESSES.LookingForGrant) {
    console.log("\n🔍 Deploying LookingForGrant contract...");
    const LookingForGrant = await ethers.getContractFactory("LookingForGrant");
    const lookingForGrant = await LookingForGrant.deploy();
    await lookingForGrant.waitForDeployment();
    const lookingForGrantAddress = await lookingForGrant.getAddress();
    console.log("✅ LookingForGrant deployed to:", lookingForGrantAddress);
    ADDRESSES.LookingForGrant = lookingForGrantAddress;

    await new Promise(resolve => setTimeout(resolve, 5000));

    await waitForTx(
      lookingForGrant.setNFTAddress(ADDRESSES.QuintyNFT),
      "Setting NFT address in LookingForGrant"
    );

    await waitForTx(
      nft.authorizeMinter(lookingForGrantAddress),
      "Authorizing LookingForGrant to mint badges"
    );
  }

  if (!ADDRESSES.Crowdfunding) {
    console.log("\n🎯 Deploying Crowdfunding contract...");
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Crowdfunding.deploy();
    await crowdfunding.waitForDeployment();
    const crowdfundingAddress = await crowdfunding.getAddress();
    console.log("✅ Crowdfunding deployed to:", crowdfundingAddress);
    ADDRESSES.Crowdfunding = crowdfundingAddress;

    await new Promise(resolve => setTimeout(resolve, 5000));

    await waitForTx(
      crowdfunding.setNFTAddress(ADDRESSES.QuintyNFT),
      "Setting NFT address in Crowdfunding"
    );

    await waitForTx(
      nft.authorizeMinter(crowdfundingAddress),
      "Authorizing Crowdfunding to mint badges"
    );
  }

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
