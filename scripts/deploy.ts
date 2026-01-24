import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 8453n ? "Base Mainnet" : network.chainId === 84532n ? "Base Sepolia" : "Local Network";
  console.log(`🚀 Starting Quinty V2 deployment to ${networkName}...`);
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy QuintyReputation with a base URI for metadata
  console.log("\n📋 Deploying QuintyReputation contract...");
  const reputationBaseURI = "ipfs://YOUR_METADATA_FOLDER_CID/"; // TODO: Replace with actual CID
  const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
  const reputation = await QuintyReputation.deploy(reputationBaseURI);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("✅ QuintyReputation deployed to:", reputationAddress);

  // 2. Deploy Quinty contract (it needs no constructor args)
  console.log("\n🎯 Deploying Quinty core contract...");
  const Quinty = await ethers.getContractFactory("Quinty");
  const quinty = await Quinty.deploy();
  await quinty.waitForDeployment();
  const quintyAddress = await quinty.getAddress();
  console.log("✅ Quinty deployed to:", quintyAddress);



  // 4. Deploy QuintyNFT
  console.log("\n🎨 Deploying QuintyNFT contract...");
  const nftBaseURI = "ipfs://QmQuintyNFT/"; // TODO: Replace with actual CID
  const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
  const nft = await QuintyNFT.deploy(nftBaseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ QuintyNFT deployed to:", nftAddress);

  // 5. Deploy AirdropBounty contract
  console.log("\n🎁 Deploying AirdropBounty contract...");
  const AirdropBounty = await ethers.getContractFactory("AirdropBounty");
  const airdrop = await AirdropBounty.deploy();
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log("✅ AirdropBounty deployed to:", airdropAddress);



  // --- Setup Contract Connections ---
  console.log("\n🔗 Setting up contract connections...");

  // Helper function to wait for transaction and add delay
  const waitForTx = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    const tx = await txPromise;
    await tx.wait();
    console.log(`✅ ${description} completed`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  };

  // Set addresses in Quinty contract
  await waitForTx(
    quinty.setAddresses(reputationAddress, nftAddress),
    "Setting addresses in Quinty"
  );

  // Transfer QuintyReputation ownership to Quinty contract
  await waitForTx(
    reputation.transferOwnership(quintyAddress),
    "Transferring QuintyReputation ownership to Quinty"
  );

  // Authorize contracts to mint NFT badges
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
      QuintyReputation: reputationAddress,
      QuintyNFT: nftAddress,
      AirdropBounty: airdropAddress,
    },
  };

  fs.writeFileSync(
    'deployments.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });