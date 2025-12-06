const { ethers } = require("hardhat");

async function main() {
    const QUINTY_ADDRESS = "0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15";
    const QUINTY_REPUTATION_ADDRESS = "0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F";

    const [deployer] = await ethers.getSigners();
    console.log("🎯 Testing simple contract calls...");
    console.log("User:", deployer.address);

    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = Quinty.attach(QUINTY_ADDRESS);

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(QUINTY_REPUTATION_ADDRESS);

    try {
        console.log("📊 Testing basic reads...");

        const balance = await ethers.provider.getBalance(deployer.address);
        console.log("Balance:", ethers.formatEther(balance), "STT");

        const stats = await reputation.getUserStats(deployer.address);
        console.log("Stats:", {
            bountiesCreated: stats[0].toString(),
            submissions: stats[1].toString(),
            wins: stats[2].toString()
        });

        const bountyCounter = await quinty.bountyCounter();
        console.log("Current bounty counter:", bountyCounter.toString());

        // Test very simple bounty creation with minimal gas
        console.log("🚀 Attempting simple bounty creation...");
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

        try {
            const gasEstimate = await quinty.createBounty.estimateGas(
                "Simple test bounty",
                deadline,
                false,
                [10000],
                25,
                { value: ethers.parseEther("0.01") } // Very small amount
            );
            console.log("Gas estimate:", gasEstimate.toString());
        } catch (gasError) {
            console.error("❌ Gas estimation failed:", gasError.message);

            // Try to get the actual error reason
            try {
                await quinty.createBounty.staticCall(
                    "Simple test bounty",
                    deadline,
                    false,
                    [10000],
                    25,
                    { value: ethers.parseEther("0.01") }
                );
            } catch (staticError) {
                console.error("❌ Static call error:", staticError.message);
            }
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);