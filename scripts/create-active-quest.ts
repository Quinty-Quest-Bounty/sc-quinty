
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const CREATOR_PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const AIRDROP_ADDRESS = "0x920c7eCC8A9AC48B0aEb5Ea91768964208b82938";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const creator = new ethers.Wallet(CREATOR_PRIVATE_KEY, provider);
  const airdropAbi = JSON.parse(fs.readFileSync("./artifacts/contracts/AirdropBounty.sol/AirdropBounty.json", "utf8")).abi;
  const airdrop = new ethers.Contract(AIRDROP_ADDRESS, airdropAbi, creator);

  console.log("🏗️ Creating an ACTIVE Quest for the frontend...");
  
  const title = "Community Welcome Quest";
  const description = "Welcome to Quinty! Share our platform on social media to earn your first reward. \n\nImage: ipfs://QmYwAPJzv99idC68v9tM8Lbx69LpPaa6z2297NfH9GndJ8";
  const perQualifier = ethers.parseEther("0.00001");
  const maxQualifiers = 5;
  const deadline = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days
  const requirements = "1. Follow Quinty on X\n2. Post a screenshot of your profile\n3. Tag 2 friends";

  const tx = await airdrop.createAirdrop(
    title,
    description,
    perQualifier,
    maxQualifiers,
    deadline,
    requirements,
    { value: perQualifier * BigInt(maxQualifiers) }
  );

  console.log("Transaction Sent:", tx.hash);
  await tx.wait();
  console.log("✅ Active Quest Created successfully!");
}

main().catch(console.error);
