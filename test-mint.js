const { ethers } = require("hardhat");

async function main() {
    const QUINTY_ADDRESS = "0xB511A7d9D712E48137dfd1B05d283308055b879f";
    const QUINTY_REPUTATION_ADDRESS = "0x832b2B307288d1C515fa51334992811927647567";

    const [deployer] = await ethers.getSigners();

    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = Quinty.attach(QUINTY_ADDRESS);

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    console.log("🎯 Testing achievement minting...");
    console.log("User:", deployer.address);

    try {
        console.log("📊 Recording a submission for user...");
        const tx1 = await reputation.recordSubmission(deployer.address);
        await tx1.wait();
        console.log("✅ Submission recorded");

        console.log("📊 Checking user stats...");
        const stats = await reputation.getUserStats(deployer.address);
        console.log("Stats:", {
            bountiesCreated: stats[0].toString(),
            submissions: stats[1].toString(),
            wins: stats[2].toString()
        });

        console.log("🏆 Checking achievements...");
        const achievements = await reputation.getUserAchievements(deployer.address);
        console.log("Achievements:", {
            types: achievements[0].map(a => a.toString()),
            tokenIds: achievements[1].map(t => t.toString())
        });

        if (achievements[1].length > 0) {
            console.log("📄 Testing tokenURI for first NFT...");
            const tokenURI = await reputation.tokenURI(achievements[1][0]);
            console.log("Token URI:", tokenURI);
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);