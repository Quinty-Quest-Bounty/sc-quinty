import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Estimating deployment costs...\n");
  
  // Get contract factories
  const Quinty = await ethers.getContractFactory("Quinty");
  const Quest = await ethers.getContractFactory("Quest");
  const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
  const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
  
  // Get deployment transactions (with constructor args where needed)
  const quintyDeployTx = await Quinty.getDeployTransaction();
  const questDeployTx = await Quest.getDeployTransaction();
  const reputationDeployTx = await QuintyReputation.getDeployTransaction("https://quinty.app/api/reputation/");
  const nftDeployTx = await QuintyNFT.getDeployTransaction("https://quinty.app/api/nft/");
  
  // Estimate gas
  const quintyGas = await deployer.estimateGas(quintyDeployTx);
  const questGas = await deployer.estimateGas(questDeployTx);
  const reputationGas = await deployer.estimateGas(reputationDeployTx);
  const nftGas = await deployer.estimateGas(nftDeployTx);
  
  const totalGas = quintyGas + questGas + reputationGas + nftGas;
  
  // Get bytecode sizes
  const quintySize = Quinty.bytecode.length / 2 - 1;
  const questSize = Quest.bytecode.length / 2 - 1;
  const reputationSize = QuintyReputation.bytecode.length / 2 - 1;
  const nftSize = QuintyNFT.bytecode.length / 2 - 1;
  
  console.log("Contract Deployment Gas Estimates:");
  console.log("===================================");
  console.log(`Quinty:           ${quintyGas.toString().padStart(10)} gas  (${(quintySize/1024).toFixed(2)} KB)`);
  console.log(`Quest:            ${questGas.toString().padStart(10)} gas  (${(questSize/1024).toFixed(2)} KB)`);
  console.log(`QuintyReputation: ${reputationGas.toString().padStart(10)} gas  (${(reputationSize/1024).toFixed(2)} KB)`);
  console.log(`QuintyNFT:        ${nftGas.toString().padStart(10)} gas  (${(nftSize/1024).toFixed(2)} KB)`);
  console.log("-----------------------------------");
  console.log(`TOTAL:            ${totalGas.toString().padStart(10)} gas`);
  console.log("");
  
  // Calculate costs at different gas prices
  const gasPrices = [
    { name: "Base Sepolia (~0.001 gwei)", gwei: 0.001 },
    { name: "Base Mainnet Low (0.01 gwei)", gwei: 0.01 },
    { name: "Base Mainnet Avg (0.05 gwei)", gwei: 0.05 },
    { name: "Base Mainnet High (0.1 gwei)", gwei: 0.1 },
  ];
  
  console.log("Estimated Deployment Costs (ETH):");
  console.log("===================================");
  for (const price of gasPrices) {
    const costWei = totalGas * BigInt(Math.floor(price.gwei * 1e9));
    const costEth = Number(costWei) / 1e18;
    console.log(`${price.name.padEnd(32)}: ${costEth.toFixed(8)} ETH`);
  }
  
  // ETH prices
  console.log("\nEstimated Deployment Costs (USD @ $2,500/ETH):");
  console.log("===============================================");
  for (const price of gasPrices) {
    const costWei = totalGas * BigInt(Math.floor(price.gwei * 1e9));
    const costEth = Number(costWei) / 1e18;
    const costUsd = costEth * 2500;
    console.log(`${price.name.padEnd(32)}: $${costUsd.toFixed(4)}`);
  }

  console.log("\n--- Individual Contract Costs at 0.05 gwei ---");
  const avgGwei = 0.05;
  const contracts = [
    { name: "Quinty", gas: quintyGas },
    { name: "Quest", gas: questGas },
    { name: "QuintyReputation", gas: reputationGas },
    { name: "QuintyNFT", gas: nftGas },
  ];
  for (const c of contracts) {
    const costWei = c.gas * BigInt(Math.floor(avgGwei * 1e9));
    const costEth = Number(costWei) / 1e18;
    const costUsd = costEth * 2500;
    console.log(`${c.name.padEnd(20)}: ${costEth.toFixed(8)} ETH ($${costUsd.toFixed(4)})`);
  }
}

main().catch(console.error);
