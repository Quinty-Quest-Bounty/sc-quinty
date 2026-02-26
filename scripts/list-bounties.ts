
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Contract Addresses
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";

async function main() {
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const quinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, provider);

  console.log("Checking last 5 bounties...");
  for (let i = 1; i <= 5; i++) {
    try {
      const bounty = await quinty.getBountyData(i);
      console.log(`Bounty ID ${i}: Status=${bounty.status.toString()}, Creator=${bounty.creator}`);
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
