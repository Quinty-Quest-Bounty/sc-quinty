
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const CREATOR_PRIVATE_KEY = process.env.PRIVATE_KEY;
const SOLVER_PRIVATE_KEY = "0x4591421ff92c9374e8be266b344d11a5ceaac9c54b99a2b73a6d0b6d5f8ba8f9";

if (!CREATOR_PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in .env");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creator = new ethers.Wallet(CREATOR_PRIVATE_KEY, provider);
const solver = new ethers.Wallet(SOLVER_PRIVATE_KEY, provider);

// Contract Addresses
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  console.log("🚀 Resuming Full Flow Test...");
  
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;

  const creatorQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, creator);
  const solverQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, solver);
  const creatorAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, creator);
  const solverAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, solver);

  const bountyId = Number(await creatorQuinty.bountyCounter());
  console.log(`Bounty ID: ${bountyId}`);

  // 4. Create New Quest
  console.log("\n🏗️ Creator: Creating a new Quest...");
  const perQualifier = ethers.parseEther("0.00005");
  const maxQualifiers = 2;
  const airdropDeadline = Math.floor(Date.now() / 1000) + 86400 * 3;

  const airdropTx = await creatorAirdrop.createAirdrop(
    "Solver Test Quest: Join Discord",
    "Join our Discord server to earn rewards!",
    perQualifier,
    BigInt(maxQualifiers),
    BigInt(airdropDeadline),
    "Provide Discord username and ID",
    { value: perQualifier * BigInt(maxQualifiers) }
  );
  await airdropTx.wait();
  const airdropId = Number(await creatorAirdrop.airdropCounter());
  console.log(`✅ Quest Created! ID: ${airdropId}`);

  // 5. Solver Submits to Bounty
  console.log("\n🛠️ Solver: Submitting solution to Bounty...");
  const bountyData = await creatorQuinty.getBountyData(bountyId);
  const deposit = bountyData.amount / 10n;
  const submitBountyTx = await solverQuinty.submitSolution(
    bountyId,
    "ipfs://QmBlindedSolverSolution",
    [],
    { value: deposit }
  );
  await submitBountyTx.wait();
  console.log("✅ Bounty solution submitted!");

  // 6. Solver Submits to Quest
  console.log("\n🛠️ Solver: Submitting entry to Quest...");
  const submitQuestTx = await solverAirdrop.submitEntry(
    airdropId,
    "ipfs://QmSolverQuestProof"
  );
  await submitQuestTx.wait();
  console.log("✅ Quest entry submitted!");

  // 7. Creator Resolves Bounty
  console.log("\n🏆 Creator: Selecting Solver as Bounty winner...");
  const selectWinnerTx = await creatorQuinty.selectWinners(
    bountyId,
    [solver.address],
    [0]
  );
  await selectWinnerTx.wait();
  console.log("✅ Winner selected!");

  console.log("\n🔓 Solver: Revealing solution...");
  const revealTx = await solverQuinty.revealSolution(
    bountyId,
    0,
    "ipfs://QmRevealedSolverSolution"
  );
  await revealTx.wait();
  console.log("✅ Solution revealed! Prize paid out.");

  // 8. Creator Resolves Quest
  console.log("\n🏆 Creator: Verifying Quest entry...");
  const verifyTx = await creatorAirdrop.verifyEntry(
    airdropId,
    0,
    1,
    "Verified Discord member!"
  );
  await verifyTx.wait();
  console.log("✅ Entry verified!");

  console.log("\n🏁 Creator: Finalizing Quest...");
  const finalizeTx = await creatorAirdrop.finalizeAirdrop(airdropId);
  await finalizeTx.wait();
  console.log("✅ Quest finalized! Rewards paid out.");

  console.log("\n--- Final Statistics ---");
  console.log("Creator Address:", creator.address);
  console.log("Creator Balance:", ethers.formatEther(await provider.getBalance(creator.address)), "ETH");
  console.log("Solver Address:", solver.address);
  console.log("Solver Balance:", ethers.formatEther(await provider.getBalance(solver.address)), "ETH");
  
  console.log("\n✨ solver-test flow complete!");
}

main().catch(console.error);
