import { ethers } from "hardhat";
import fs from "fs";

// USDC on Base Sepolia
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 8453n ? "Base Mainnet" : network.chainId === 84532n ? "Base Sepolia" : "Local Network";
  console.log(`Starting Quinty V3 deployment to ${networkName}...`);
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const waitForTx = async (txPromise: any, description: string) => {
    console.log(`${description}...`);
    const tx = await txPromise;
    await tx.wait();
    console.log(`  ${description} completed`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  // 1. Deploy QuintyReputation
  console.log("\nDeploying QuintyReputation...");
  const reputationBaseURI = "https://quinty.app/api/reputation/";
  const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
  const reputation = await QuintyReputation.deploy(reputationBaseURI);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("QuintyReputation deployed to:", reputationAddress);

  // 2. Deploy Quinty V3
  console.log("\nDeploying Quinty V3...");
  const Quinty = await ethers.getContractFactory("Quinty");
  const quinty = await Quinty.deploy();
  await quinty.waitForDeployment();
  const quintyAddress = await quinty.getAddress();
  console.log("Quinty deployed to:", quintyAddress);

  // 3. Deploy Quest V2
  console.log("\nDeploying Quest V2...");
  const Quest = await ethers.getContractFactory("Quest");
  const quest = await Quest.deploy();
  await quest.waitForDeployment();
  const questAddress = await quest.getAddress();
  console.log("Quest deployed to:", questAddress);

  // 4. Deploy QuintyNFT
  console.log("\nDeploying QuintyNFT...");
  const nftBaseURI = "https://quinty.app/api/nft/";
  const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
  const nft = await QuintyNFT.deploy(nftBaseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("QuintyNFT deployed to:", nftAddress);

  // --- Setup Contract Connections ---
  console.log("\nSetting up contract connections...");

  // Quinty -> Reputation
  await waitForTx(
    quinty.setReputationAddress(reputationAddress),
    "Setting reputation address in Quinty"
  );

  // Quest -> Reputation
  await waitForTx(
    quest.setReputationAddress(reputationAddress),
    "Setting reputation address in Quest"
  );

  // Authorize both Quinty and Quest as reputation callers (deployer retains ownership)
  await waitForTx(
    reputation.authorizeCaller(quintyAddress),
    "Authorizing Quinty as reputation caller"
  );
  await waitForTx(
    reputation.authorizeCaller(questAddress),
    "Authorizing Quest as reputation caller"
  );

  // Whitelist USDC on both contracts
  if (network.chainId === 84532n) {
    await waitForTx(
      quinty.allowToken(USDC_BASE_SEPOLIA),
      "Whitelisting USDC on Quinty"
    );
    await waitForTx(
      quest.allowToken(USDC_BASE_SEPOLIA),
      "Whitelisting USDC on Quest"
    );
  }

  // Authorize Quinty to mint NFT badges
  await waitForTx(
    nft.authorizeMinter(quintyAddress),
    "Authorizing Quinty to mint badges"
  );

  console.log("\nDeployment completed successfully!");

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

  console.log("\nDeployment Summary:");
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
  console.log("Deployment info saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
