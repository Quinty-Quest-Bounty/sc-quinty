// Test script to run in hardhat console
// npx hardhat console --network somniaTestnet
// Then run: .load console-test.js

const quintyAddr = "0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15";
const reputationAddr = "0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F";

async function testNow() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const Quinty = await ethers.getContractFactory("Quinty");
    const quinty = Quinty.attach(quintyAddr);

    // Check if addresses are set correctly
    const repAddr = await quinty.reputationAddress();
    console.log("Quinty reputation address:", repAddr);
    console.log("Expected:", reputationAddr);

    const disputeAddr = await quinty.disputeAddress();
    console.log("Quinty dispute address:", disputeAddr);

    return { quinty, deployer };
}

// Call this function to run the test
testNow().then(console.log).catch(console.error);