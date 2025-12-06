const { ethers } = require("hardhat");

async function main() {
    const QUINTY_ADDRESS = "0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15";
    const QUINTY_REPUTATION_ADDRESS = "0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F";

    const [deployer] = await ethers.getSigners();
    console.log("🎯 Testing via Quinty contract...");
    console.log("User:", deployer.address);

    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = Quinty.attach(QUINTY_ADDRESS);

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    try {
        console.log("📊 Initial user stats...");
        const statsBefore = await reputation.getUserStats(deployer.address);
        console.log("Stats before:", {
            bountiesCreated: statsBefore[0].toString(),
            submissions: statsBefore[1].toString(),
            wins: statsBefore[2].toString()
        });

        console.log("🚀 Creating a bounty to trigger recordBountyCreation...");
        const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours
        const createTx = await quinty.createBounty(
            "Test bounty for achievement",
            deadline,
            false, // allowMultipleWinners
            [10000], // winnerShares (100%)
            25, // slashPercent
            { value: ethers.parseEther("0.1") } // 0.1 STT
        );
        await createTx.wait();
        console.log("✅ Bounty created");

        console.log("📊 Checking stats after bounty creation...");
        const statsAfter = await reputation.getUserStats(deployer.address);
        console.log("Stats after:", {
            bountiesCreated: statsAfter[0].toString(),
            submissions: statsAfter[1].toString(),
            wins: statsAfter[2].toString()
        });

        console.log("🏆 Checking achievements...");
        const achievements = await reputation.getUserAchievements(deployer.address);
        console.log("Achievements:", {
            types: achievements[0].map(a => a.toString()),
            tokenIds: achievements[1].map(t => t.toString())
        });

        if (achievements[1].length > 0) {
            console.log("📄 Testing tokenURI for latest NFT...");
            const latestTokenId = achievements[1][achievements[1].length - 1];
            const tokenURI = await reputation.tokenURI(latestTokenId);
            console.log("Token URI for #" + latestTokenId + ":");
            console.log(tokenURI);
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);