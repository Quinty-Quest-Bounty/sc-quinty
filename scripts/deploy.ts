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

  // 3. Deploy DisputeResolver (it needs the Quinty address)
  console.log("\n⚖️ Deploying DisputeResolver contract...");
  const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
  const dispute = await DisputeResolver.deploy(quintyAddress);
  await dispute.waitForDeployment();
  const disputeAddress = await dispute.getAddress();
  console.log("✅ DisputeResolver deployed to:", disputeAddress);
  
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

  // 6. Deploy ZKVerification
  console.log("\n🔐 Deploying ZKVerification contract...");
  const ZKVerification = await ethers.getContractFactory("ZKVerification");
  const zkVerification = await ZKVerification.deploy();
  await zkVerification.waitForDeployment();
  const zkVerificationAddress = await zkVerification.getAddress();
  console.log("✅ ZKVerification deployed to:", zkVerificationAddress);

  // 7. Deploy GrantProgram
  console.log("\n💰 Deploying GrantProgram contract...");
  const GrantProgram = await ethers.getContractFactory("GrantProgram");
  const grantProgram = await GrantProgram.deploy();
  await grantProgram.waitForDeployment();
  const grantProgramAddress = await grantProgram.getAddress();
  console.log("✅ GrantProgram deployed to:", grantProgramAddress);

  // 8. Deploy LookingForGrant
  console.log("\n🔍 Deploying LookingForGrant contract...");
  const LookingForGrant = await ethers.getContractFactory("LookingForGrant");
  const lookingForGrant = await LookingForGrant.deploy();
  await lookingForGrant.waitForDeployment();
  const lookingForGrantAddress = await lookingForGrant.getAddress();
  console.log("✅ LookingForGrant deployed to:", lookingForGrantAddress);

  // 9. Deploy Crowdfunding
  console.log("\n🎯 Deploying Crowdfunding contract...");
  const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy();
  await crowdfunding.waitForDeployment();
  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("✅ Crowdfunding deployed to:", crowdfundingAddress);

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
    quinty.setAddresses(reputationAddress, disputeAddress, nftAddress),
    "Setting addresses in Quinty"
  );

  // Transfer QuintyReputation ownership to Quinty contract
  await waitForTx(
    reputation.transferOwnership(quintyAddress),
    "Transferring QuintyReputation ownership to Quinty"
  );

  // Set NFT addresses in new contracts
  await waitForTx(
    grantProgram.setNFTAddress(nftAddress),
    "Setting NFT address in GrantProgram"
  );
  await waitForTx(
    lookingForGrant.setNFTAddress(nftAddress),
    "Setting NFT address in LookingForGrant"
  );
  await waitForTx(
    crowdfunding.setNFTAddress(nftAddress),
    "Setting NFT address in Crowdfunding"
  );

  // Authorize contracts to mint NFT badges
  await waitForTx(
    nft.authorizeMinter(quintyAddress),
    "Authorizing Quinty to mint badges"
  );
  await waitForTx(
    nft.authorizeMinter(grantProgramAddress),
    "Authorizing GrantProgram to mint badges"
  );
  await waitForTx(
    nft.authorizeMinter(lookingForGrantAddress),
    "Authorizing LookingForGrant to mint badges"
  );
  await waitForTx(
    nft.authorizeMinter(crowdfundingAddress),
    "Authorizing Crowdfunding to mint badges"
  );

  console.log("\n✨ Deployment completed successfully!");
  const deploymentInfo = {
    chainId: Number(network.chainId),
    network: networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      Quinty: quintyAddress,
      QuintyReputation: reputationAddress,
      DisputeResolver: disputeAddress,
      QuintyNFT: nftAddress,
      AirdropBounty: airdropAddress,
      ZKVerification: zkVerificationAddress,
      GrantProgram: grantProgramAddress,
      LookingForGrant: lookingForGrantAddress,
      Crowdfunding: crowdfundingAddress,
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