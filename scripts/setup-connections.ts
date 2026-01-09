import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up contract connections with:", deployer.address);

  // Contract addresses from deployments.json
  const addresses = {
    Quinty: "0xdB5e489C756D4D2028CCb3515c04DaD134AB03c7",
    QuintyReputation: "0xD4c6d0fBe9A1F11e7b6A23E5F857C020B89f0763",
    DisputeResolver: "0xA5Ec58e65cC21317da82f2Ad38CCC96470668755",
    QuintyNFT: "0xAFbe103C60cE8317a1244d5cb374a065A7550F34",
    GrantProgram: "0x66993c8720c5Df2d5c0df7cC849D6c150cfDd0e1",
    LookingForGrant: "0x70D791fF9D8bd039A91a4E9F8E4D14B3a71605b6",
    Crowdfunding: "0x9133cb1c52c426358F9C1153a9aeB0D5D0c1Ef12",
  };

  // Get contract instances
  const Quinty = await ethers.getContractAt("Quinty", addresses.Quinty);
  const QuintyReputation = await ethers.getContractAt("QuintyReputation", addresses.QuintyReputation);
  const QuintyNFT = await ethers.getContractAt("QuintyNFT", addresses.QuintyNFT);
  const GrantProgram = await ethers.getContractAt("GrantProgram", addresses.GrantProgram);
  const LookingForGrant = await ethers.getContractAt("LookingForGrant", addresses.LookingForGrant);
  const Crowdfunding = await ethers.getContractAt("Crowdfunding", addresses.Crowdfunding);

  // Check current configuration
  console.log("\n--- Checking Current Configuration ---");
  const currentRep = await Quinty.reputationAddress();
  const currentDisp = await Quinty.disputeAddress();
  const currentNft = await Quinty.nftAddress();
  console.log("Current Quinty.reputationAddress:", currentRep);
  console.log("Current Quinty.disputeAddress:", currentDisp);
  console.log("Current Quinty.nftAddress:", currentNft);

  // Only set addresses if not already set
  if (currentRep === "0x0000000000000000000000000000000000000000") {
    console.log("\n--- Setting Quinty Addresses ---");
    const tx1 = await Quinty.setAddresses(
      addresses.QuintyReputation,
      addresses.DisputeResolver,
      addresses.QuintyNFT
    );
    await tx1.wait();
    console.log("✅ Quinty.setAddresses() completed");
  } else {
    console.log("\n✅ Quinty addresses already set");
  }

  // Check QuintyReputation ownership
  console.log("\n--- Checking QuintyReputation Ownership ---");
  const repOwner = await QuintyReputation.owner();
  console.log("Current QuintyReputation owner:", repOwner);

  if (repOwner.toLowerCase() !== addresses.Quinty.toLowerCase()) {
    console.log("Transferring QuintyReputation ownership to Quinty...");
    const tx2 = await QuintyReputation.transferOwnership(addresses.Quinty);
    await tx2.wait();
    console.log("✅ QuintyReputation ownership transferred to Quinty");
  } else {
    console.log("✅ QuintyReputation already owned by Quinty");
  }

  // Authorize NFT minters
  console.log("\n--- Authorizing NFT Minters ---");

  const isQuintyAuthorized = await QuintyNFT.authorizedMinters(addresses.Quinty);
  if (!isQuintyAuthorized) {
    const tx3 = await QuintyNFT.authorizeMinter(addresses.Quinty);
    await tx3.wait();
    console.log("✅ Quinty authorized to mint NFTs");
  } else {
    console.log("✅ Quinty already authorized");
  }

  const isGrantAuthorized = await QuintyNFT.authorizedMinters(addresses.GrantProgram);
  if (!isGrantAuthorized) {
    const tx4 = await QuintyNFT.authorizeMinter(addresses.GrantProgram);
    await tx4.wait();
    console.log("✅ GrantProgram authorized to mint NFTs");
  } else {
    console.log("✅ GrantProgram already authorized");
  }

  const isLfgAuthorized = await QuintyNFT.authorizedMinters(addresses.LookingForGrant);
  if (!isLfgAuthorized) {
    const tx5 = await QuintyNFT.authorizeMinter(addresses.LookingForGrant);
    await tx5.wait();
    console.log("✅ LookingForGrant authorized to mint NFTs");
  } else {
    console.log("✅ LookingForGrant already authorized");
  }

  const isCfAuthorized = await QuintyNFT.authorizedMinters(addresses.Crowdfunding);
  if (!isCfAuthorized) {
    const tx6 = await QuintyNFT.authorizeMinter(addresses.Crowdfunding);
    await tx6.wait();
    console.log("✅ Crowdfunding authorized to mint NFTs");
  } else {
    console.log("✅ Crowdfunding already authorized");
  }

  // Set NFT addresses on funding contracts
  console.log("\n--- Setting NFT Addresses on Funding Contracts ---");

  try {
    const gpNft = await GrantProgram.nftAddress();
    if (gpNft === "0x0000000000000000000000000000000000000000") {
      const tx7 = await GrantProgram.setNFTAddress(addresses.QuintyNFT);
      await tx7.wait();
      console.log("✅ GrantProgram.setNFTAddress() completed");
    } else {
      console.log("✅ GrantProgram NFT already set");
    }
  } catch (e) {
    console.log("⚠️ GrantProgram.setNFTAddress might not exist or already set");
  }

  try {
    const lfgNft = await LookingForGrant.nftAddress();
    if (lfgNft === "0x0000000000000000000000000000000000000000") {
      const tx8 = await LookingForGrant.setNFTAddress(addresses.QuintyNFT);
      await tx8.wait();
      console.log("✅ LookingForGrant.setNFTAddress() completed");
    } else {
      console.log("✅ LookingForGrant NFT already set");
    }
  } catch (e) {
    console.log("⚠️ LookingForGrant.setNFTAddress might not exist or already set");
  }

  try {
    const cfNft = await Crowdfunding.nftAddress();
    if (cfNft === "0x0000000000000000000000000000000000000000") {
      const tx9 = await Crowdfunding.setNFTAddress(addresses.QuintyNFT);
      await tx9.wait();
      console.log("✅ Crowdfunding.setNFTAddress() completed");
    } else {
      console.log("✅ Crowdfunding NFT already set");
    }
  } catch (e) {
    console.log("⚠️ Crowdfunding.setNFTAddress might not exist or already set");
  }

  console.log("\n🎉 Setup complete!");

  // Final verification
  console.log("\n--- Final Verification ---");
  const finalRep = await Quinty.reputationAddress();
  const finalDisp = await Quinty.disputeAddress();
  const finalNft = await Quinty.nftAddress();
  console.log("Quinty.reputationAddress:", finalRep);
  console.log("Quinty.disputeAddress:", finalDisp);
  console.log("Quinty.nftAddress:", finalNft);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
