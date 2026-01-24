
import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/QuintyReputation.sol/QuintyReputation.json", "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode;
  
  const factory = new ethers.ContractFactory(abi, bytecode);
  const reputationBaseURI = "ipfs://QmQuintyReputationMetadata/";
  
  const deployTx = await factory.getDeployTransaction(reputationBaseURI);
  console.log(deployTx.data);
}

main();
