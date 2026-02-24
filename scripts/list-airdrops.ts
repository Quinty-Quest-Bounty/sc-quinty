
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Contract Addresses
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;
  const airdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, provider);

  console.log("Checking last 5 airdrops...");
  for (let i = 1; i <= 5; i++) {
    try {
      const ad = await airdrop.getAirdrop(i);
      console.log(`Airdrop ID ${i}: Title=${ad.title}, Resolved=${ad.resolved}`);
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
