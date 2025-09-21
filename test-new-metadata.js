const { ethers } = require("hardhat");

async function main() {
    const NEW_QUINTY_REPUTATION = "0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F";
    const NEW_QUINTY_ADDRESS = "0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15";

    const [deployer] = await ethers.getSigners();
    console.log("🔍 Testing new contract metadata format...");
    console.log("Deployer:", deployer.address);

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(NEW_QUINTY_REPUTATION);

    try {
        // Check ownership
        const owner = await reputation.owner();
        console.log("Contract owner:", owner);
        console.log("Expected (Quinty):", NEW_QUINTY_ADDRESS);

        // Since we can't call the reputation functions directly (only owner can),
        // let's test the metadata generation for a specific achievement type
        console.log("📄 Testing internal view functions...");

        // Try to get current user stats
        const stats = await reputation.getUserStats(deployer.address);
        console.log("Current stats:", {
            bountiesCreated: stats[0].toString(),
            submissions: stats[1].toString(),
            wins: stats[2].toString()
        });

        const achievements = await reputation.getUserAchievements(deployer.address);
        console.log("Current achievements:", {
            types: achievements[0].map(a => a.toString()),
            tokenIds: achievements[1].map(t => t.toString())
        });

        // If no NFTs exist yet, the metadata functions won't be callable
        console.log("✅ Contract is accessible and responding to view functions");
        console.log("📋 Ready for NFT minting when actions are performed through Quinty contract");

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);