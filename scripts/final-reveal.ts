
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const SOLVER_PRIVATE_KEY = "0x4591421ff92c9374e8be266b344d11a5ceaac9c54b99a2b73a6d0b6d5f8ba8f9";
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const solver = new ethers.Wallet(SOLVER_PRIVATE_KEY, provider);
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const quinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, solver);

  const bountyId = 2;
  const data = await quinty.getBountyData(bountyId);
  console.log(`Bounty Status: ${data.status}`);
  console.log(`Bounty Selected Winners: ${data.selectedWinners}`);
  console.log(`Bounty Selected Subs: ${data.selectedSubmissionIds}`);

  if (data.status === 2n) {
    console.log("Attempting reveal...");
    try {
        const tx = await quinty.revealSolution(bountyId, 0, "ipfs://QmFinalRevealDone");
        console.log("TX Sent:", tx.hash);
        await tx.wait();
        console.log("✅ Reveal Successful!");
    } catch (e: any) {
        console.log("❌ Reveal Failed:", e.message);
    }
  } else {
    console.log("Status is not 2. Current status:", data.status);
  }
  
  const balance = await provider.getBalance(solver.address);
  console.log("Final Solver Balance:", ethers.formatEther(balance));
}
main();
