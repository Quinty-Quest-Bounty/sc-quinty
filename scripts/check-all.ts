
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Contract Addresses
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;
  const quinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, provider);
  const airdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, provider);

  console.log("--- Bounties ---");
  for (let i = 1; i <= 2; i++) {
    const b = await quinty.getBountyData(i);
    console.log(`Bounty #${i}: Status=${b.status}, Creator=${b.creator}`);
    const subCount = await quinty.getSubmissionCount(i);
    for (let j = 0; j < Number(subCount); j++) {
        const sub = await quinty.getSubmission(i, j);
        console.log(`  Sub ${j}: Solver=${sub.solver}, Revealed=${sub.revealIpfsCid !== ""}`);
    }
  }

  console.log("\n--- Airdrops ---");
  for (let i = 1; i <= 2; i++) {
    const ad = await airdrop.getAirdrop(i);
    console.log(`Airdrop #${i}: Title=${ad.title}, Resolved=${ad.resolved}`);
    const entryCount = await airdrop.getEntryCount(i);
    for (let j = 0; j < Number(entryCount); j++) {
        const entry = await airdrop.getEntry(i, j);
        console.log(`  Entry ${j}: Solver=${entry.solver}, Status=${entry.status}`);
    }
  }
}
main();
