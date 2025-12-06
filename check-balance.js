const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔍 Checking deployer balance...");
    console.log("Address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "STT");

    if (balance < ethers.parseEther("0.1")) {
        console.log("❌ Insufficient balance for test transaction");
    } else {
        console.log("✅ Sufficient balance");
    }
}

main().catch(console.error);