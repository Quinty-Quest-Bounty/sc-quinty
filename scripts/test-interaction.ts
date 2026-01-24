
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in .env");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract Addresses
const QUINTY_ADDRESS = "0x1c52AAc4f772E2eAbcAb6A0aC7a218d3d5661d85";
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  console.log("Using wallet:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // 1. Create a Bounty
  console.log("\n--- Creating a Bounty ---");
  const quintyAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/Quinty.sol/Quinty.json", "utf8")).abi;
  const quinty = new ethers.Contract(QUINTY_ADDRESS, quintyAbi, wallet);

  const bountyAmount = ethers.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now
  const slashPercent = 3000; // 30%
  
  /*
  const bountyTx = await quinty.createBounty(
    "Test Bounty: Fix UI Bug\n\nMetadata: ipfs://QmTestBounty",
    deadline,
    false, // allowMultipleWinners
    [], // winnerShares
    slashPercent,
    false, // hasOprec
    0, // oprecDeadline
    { value: bountyAmount }
  );
  console.log("Bounty creation TX sent:", bountyTx.hash);
  await bountyTx.wait();
  console.log("✅ Bounty created successfully!");
  */
  console.log("Bounty already created in previous run (or skipped).");

  // 2. Create a Quest (Airdrop)
  console.log("\n--- Creating a Quest (Airdrop) ---");
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;
  const airdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, wallet);

  const perQualifier = ethers.parseEther("0.0001");
  const maxQualifiers = 5;
  const totalAirdropAmount = perQualifier * BigInt(maxQualifiers);
  const airdropDeadline = Math.floor(Date.now() / 1000) + 86400 * 3; // 3 days from now

  const airdropTx = await airdrop.createAirdrop(
    "Test Quest: Follow on X",
    "Join our community and follow us on X to earn rewards!",
    perQualifier,
    maxQualifiers,
    airdropDeadline,
    "1. Follow @Quinty\n2. Retweet pinned post",
    { value: totalAirdropAmount }
  );
  console.log("Quest creation TX sent:", airdropTx.hash);
  await airdropTx.wait();
  console.log("✅ Quest created successfully!");

  console.log("\n✨ Interaction complete!");
}

main().catch(console.error);
