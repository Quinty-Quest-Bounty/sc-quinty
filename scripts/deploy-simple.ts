import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName =
    network.chainId === 8453n ? "Base Mainnet" :
      network.chainId === 84532n ? "Base Sepolia" :
        network.chainId === 5003n ? "Mantle Sepolia" :
          network.chainId === 5000n ? "Mantle Mainnet" :
            network.chainId === 421614n ? "Arbitrum Sepolia" :
              network.chainId === 42161n ? "Arbitrum Mainnet" :
                "Local Network";
  console.log(`🚀 Starting Quinty V2 deployment to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Helper function to wait with delay
  const waitForDeploy = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    const contract = await txPromise;
    await contract.waitForDeployment();
    console.log(`✅ ${description} completed`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return contract;
  };

  const waitForTx = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    const tx = await txPromise;
    await tx.wait();
    console.log(`✅ ${description} completed`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  // Deploy QuintyReputation first
  console.log("\n📋 Deploying QuintyReputation...");
  const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
  const reputation = await waitForDeploy(
    QuintyReputation.deploy("ipfs://QmReputation/"),
    "Deploying QuintyReputation"
  );
  const reputationAddress = await reputation.getAddress();
  console.log("   Address:", reputationAddress);

  // Deploy Quinty
  console.log("\n🎯 Deploying Quinty (Core Bounty Contract)...");
  const Quinty = await ethers.getContractFactory("Quinty");
  const quinty = await waitForDeploy(
    Quinty.deploy(),
    "Deploying Quinty"
  );
  const quintyAddress = await quinty.getAddress();
  console.log("   Address:", quintyAddress);

  // Deploy DisputeResolver
  console.log("\n⚖️  Deploying DisputeResolver...");
  const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
  const dispute = await waitForDeploy(
    DisputeResolver.deploy(quintyAddress),
    "Deploying DisputeResolver"
  );
  const disputeAddress = await dispute.getAddress();
  console.log("   Address:", disputeAddress);

  // Deploy QuintyNFT
  console.log("\n🏅 Deploying QuintyNFT (Badge System)...");
  const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
  const nft = await waitForDeploy(
    QuintyNFT.deploy("ipfs://QmNFT/"),
    "Deploying QuintyNFT"
  );
  const nftAddress = await nft.getAddress();
  console.log("   Address:", nftAddress);

  // Deploy AirdropBounty
  console.log("\n🎁 Deploying AirdropBounty...");
  const AirdropBounty = await ethers.getContractFactory("AirdropBounty");
  const airdrop = await waitForDeploy(
    AirdropBounty.deploy(),
    "Deploying AirdropBounty"
  );
  const airdropAddress = await airdrop.getAddress();
  console.log("   Address:", airdropAddress);

  // Deploy SocialVerification
  console.log("\n🔗 Deploying SocialVerification...");
  const SocialVerification = await ethers.getContractFactory("SocialVerification");
  const social = await waitForDeploy(
    SocialVerification.deploy(),
    "Deploying SocialVerification"
  );
  const socialAddress = await social.getAddress();
  console.log("   Address:", socialAddress);

  // Deploy GrantProgram
  console.log("\n💰 Deploying GrantProgram...");
  const GrantProgram = await ethers.getContractFactory("GrantProgram");
  const grant = await waitForDeploy(
    GrantProgram.deploy(),
    "Deploying GrantProgram"
  );
  const grantAddress = await grant.getAddress();
  console.log("   Address:", grantAddress);

  // Deploy LookingForGrant
  console.log("\n🔍 Deploying LookingForGrant...");
  const LookingForGrant = await ethers.getContractFactory("LookingForGrant");
  const lookingForGrant = await waitForDeploy(
    LookingForGrant.deploy(),
    "Deploying LookingForGrant"
  );
  const lookingForGrantAddress = await lookingForGrant.getAddress();
  console.log("   Address:", lookingForGrantAddress);

  // Deploy Crowdfunding
  console.log("\n🎪 Deploying Crowdfunding...");
  const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await waitForDeploy(
    Crowdfunding.deploy(),
    "Deploying Crowdfunding"
  );
  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("   Address:", crowdfundingAddress);

  // Setup contract connections
  console.log("\n🔗 Setting up contract connections...");

  await waitForTx(
    quinty.setAddresses(reputationAddress, disputeAddress, nftAddress),
    "Setting Quinty addresses"
  );

  await waitForTx(
    reputation.transferOwnership(quintyAddress),
    "Transferring QuintyReputation ownership to Quinty"
  );

  await waitForTx(
    nft.authorizeMinter(quintyAddress),
    "Authorizing Quinty as NFT minter"
  );

  await waitForTx(
    grant.setNFTAddress(nftAddress),
    "Setting NFT address in GrantProgram"
  );

  await waitForTx(
    nft.authorizeMinter(grantAddress),
    "Authorizing GrantProgram as NFT minter"
  );

  await waitForTx(
    lookingForGrant.setNFTAddress(nftAddress),
    "Setting NFT address in LookingForGrant"
  );

  await waitForTx(
    nft.authorizeMinter(lookingForGrantAddress),
    "Authorizing LookingForGrant as NFT minter"
  );

  await waitForTx(
    crowdfunding.setNFTAddress(nftAddress),
    "Setting NFT address in Crowdfunding"
  );

  await waitForTx(
    nft.authorizeMinter(crowdfundingAddress),
    "Authorizing Crowdfunding as NFT minter"
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
      SocialVerification: socialAddress,
      GrantProgram: grantAddress,
      LookingForGrant: lookingForGrantAddress,
      Crowdfunding: crowdfundingAddress,
    },
  };

  fs.writeFileSync(
    'deployments.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployments.json");

  console.log("\n📋 Contract Addresses Summary:");
  console.log("==========================================");
  console.log(`Quinty:              ${quintyAddress}`);
  console.log(`QuintyReputation:    ${reputationAddress}`);
  console.log(`QuintyNFT:           ${nftAddress}`);
  console.log(`DisputeResolver:     ${disputeAddress}`);
  console.log(`AirdropBounty:       ${airdropAddress}`);
  console.log(`SocialVerification:  ${socialAddress}`);
  console.log(`GrantProgram:        ${grantAddress}`);
  console.log(`LookingForGrant:     ${lookingForGrantAddress}`);
  console.log(`Crowdfunding:        ${crowdfundingAddress}`);
  console.log("==========================================");

  console.log("\n🎯 Next Steps:");
  console.log("1. Verify contracts on BaseScan");
  console.log("2. Update frontend with new contract addresses");
  console.log("3. Test basic functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
