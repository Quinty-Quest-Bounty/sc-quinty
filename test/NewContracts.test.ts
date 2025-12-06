import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("New Contracts - Basic Tests", function () {
  let grantProgram: any;
  let lookingForGrant: any;
  let crowdfunding: any;
  let quintyNFT: any;
  let socialVerification: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;

  const GRANT_AMOUNT = ethers.parseEther("10.0");
  const SUPPORT_AMOUNT = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy all contracts
    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    quintyNFT = await QuintyNFT.deploy("ipfs://QmBase/");
    await quintyNFT.waitForDeployment();

    const GrantProgram = await ethers.getContractFactory("GrantProgram");
    grantProgram = await GrantProgram.deploy();
    await grantProgram.waitForDeployment();

    const LookingForGrant = await ethers.getContractFactory("LookingForGrant");
    lookingForGrant = await LookingForGrant.deploy();
    await lookingForGrant.waitForDeployment();

    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    crowdfunding = await Crowdfunding.deploy();
    await crowdfunding.waitForDeployment();

    const SocialVerification = await ethers.getContractFactory("SocialVerification");
    socialVerification = await SocialVerification.deploy();
    await socialVerification.waitForDeployment();

    // Set NFT addresses
    await grantProgram.setNFTAddress(await quintyNFT.getAddress());
    await lookingForGrant.setNFTAddress(await quintyNFT.getAddress());
    await crowdfunding.setNFTAddress(await quintyNFT.getAddress());

    // Authorize contracts to mint badges
    await quintyNFT.authorizeMinter(await grantProgram.getAddress());
    await quintyNFT.authorizeMinter(await lookingForGrant.getAddress());
    await quintyNFT.authorizeMinter(await crowdfunding.getAddress());
  });

  describe("QuintyNFT", function () {
    it("Should mint badges", async function () {
      await expect(quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/"))
        .to.emit(quintyNFT, "BadgeMinted");

      expect(await quintyNFT.ownerOf(1)).to.equal(user1.address);
    });

    it("Should prevent transfers (soulbound)", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/");

      await expect(
        quintyNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Transfer not allowed");
    });

    it("Should query user badges", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge1/");
      await quintyNFT.mintBadge(user1.address, 1, "ipfs://badge2/");

      const badges = await quintyNFT.getUserBadges(user1.address);
      expect(badges.length).to.equal(2);
    });
  });

  describe("GrantProgram", function () {
    it("Should create a grant", async function () {
      const appDeadline = (await time.latest()) + 86400;
      const distDeadline = appDeadline + 86400;

      await expect(
        grantProgram.connect(user1).createGrant(
          "Research Grant",
          "QmDetails",
          10,
          appDeadline,
          distDeadline,
          { value: GRANT_AMOUNT }
        )
      ).to.emit(grantProgram, "GrantCreated");

      expect(await grantProgram.grantCounter()).to.equal(1);
    });

    it("Should accept applications", async function () {
      const appDeadline = (await time.latest()) + 86400;
      const distDeadline = appDeadline + 86400;

      await grantProgram.connect(user1).createGrant(
        "Research Grant",
        "QmDetails",
        10,
        appDeadline,
        distDeadline,
        { value: GRANT_AMOUNT }
      );

      await expect(
        grantProgram.connect(user2).applyForGrant(
          1,
          "QmProposal",
          "QmSocial",
          ethers.parseEther("2.0")
        )
      ).to.emit(grantProgram, "ApplicationSubmitted");
    });
  });

  describe("LookingForGrant", function () {
    it("Should create funding request", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        lookingForGrant.connect(user1).createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocial",
          "QmOffering",
          GRANT_AMOUNT,
          deadline
        )
      ).to.emit(lookingForGrant, "FundingRequestCreated");

      expect(await lookingForGrant.requestCounter()).to.equal(1);
    });

    it("Should accept support", async function () {
      const deadline = (await time.latest()) + 86400;

      await lookingForGrant.connect(user1).createFundingRequest(
        "DeFi Protocol",
        "QmProjectDetails",
        "QmProgress",
        "QmSocial",
        "QmOffering",
        GRANT_AMOUNT,
        deadline
      );

      await expect(
        lookingForGrant.connect(user2).supportRequest(1, { value: SUPPORT_AMOUNT })
      ).to.emit(lookingForGrant, "SupportReceived");
    });
  });

  describe("Crowdfunding", function () {
    it("Should create campaign", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("6"), ethers.parseEther("4")];

      await expect(
        crowdfunding.connect(user1).createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          GRANT_AMOUNT,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        )
      ).to.emit(crowdfunding, "CampaignCreated");

      expect(await crowdfunding.campaignCounter()).to.equal(1);
    });

    it("Should accept contributions", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1"];
      const milestoneAmounts = [GRANT_AMOUNT];

      await crowdfunding.connect(user1).createCampaign(
        "Gaming Platform",
        "QmProjectDetails",
        "QmSocialAccounts",
        GRANT_AMOUNT,
        deadline,
        milestoneDescriptions,
        milestoneAmounts
      );

      await expect(
        crowdfunding.connect(user2).contribute(1, { value: SUPPORT_AMOUNT })
      ).to.emit(crowdfunding, "ContributionReceived");
    });
  });

  describe("SocialVerification", function () {
    it("Should allow owner to add verifiers", async function () {
      await expect(socialVerification.addVerifier(user1.address))
        .to.emit(socialVerification, "VerifierAdded");
    });

    it("Should allow verifier to verify users", async function () {
      await socialVerification.addVerifier(user1.address);

      await expect(
        socialVerification.connect(user1).verifyUser(
          user2.address,
          "@user2",
          "Institution Name",
          ethers.keccak256(ethers.toUtf8Bytes("proof"))
        )
      ).to.emit(socialVerification, "UserVerified");

      const verification = await socialVerification.verifications(user2.address);
      expect(verification.isVerified).to.be.true;
    });

    it("Should prevent non-verifier from verifying", async function () {
      await expect(
        socialVerification.connect(user1).verifyUser(
          user2.address,
          "@user2",
          "Institution Name",
          ethers.keccak256(ethers.toUtf8Bytes("proof"))
        )
      ).to.be.revertedWith("Not authorized verifier");
    });
  });
});
