
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;
  const quinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, provider);
  const airdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, provider);

  const bountyId = 2;
  const bountyData = await quinty.getBountyData(bountyId);
  console.log(`Bounty #2 Amount: ${ethers.formatEther(bountyData.amount)} ETH`);
  const count = await quinty.getSubmissionCount(bountyId);
  console.log(`Bounty #2 Submission Count: ${count}`);
  for (let i = 0; i < Number(count); i++) {
    const sub = await quinty.getSubmission(bountyId, i);
    console.log(`Sub ${i}: Solver=${sub.solver}, Revealed=${sub.revealIpfsCid !== ""}`);
  }

  const airdropId = 2;
  const entryCount = await airdrop.getEntryCount(airdropId);
  console.log(`Airdrop #2 Entry Count: ${entryCount}`);
  for (let i = 0; i < Number(entryCount); i++) {
    const entry = await airdrop.getEntry(airdropId, i);
    console.log(`Entry ${i}: Solver=${entry.solver}, Status=${entry.status}`);
  }
}
main();
