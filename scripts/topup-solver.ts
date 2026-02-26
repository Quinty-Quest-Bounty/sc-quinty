
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://sepolia.base.org";
const CREATOR_PRIVATE_KEY = process.env.PRIVATE_KEY as string;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const creator = new ethers.Wallet(CREATOR_PRIVATE_KEY, provider);
  const solverAddress = "0x39FcA6C96f8551DAF7eB89Df164D72F586D150f6";

  console.log("Sending 0.002 ETH from Creator to Solver...");
  const tx = await creator.sendTransaction({
    to: solverAddress,
    value: ethers.parseEther("0.002")
  });
  await tx.wait();
  console.log("✅ Top-up successful!");
  
  const balance = await provider.getBalance(solverAddress);
  console.log("New Solver Balance:", ethers.formatEther(balance), "ETH");
}

main();
