
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

  const bountyId = 2;
  console.log(`Checking Bounty ID: ${bountyId}`);
  try {
    const bounty = await quinty.getBountyData(bountyId);
    console.log("Bounty Status:", bounty.status.toString()); 
    
    const submissionCount = await quinty.getSubmissionCount(bountyId);
    console.log("Submission Count:", submissionCount.toString());
    
    if (submissionCount > 0) {
        const sub = await quinty.getSubmission(bountyId, 0);
        console.log("Submission 0 Solver:", sub.solver);
        console.log("Submission 0 Revealed CID:", sub.revealIpfsCid);
    }
  } catch (e: any) {
    console.log("Error checking bounty:", e.message);
  }

  const airdropId = 1;
  console.log(`\nChecking Airdrop ID: ${airdropId}`);
  try {
    const ad = await airdrop.getAirdrop(airdropId);
    console.log("Airdrop Title:", ad.title);
    console.log("Airdrop Resolved:", ad.resolved);
    console.log("Airdrop Cancelled:", ad.cancelled);
    
    const entryCount = await airdrop.getEntryCount(airdropId);
    console.log("Entry Count:", entryCount.toString());
    
    if (entryCount > 0) {
        const entry = await airdrop.getEntry(airdropId, 0);
        console.log("Entry 0 Solver:", entry.solver);
        console.log("Entry 0 Status:", entry.status.toString());
    }
  } catch (e: any) {
    console.log("Error checking airdrop:", e.message);
  }
}

main().catch(console.error);
