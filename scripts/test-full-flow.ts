
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const PRIMARY_PRIVATE_KEY = process.env.PRIVATE_KEY;
const TESTER_PRIVATE_KEY = "0xe0078784a7a60cfbd6f5527825ca32fd20fcf7a80476d524e050b97dcff40c99";

if (!PRIMARY_PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in .env");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creatorWallet = new ethers.Wallet(PRIMARY_PRIVATE_KEY, provider);
const testerWallet = new ethers.Wallet(TESTER_PRIVATE_KEY, provider);

// Contract Addresses
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  console.log("Creator Wallet:", creatorWallet.address);
  console.log("Tester Wallet (Solver):", testerWallet.address);

  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;

  const creatorQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, creatorWallet);
  const testerQuinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, testerWallet);
  const creatorAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, creatorWallet);
  const testerAirdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, testerWallet);

  const BOUNTY_ID = 1;
  const AIRDROP_ID = 1;

  // Check current status of Bounty
  let bountyData = await creatorQuinty.getBountyData(BOUNTY_ID);
  console.log("Current Bounty Status:", bountyData.status.toString());
  // Status Enum: 0:OPREC, 1:OPEN, 2:PENDING_REVEAL, 3:RESOLVED, 4:EXPIRED

  if (bountyData.status === 1n) {
    console.log("\n--- Creator: Selecting Tester as winner ---");
    const selectWinnerTx = await creatorQuinty.selectWinners(
      BOUNTY_ID,
      [testerWallet.address],
      [0]
    );
    await selectWinnerTx.wait();
    console.log("✅ Tester selected as winner!");
    console.log("Waiting for block indexing (15s)...");
    await new Promise(r => setTimeout(r, 15000));
    bountyData = await creatorQuinty.getBountyData(BOUNTY_ID);
  }

  if (bountyData.status === 2n) {
    console.log("\n--- Tester: Revealing solution ---");
    const revealTx = await testerQuinty.revealSolution(
      BOUNTY_ID,
      0,
      "ipfs://QmRevealedSolutionTester"
    );
    await revealTx.wait();
    console.log("✅ Solution revealed and prize received!");
  } else if (bountyData.status === 3n) {
    console.log("Bounty already resolved.");
  }

  // Quest Flow
  console.log("\n--- Checking Quest Status ---");
  const airdropData = await creatorAirdrop.getAirdrop(AIRDROP_ID);
  const entryCount = await creatorAirdrop.getEntryCount(AIRDROP_ID);
  console.log(`Quest: ${airdropData.title}, Entries: ${entryCount}`);

  if (Number(entryCount) > 0) {
    const entry = await creatorAirdrop.getEntry(AIRDROP_ID, 0);
    console.log("Entry Status:", entry.status.toString()); // 0: Pending, 1: Approved, 2: Rejected

    if (entry.status === 0) {
      console.log("\n--- Creator: Verifying quest entry ---");
      const verifyTx = await creatorAirdrop.verifyEntry(
        AIRDROP_ID,
        0,
        1, // Status: Approved
        "Great job, verified!"
      );
      await verifyTx.wait();
      console.log("✅ Quest entry verified!");
    }

    if (!airdropData.resolved) {
        // Check if deadline passed
        const now = Math.floor(Date.now() / 1000);
        if (now < Number(airdropData.deadline)) {
            console.log("Deadline not passed yet. Forcing deadline skip (wait or update if possible).");
            console.log("Deadline is in:", Number(airdropData.deadline) - now, "seconds");
            // Since I can't wait days, I'll just try finalize. If contract allows finalize before deadline (if creator), it might work.
            // Actually, AirdropBounty finalizeAirdrop might have deadline check.
        }

        console.log("\n--- Creator: Finalizing quest ---");
        try {
            const finalizeTx = await creatorAirdrop.finalizeAirdrop(AIRDROP_ID);
            await finalizeTx.wait();
            console.log("✅ Quest finalized and rewards distributed!");
        } catch (e: any) {
            console.log("❌ Finalization failed (likely deadline not reached):", e.reason || e.message);
        }
    } else {
        console.log("Quest already resolved.");
    }
  }

  console.log("\n--- Final Balances ---");
  console.log("Creator:", ethers.formatEther(await provider.getBalance(creatorWallet.address)), "ETH");
  console.log("Tester:", ethers.formatEther(await provider.getBalance(testerWallet.address)), "ETH");
  
  console.log("\n✨ Flow check completed!");
}

main().catch(console.error);
