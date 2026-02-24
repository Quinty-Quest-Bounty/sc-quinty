
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const CREATOR_PRIVATE_KEY = process.env.PRIVATE_KEY;
const SOLVER_PRIVATE_KEY = "0x4591421ff92c9374e8be266b344d11a5ceaac9c54b99a2b73a6d0b6d5f8ba8f9";

if (!CREATOR_PRIVATE_KEY) throw new Error("CREATOR_PRIVATE_KEY not found");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creator = new ethers.Wallet(CREATOR_PRIVATE_KEY, provider);
const solver = new ethers.Wallet(SOLVER_PRIVATE_KEY, provider);

const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;

  const creatorQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, creator);
  const solverQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, solver);
  const creatorAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, creator);
  const solverAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, solver);

  const bountyId = 2;
  const airdropId = 2;

  // 1. Solver: Submit entry to Quest #2
  console.log("\n🛠️ Solver: Submitting entry to Quest #2...");
  try {
    const tx = await solverAirdrop.submitEntry(airdropId, "ipfs://QmSolverQuestProof2");
    await tx.wait();
    console.log("✅ Quest entry submitted!");
  } catch (e: any) {
    console.log("Quest submission skipped/failed:", e.reason || e.message);
  }

  // 2. Creator: Select Winner for Bounty #2
  console.log("\n🏆 Creator: Selecting Solver as Bounty #2 winner...");
  try {
    const tx = await creatorQuinty.selectWinners(bountyId, [solver.address], [0]);
    await tx.wait();
    console.log("✅ Winner selected!");
  } catch (e: any) {
    console.log("Winner selection skipped/failed:", e.reason || e.message);
  }

  // 3. Solver: Reveal Solution for Bounty #2
  console.log("\n🔓 Solver: Revealing solution for Bounty #2...");
  try {
    const tx = await solverQuinty.revealSolution(bountyId, 0, "ipfs://QmRevealedSolverSolution2");
    await tx.wait();
    console.log("✅ Solution revealed! Prize should be paid.");
  } catch (e: any) {
    console.log("Reveal failed:", e.reason || e.message);
  }

  // 4. Creator: Verify Quest Entry
  console.log("\n🏆 Creator: Verifying Quest entry...");
  try {
    const tx = await creatorAirdrop.verifyEntry(airdropId, 0, 1, "Verified!");
    await tx.wait();
    console.log("✅ Entry verified!");
  } catch (e: any) {
    console.log("Verification failed:", e.reason || e.message);
  }

  // 5. Creator: Finalize Quest
  console.log("\n🏁 Creator: Finalizing Quest...");
  try {
    const tx = await creatorAirdrop.finalizeAirdrop(airdropId);
    await tx.wait();
    console.log("✅ Quest finalized!");
  } catch (e: any) {
    console.log("Finalize failed:", e.reason || e.message);
  }

  const solverBalance = await provider.getBalance(solver.address);
  console.log("\nFinal Solver Balance:", ethers.formatEther(solverBalance), "ETH");
}

main();
