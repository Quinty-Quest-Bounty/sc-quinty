import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Quinty deployment to Somnia Testnet...");
  console.log("Chain ID: 50312");

  try {
    // Get the deployer signer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

    // Deploy QuintyReputation first (needed by Quinty)
    console.log("\n📋 Deploying QuintyReputation contract...");
    const QuintyReputation = await ethers.getContractFactory("QuintyReputation", deployer);
    const reputation = await QuintyReputation.deploy();
    await reputation.waitForDeployment();
    const reputationAddress = await reputation.getAddress();
    console.log("✅ QuintyReputation deployed to:", reputationAddress);

    // Deploy DisputeResolver (needed by Quinty)
    console.log("\n⚖️ Deploying DisputeResolver contract...");
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    const dispute = await DisputeResolver.deploy();
    await dispute.waitForDeployment();
    const disputeAddress = await dispute.getAddress();
    console.log("✅ DisputeResolver deployed to:", disputeAddress);

    // Deploy core Quinty contract
    console.log("\n🎯 Deploying Quinty core contract...");
    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = await Quinty.deploy();
    await quinty.waitForDeployment();
    const quintyAddress = await quinty.getAddress();
    console.log("✅ Quinty deployed to:", quintyAddress);

    // Deploy AirdropBounty contract
    console.log("\n🎁 Deploying AirdropBounty contract...");
    const AirdropBounty = await ethers.getContractFactory("AirdropBounty");
    const airdrop = await AirdropBounty.deploy();
    await airdrop.waitForDeployment();
    const airdropAddress = await airdrop.getAddress();
    console.log("✅ AirdropBounty deployed to:", airdropAddress);

    // Set up contract interconnections
    console.log("\n🔗 Setting up contract connections...");

    // Set addresses in Quinty contract
    console.log("Setting reputation and dispute addresses in Quinty...");
    await quinty.setAddresses(reputationAddress, disputeAddress);

    // Set Quinty address in DisputeResolver
    console.log("Setting Quinty address in DisputeResolver...");
    await dispute.setQuintyAddress(quintyAddress);

    // Set QuintyReputation owner to Quinty contract so it can update reputation
    console.log("Transferring QuintyReputation ownership to Quinty contract...");
    await reputation.transferOwnership(quintyAddress);

    console.log("\n✨ Deployment completed successfully!");
    console.log("\n📋 Contract Addresses:");
    console.log("==========================================");
    console.log(`Quinty (Core):        ${quintyAddress}`);
    console.log(`QuintyReputation:     ${reputationAddress}`);
    console.log(`DisputeResolver:      ${disputeAddress}`);
    console.log(`AirdropBounty:        ${airdropAddress}`);
    console.log("==========================================");

    console.log("\n🔧 Next Steps:");
    console.log("1. Verify contracts on block explorer (if available)");
    console.log("2. Update frontend contract addresses");
    console.log("3. Set base IPFS URI for reputation NFTs if needed");
    console.log("4. Add verifiers to AirdropBounty contract");
    console.log("5. Test basic functionality with small amounts");

    // Save deployment info to file
    const deploymentInfo = {
      chainId: 50312,
      network: "somniaTestnet",
      timestamp: new Date().toISOString(),
      contracts: {
        Quinty: quintyAddress,
        QuintyReputation: reputationAddress,
        DisputeResolver: disputeAddress,
        AirdropBounty: airdropAddress,
      },
    };

    // If fs is available, save deployment info
    try {
      const fs = await import('fs');
      fs.writeFileSync(
        'deployments.json',
        JSON.stringify(deploymentInfo, null, 2)
      );
      console.log("\n💾 Deployment info saved to deployments.json");
    } catch (error) {
      console.log("\n⚠️  Could not save deployment info to file:", error.message);
    }

    return deploymentInfo;

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

// Execute deployment
main()
  .then((deploymentInfo) => {
    console.log("\n🎉 All done! Quinty is ready for testing on Somnia Testnet.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });