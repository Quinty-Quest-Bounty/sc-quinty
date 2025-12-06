const { ethers } = require("hardhat");

async function main() {
    const QUINTY_ADDRESS = "0xB511A7d9D712E48137dfd1B05d283308055b879f";
    const QUINTY_REPUTATION_ADDRESS = "0x832b2B307288d1C515fa51334992811927647567";

    const [deployer] = await ethers.getSigners();
    console.log("🔍 Checking contract setup...");
    console.log("Deployer:", deployer.address);

    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = Quinty.attach(QUINTY_ADDRESS);

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    try {
        console.log("📋 Checking Quinty contract setup...");
        const reputationAddr = await quinty.reputationAddress();
        console.log("Quinty -> reputationAddress:", reputationAddr);

        console.log("📋 Checking Reputation contract setup...");
        const owner = await reputation.owner();
        console.log("Reputation owner:", owner);

        // Check if Quinty can call reputation functions
        console.log("📋 Testing Quinty can call reputation...");
        console.log("Quinty address:", QUINTY_ADDRESS);
        console.log("Expected owner:", QUINTY_ADDRESS);

        if (owner.toLowerCase() === QUINTY_ADDRESS.toLowerCase()) {
            console.log("✅ Quinty is owner of Reputation contract");
        } else {
            console.log("❌ Quinty is NOT owner of Reputation contract");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);