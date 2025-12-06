import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 8453n ? "Base Mainnet" : network.chainId === 84532n ? "Base Sepolia" : "Local Network";
  console.log(`🚀 Starting Quinty V2 deployment to ${networkName} with Registry/Factory pattern...`);
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Helper function to wait for transaction and add delay
  const waitForTx = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    const tx = await txPromise;
    await tx.wait();
    console.log(`✅ ${description} completed`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  };

  // ==================== STEP 1: Deploy Registry ====================
  console.log("\n📚 Deploying QuintyRegistry (central contract registry)...");
  const QuintyRegistry = await ethers.getContractFactory("QuintyRegistry");
  const registry = await QuintyRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ QuintyRegistry deployed to:", registryAddress);
  console.log("   - Deployer has DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE");
  console.log("   - Supports versioning and upgradeability");

  // ==================== STEP 2: Deploy Factory ====================
  console.log("\n🏭 Deploying QuintyFactory (contract deployment factory)...");
  const QuintyFactory = await ethers.getContractFactory("QuintyFactory");
  const factory = await QuintyFactory.deploy(registryAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ QuintyFactory deployed to:", factoryAddress);
  console.log("   - Connected to registry at:", registryAddress);

  // ==================== STEP 3: Grant Factory UPGRADER_ROLE ====================
  console.log("\n🔑 Granting factory UPGRADER_ROLE in registry...");
  const UPGRADER_ROLE = await registry.UPGRADER_ROLE();
  await waitForTx(
    registry.grantRole(UPGRADER_ROLE, factoryAddress),
    "Granting UPGRADER_ROLE to factory"
  );

  // ==================== STEP 4: Deploy Full Ecosystem via Factory ====================
  console.log("\n🌐 Deploying full Quinty ecosystem via factory...");
  console.log("   This will deploy all 9 contracts in one transaction:");
  console.log("   - Quinty (core bounty contract)");
  console.log("   - QuintyReputation (soulbound NFT reputation)");
  console.log("   - QuintyNFT (achievement badges)");
  console.log("   - DisputeResolver (voting and disputes)");
  console.log("   - GrantProgram (grant funding)");
  console.log("   - Crowdfunding (crowdfunding campaigns)");
  console.log("   - LookingForGrant (grant seekers)");
  console.log("   - AirdropBounty (promotional tasks)");
  console.log("   - SocialVerification (social proof verification)");

  const reputationBaseURI = "ipfs://YOUR_REPUTATION_METADATA_CID/"; // TODO: Replace with actual CID
  const nftBaseURI = "ipfs://YOUR_NFT_METADATA_CID/"; // TODO: Replace with actual CID

  console.log("\n🚀 Calling deployFullEcosystem() - this may take a moment...");
  const deployTx = await factory.deployFullEcosystem(reputationBaseURI, nftBaseURI);
  console.log("   Transaction submitted, waiting for confirmation...");
  const deployReceipt = await deployTx.wait();
  console.log(`✅ Full ecosystem deployed in block ${deployReceipt?.blockNumber}`);
  console.log(`   Gas used: ${deployReceipt?.gasUsed.toString()}`);

  // ==================== STEP 5: Retrieve Deployed Addresses from Registry ====================
  console.log("\n📋 Retrieving deployed contract addresses from registry...");

  const allContracts = await registry.getAllContracts();
  const quintyAddress = allContracts[0];
  const reputationAddress = allContracts[1];
  const nftAddress = allContracts[2];
  const disputeAddress = allContracts[3];
  const grantProgramAddress = allContracts[4];
  const crowdfundingAddress = allContracts[5];
  const lookingForGrantAddress = allContracts[6];
  const airdropAddress = allContracts[7];
  const socialVerificationAddress = allContracts[8];

  console.log("   📍 Quinty:", quintyAddress);
  console.log("   📍 QuintyReputation:", reputationAddress);
  console.log("   📍 QuintyNFT:", nftAddress);
  console.log("   📍 DisputeResolver:", disputeAddress);
  console.log("   📍 GrantProgram:", grantProgramAddress);
  console.log("   📍 Crowdfunding:", crowdfundingAddress);
  console.log("   📍 LookingForGrant:", lookingForGrantAddress);
  console.log("   📍 AirdropBounty:", airdropAddress);
  console.log("   📍 SocialVerification:", socialVerificationAddress);

  // ==================== STEP 6: Setup Contract Connections ====================
  console.log("\n🔗 Setting up contract connections via factory...");

  // Setup core contract connections (Quinty, Reputation, DisputeResolver, NFT)
  await waitForTx(
    factory.setupCoreConnections(),
    "Setting up core contract connections"
  );
  console.log("   ✓ Quinty.setAddresses() called");
  console.log("   ✓ QuintyReputation ownership transferred to Quinty");
  console.log("   ✓ QuintyNFT authorized Quinty as minter");

  // Setup funding contract connections (GrantProgram, Crowdfunding, LookingForGrant)
  await waitForTx(
    factory.setupFundingConnections(),
    "Setting up funding contract connections"
  );
  console.log("   ✓ GrantProgram.setNFTAddress() called");
  console.log("   ✓ Crowdfunding.setNFTAddress() called");
  console.log("   ✓ LookingForGrant.setNFTAddress() called");
  console.log("   ✓ QuintyNFT authorized all funding contracts as minters");

  // ==================== STEP 7: Verify Registry State ====================
  console.log("\n🔍 Verifying registry state...");

  const QUINTY = await registry.QUINTY();
  const quintyInfo = await registry.getContractInfo(QUINTY);
  console.log("   Quinty contract info:");
  console.log(`   - Version: ${quintyInfo.version}`);
  console.log(`   - Active: ${quintyInfo.isActive}`);
  console.log(`   - Deployed at: ${new Date(Number(quintyInfo.deployedAt) * 1000).toISOString()}`);

  // ==================== STEP 8: Save Deployment Info ====================
  console.log("\n✨ Deployment completed successfully!");

  const deploymentInfo = {
    chainId: Number(network.chainId),
    network: networkName,
    timestamp: new Date().toISOString(),
    pattern: "Registry/Factory",
    infrastructure: {
      QuintyRegistry: registryAddress,
      QuintyFactory: factoryAddress,
    },
    contracts: {
      Quinty: quintyAddress,
      QuintyReputation: reputationAddress,
      QuintyNFT: nftAddress,
      DisputeResolver: disputeAddress,
      GrantProgram: grantProgramAddress,
      Crowdfunding: crowdfundingAddress,
      LookingForGrant: lookingForGrantAddress,
      AirdropBounty: airdropAddress,
      SocialVerification: socialVerificationAddress,
    },
    versions: {
      Quinty: Number(quintyInfo.version),
      // All contracts start at version 1
    },
    gasUsed: deployReceipt?.gasUsed.toString(),
    blockNumber: deployReceipt?.blockNumber,
  };

  fs.writeFileSync(
    'deployments.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployments.json");

  console.log("\n📖 Registry/Factory Benefits:");
  console.log("   ✓ Frontend can query registry.getAllContracts() for all addresses");
  console.log("   ✓ Easy upgrades: deploy new version, factory registers it automatically");
  console.log("   ✓ Versioning: registry tracks all contract versions");
  console.log("   ✓ Emergency pause: registry can pause entire protocol");
  console.log("   ✓ Future-proof: add new contracts without breaking existing integrations");

  console.log("\n🎯 Next Steps:");
  console.log("   1. Update frontend to use registry.getAllContracts()");
  console.log("   2. To upgrade a contract: use factory.deployXXX() - it auto-registers");
  console.log("   3. To pause protocol: registry.setPaused(true)");
  console.log("   4. Monitor contract versions: registry.getContractInfo(contractType)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
