const { ethers } = require("hardhat");

async function main() {
    // Contract address from deployment
    const QUINTY_REPUTATION_ADDRESS = "0x1ff119e11718565b735106D4b87C1c7AE2B8d18C";

    // Get the contract
    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const contract = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    console.log("🔍 Testing NFT Metadata...");

    try {
        // Check token exists
        const owner = await contract.ownerOf(1);
        console.log("✅ Token #1 owner:", owner);

        // Get tokenURI
        const tokenURI = await contract.tokenURI(1);
        console.log("📄 Token URI:", tokenURI);

        // Try to decode base64 if it's data URI
        if (tokenURI.startsWith("data:application/json;base64,")) {
            const base64Data = tokenURI.split(",")[1];
            try {
                const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
                console.log("🔓 Decoded metadata:", decoded);
                const jsonData = JSON.parse(decoded);
                console.log("📋 Parsed JSON:");
                console.log("  Name:", jsonData.name);
                console.log("  Description:", jsonData.description);
                console.log("  Image:", jsonData.image);
                console.log("  Attributes:", jsonData.attributes);
            } catch (e) {
                console.error("❌ Failed to decode base64:", e.message);
            }
        }

        // Check user stats
        const userStats = await contract.getUserStats(owner);
        console.log("📊 User stats:", {
            bountiesCreated: userStats[0].toString(),
            submissions: userStats[1].toString(),
            wins: userStats[2].toString()
        });

        // Check user achievements
        const achievements = await contract.getUserAchievements(owner);
        console.log("🏆 User achievements:", {
            achievementTypes: achievements[0].map(a => a.toString()),
            tokenIds: achievements[1].map(t => t.toString())
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});