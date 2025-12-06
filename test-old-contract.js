const { ethers } = require("hardhat");

async function main() {
    // Use the older contract that we know has working NFTs
    const OLD_QUINTY_REPUTATION = "0x832b2B307288d1C515fa51334992811927647567";

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    const reputation = QuintyReputation.attach(OLD_QUINTY_REPUTATION);

    console.log("🔍 Testing old contract that has NFTs...");

    try {
        // Test tokenURI for existing NFTs (we saw #1, #2, #3 in explorer)
        console.log("📄 Testing tokenURI for existing NFTs...");

        for (let tokenId = 1; tokenId <= 3; tokenId++) {
            try {
                const owner = await reputation.ownerOf(tokenId);
                console.log(`Token #${tokenId} owner:`, owner);

                const tokenURI = await reputation.tokenURI(tokenId);
                console.log(`Token #${tokenId} URI length:`, tokenURI.length);
                console.log(`Token #${tokenId} URI prefix:`, tokenURI.substring(0, 50) + "...");

                // Try to decode if it's base64
                if (tokenURI.startsWith("data:application/json;base64,")) {
                    const base64Data = tokenURI.split(",")[1];
                    try {
                        const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
                        console.log(`Token #${tokenId} decoded:`, decoded.substring(0, 100) + "...");
                    } catch (e) {
                        console.log(`Token #${tokenId} decode error:`, e.message);
                    }
                }

            } catch (e) {
                console.log(`Token #${tokenId} error:`, e.message);
            }
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error);