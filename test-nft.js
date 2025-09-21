const { ethers } = require("hardhat");

async function main() {
    const QUINTY_REPUTATION_ADDRESS = "0x832b2B307288d1C515fa51334992811927647567";

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const contract = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    console.log("🔍 Testing NFT Metadata...");

    try {
        // Check owner of token 1
        const owner = await contract.ownerOf(1);
        console.log("✅ Token #1 owner:", owner);

        // Get tokenURI
        const tokenURI = await contract.tokenURI(1);
        console.log("📄 Token URI length:", tokenURI.length);
        console.log("📄 Token URI start:", tokenURI.substring(0, 100) + "...");

        // Test direct metadata generation for first achievement
        try {
            // Get user stats first
            const userStats = await contract.getUserStats(owner);
            console.log("📊 User stats:", {
                bountiesCreated: userStats[0].toString(),
                submissions: userStats[1].toString(),
                wins: userStats[2].toString()
            });

            // Get achievements
            const achievements = await contract.getUserAchievements(owner);
            console.log("🏆 Achievements:", {
                types: achievements[0].map(a => a.toString()),
                tokenIds: achievements[1].map(t => t.toString())
            });

        } catch (e) {
            console.error("❌ Error getting user data:", e.message);
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);