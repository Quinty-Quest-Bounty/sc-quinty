import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Quinty, QuintyReputation, DisputeResolver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Quinty", function () {
  let quinty: Quinty;
  let reputation: QuintyReputation;
  let creator: SignerWithAddress;
  let solver1: SignerWithAddress;
  let solver2: SignerWithAddress;
  let other: SignerWithAddress;

  const BOUNCE_AMOUNT = ethers.parseEther("1");
  const SUBMISSION_DEPOSIT = ethers.parseEther("0.1");
  const SLASH_PERCENT = 3000; // 30%

  beforeEach(async function () {
    [creator, solver1, solver2, other] = await ethers.getSigners();

    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    reputation = await QuintyReputation.deploy("ipfs://base/");

    const Quinty = await ethers.getContractFactory("Quinty");
    quinty = await Quinty.deploy();

    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    const nft = await QuintyNFT.deploy("ipfs://nft/");

    await quinty.setAddresses(await reputation.getAddress(), await nft.getAddress());
    await reputation.transferOwnership(await quinty.getAddress());
  });

  describe("Bounty Creation", function () {
    it("Should create a simple bounty", async function () {
      const deadline = (await time.latest()) + 86400;
      await expect(
        quinty
          .connect(creator)
          .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, false, 0, { value: BOUNCE_AMOUNT })
      ).to.emit(quinty, "BountyCreated");

      const bounty = await quinty.getBountyData(1);
      expect(bounty.creator).to.equal(creator.address);
      expect(bounty.amount).to.equal(BOUNCE_AMOUNT);
      expect(bounty.status).to.equal(1); // OPEN
    });

    it("Should fail if no value sent", async function () {
      const deadline = (await time.latest()) + 86400;
      await expect(
        quinty.connect(creator).createBounty("Test", deadline, false, [], SLASH_PERCENT, false, 0)
      ).to.be.revertedWith("Escrow required");
    });
  });

  describe("Submissions", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, false, 0, { value: BOUNCE_AMOUNT });
    });

    it("Should allow a solver to submit", async function () {
      await expect(
        quinty.connect(solver1).submitSolution(1, "QmTestCid", [], { value: SUBMISSION_DEPOSIT })
      ).to.emit(quinty, "SubmissionCreated");

      expect(await quinty.getSubmissionCount(1)).to.equal(1);
    });

    it("Should fail if deposit is insufficient", async function () {
      await expect(
        quinty.connect(solver1).submitSolution(1, "QmTestCid", [], { value: 0 })
      ).to.be.revertedWith("10% deposit required");
    });
  });

  describe("Winner Selection and Reveal", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, false, 0, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmTestCid1", [], { value: SUBMISSION_DEPOSIT });
    });

    it("Should allow creator to select winner", async function () {
      await expect(
        quinty.connect(creator).selectWinners(1, [solver1.address], [0])
      ).to.emit(quinty, "WinnersSelected");

      const bounty = await quinty.getBountyData(1);
      expect(bounty.status).to.equal(2); // PENDING_REVEAL
    });

    it("Should allow winner to reveal and get paid", async function () {
      await quinty.connect(creator).selectWinners(1, [solver1.address], [0]);

      const initialBalance = await ethers.provider.getBalance(solver1.address);

      await expect(
        quinty.connect(solver1).revealSolution(1, 0, "QmRevealCid")
      ).to.emit(quinty, "SolutionRevealed");

      const finalBalance = await ethers.provider.getBalance(solver1.address);
      expect(finalBalance).to.be.gt(initialBalance);

      const bounty = await quinty.getBountyData(1);
      expect(bounty.status).to.equal(3); // RESOLVED
    });
  });

  describe("Reputation System", function () {
    it("Should update creator reputation on bounty creation", async function () {
      const deadline = (await time.latest()) + 86400;

      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, false, 0, { value: BOUNCE_AMOUNT });

      const rep = await reputation.getUserStats(creator.address);
      expect(rep.totalBountiesCreated).to.equal(1);
      expect(rep.totalWins).to.equal(0);
    });

    it("Should update solver reputation on submission", async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, false, 0, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmTest", [], { value: SUBMISSION_DEPOSIT });

      const rep = await reputation.getUserStats(solver1.address);
      expect(rep.totalSubmissions).to.equal(1);
    });
  });
});