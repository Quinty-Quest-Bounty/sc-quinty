import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 8453n ? "Base Mainnet" : network.chainId === 84532n ? "Base Sepolia" : "Local Network";
  console.log(`🚀 Starting Quinty V2 (incuBase) deployment to ${networkName}...`);
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

  // 1. Deploy QuintyReputation with a base URI for metadata
  console.log("\n📋 Deploying QuintyReputation contract...");
  const reputationBaseURI = "https://quinty.app/api/reputation/";
  const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
  const reputation = await QuintyReputation.deploy(reputationBaseURI);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("✅ QuintyReputation deployed to:", reputationAddress);

  // 2. Deploy Quinty contract (new simplified version with phases, 1% deposit, slash)
  console.log("\n🎯 Deploying Quinty core contract...");
  const Quinty = await ethers.getContractFactory("Quinty");
  const quinty = await Quinty.deploy();
  await quinty.waitForDeployment();
  const quintyAddress = await quinty.getAddress();
  console.log("✅ Quinty deployed to:", quintyAddress);

  // 3. Deploy Quest contract
  console.log("\n🎁 Deploying Quest contract...");
  const Quest = await ethers.getContractFactory("Quest");
  const quest = await Quest.deploy();
  await quest.waitForDeployment();
  const questAddress = await quest.getAddress();
  console.log("✅ Quest deployed to:", questAddress);

  // 4. Deploy QuintyNFT
  console.log("\n🎨 Deploying QuintyNFT contract...");
  const nftBaseURI = "https://quinty.app/api/nft/";
  const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
  const nft = await QuintyNFT.deploy(nftBaseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ QuintyNFT deployed to:", nftAddress);

  // --- Setup Contract Connections ---
  console.log("\n🔗 Setting up contract connections...");

  // Set reputation address in Quinty contract
  await waitForTx(
    quinty.setReputationAddress(reputationAddress),
    "Setting reputation address in Quinty"
  );

  // Transfer QuintyReputation ownership to Quinty contract
  await waitForTx(
    reputation.transferOwnership(quintyAddress),
    "Transferring QuintyReputation ownership to Quinty"
  );

  // Authorize Quinty to mint NFT badges
  await waitForTx(
    nft.authorizeMinter(quintyAddress),
    "Authorizing Quinty to mint badges"
  );

  console.log("\n✨ Deployment completed successfully!");
  
  const deploymentInfo = {
    chainId: Number(network.chainId),
    network: networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      Quinty: quintyAddress,
      Quest: questAddress,
      QuintyReputation: reputationAddress,
      QuintyNFT: nftAddress,
    },
  };

  // Print deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("=======================");
  console.log(`Quinty:           ${quintyAddress}`);
  console.log(`Quest:            ${questAddress}`);
  console.log(`QuintyReputation: ${reputationAddress}`);
  console.log(`QuintyNFT:        ${nftAddress}`);
  console.log("");

  fs.writeFileSync(
    'deployments.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("💾 Deployment info saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
