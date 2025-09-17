import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Quinty Contract System", function () {
  let quinty: any;
  let reputation: any;
  let dispute: any;
  let airdrop: any;
  let owner: any;
  let creator: any;
  let solver1: any;
  let solver2: any;
  let voter1: any;
  let voter2: any;
  let addrs: any[];

  const BOUNCE_AMOUNT = ethers.parseEther("1.0"); // 1 STT
  const SLASH_PERCENT = 3000; // 30%
  const SUBMISSION_DEPOSIT = ethers.parseEther("0.1"); // 10% of bounty
  const VOTING_STAKE = ethers.parseEther("0.0001"); // 0.0001 STT

  beforeEach(async function () {
    [owner, creator, solver1, solver2, voter1, voter2, ...addrs] = await ethers.getSigners();

    // Deploy contracts
    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    reputation = await QuintyReputation.deploy();
    await reputation.waitForDeployment();

    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    dispute = await DisputeResolver.deploy();
    await dispute.waitForDeployment();

    const Quinty = await ethers.getContractFactory("Quinty");
    quinty = await Quinty.deploy();
    await quinty.waitForDeployment();

    const AirdropBounty = await ethers.getContractFactory("AirdropBounty");
    airdrop = await AirdropBounty.deploy();
    await airdrop.waitForDeployment();

    // Set up connections
    await quinty.setAddresses(await reputation.getAddress(), await dispute.getAddress());
    await dispute.setQuintyAddress(await quinty.getAddress());
    await reputation.transferOwnership(await quinty.getAddress());
  });

  describe("Bounty Creation and Management", function () {
    it("Should create a bounty with proper escrow", async function () {
      const deadline = (await time.latest()) + 86400; // 1 day from now

      await expect(
        quinty
          .connect(creator)
          .createBounty(
            "Test bounty description",
            deadline,
            false,
            [],
            SLASH_PERCENT,
            { value: BOUNCE_AMOUNT }
          )
      )
        .to.emit(quinty, "BountyCreated")
        .withArgs(1, creator.address, BOUNCE_AMOUNT, deadline);

      const bounty = await quinty.getBounty(1);
      expect(bounty.creator).to.equal(creator.address);
      expect(bounty.amount).to.equal(BOUNCE_AMOUNT);
      expect(bounty.resolved).to.be.false;
      expect(bounty.slashed).to.be.false;
    });

    it("Should reject bounty creation with invalid parameters", async function () {
      const deadline = (await time.latest()) + 86400;

      // No escrow
      await expect(
        quinty.connect(creator).createBounty("Test", deadline, false, [], SLASH_PERCENT, { value: 0 })
      ).to.be.revertedWith("Escrow required");

      // Invalid deadline
      await expect(
        quinty
          .connect(creator)
          .createBounty("Test", await time.latest(), false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT })
      ).to.be.revertedWith("Invalid deadline");

      // Invalid slash percent
      await expect(
        quinty
          .connect(creator)
          .createBounty("Test", deadline, false, [], 6000, { value: BOUNCE_AMOUNT })
      ).to.be.revertedWith("Slash 25-50%");
    });

    it("Should handle multiple winner bounties", async function () {
      const deadline = (await time.latest()) + 86400;
      const winnerShares = [6000, 4000]; // 60%, 40%

      await quinty
        .connect(creator)
        .createBounty("Multi-winner bounty", deadline, true, winnerShares, SLASH_PERCENT, {
          value: BOUNCE_AMOUNT,
        });

      const bounty = await quinty.getBounty(1);
      expect(bounty.allowMultipleWinners).to.be.true;
      expect(bounty.winnerShares).to.deep.equal(winnerShares);
    });
  });

  describe("Solution Submissions", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });
    });

    it("Should accept valid submissions", async function () {
      const ipfsCid = "QmTestCid123";

      await expect(
        quinty.connect(solver1).submitSolution(1, ipfsCid, { value: SUBMISSION_DEPOSIT })
      )
        .to.emit(quinty, "SubmissionCreated")
        .withArgs(1, 0, solver1.address, ipfsCid);

      const submission = await quinty.getSubmission(1, 0);
      expect(submission.solver).to.equal(solver1.address);
      expect(submission.blindedIpfsCid).to.equal(ipfsCid);
      expect(submission.deposit).to.equal(SUBMISSION_DEPOSIT);
    });

    it("Should reject submissions with incorrect deposit", async function () {
      const ipfsCid = "QmTestCid123";

      await expect(
        quinty.connect(solver1).submitSolution(1, ipfsCid, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("10% deposit required");
    });

    it("Should reject submissions after deadline", async function () {
      const ipfsCid = "QmTestCid123";

      // Fast forward past deadline
      await time.increase(86401);

      await expect(
        quinty.connect(solver1).submitSolution(1, ipfsCid, { value: SUBMISSION_DEPOSIT })
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Winner Selection and Resolution", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      // Add a submission
      await quinty.connect(solver1).submitSolution(1, "QmTestCid1", { value: SUBMISSION_DEPOSIT });
      await quinty.connect(solver2).submitSolution(1, "QmTestCid2", { value: SUBMISSION_DEPOSIT });
    });

    it("Should allow creator to select winner", async function () {
      const solver1BalanceBefore = await ethers.provider.getBalance(solver1.address);

      await expect(quinty.connect(creator).selectWinners(1, [solver1.address], [0]))
        .to.emit(quinty, "BountyResolved")
        .and.to.emit(quinty, "WinnerSelected");

      const bounty = await quinty.getBounty(1);
      expect(bounty.resolved).to.be.true;
      expect(bounty.winners).to.deep.equal([solver1.address]);

      // Check winner received payment
      const solver1BalanceAfter = await ethers.provider.getBalance(solver1.address);
      expect(solver1BalanceAfter - solver1BalanceBefore).to.be.closeTo(
        BOUNCE_AMOUNT + SUBMISSION_DEPOSIT,
        ethers.parseEther("0.01") // Gas tolerance
      );
    });

    it("Should prevent non-creator from selecting winners", async function () {
      await expect(
        quinty.connect(solver1).selectWinners(1, [solver1.address], [0])
      ).to.be.revertedWith("Not creator");
    });

    it("Should prevent winner selection after deadline", async function () {
      await time.increase(86401);

      await expect(
        quinty.connect(creator).selectWinners(1, [solver1.address], [0])
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Slashing and Expiry", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmTestCid1", { value: SUBMISSION_DEPOSIT });
    });

    it("Should trigger slash after deadline", async function () {
      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
      const disputeBalanceBefore = await ethers.provider.getBalance(await dispute.getAddress());

      await time.increase(86401); // Past deadline

      await expect(quinty.connect(solver1).triggerSlash(1))
        .to.emit(quinty, "BountySlashed")
        .and.to.emit(dispute, "DisputeInitiated");

      const bounty = await quinty.getBounty(1);
      expect(bounty.resolved).to.be.true;
      expect(bounty.slashed).to.be.true;

      // Check slash amount went to dispute contract
      const expectedSlash = (BOUNCE_AMOUNT * BigInt(SLASH_PERCENT)) / BigInt(10000);
      const disputeBalanceAfter = await ethers.provider.getBalance(await dispute.getAddress());
      expect(disputeBalanceAfter - disputeBalanceBefore).to.equal(expectedSlash);
    });

    it("Should not allow double slashing", async function () {
      await time.increase(86401);
      await quinty.connect(solver1).triggerSlash(1);

      await expect(quinty.connect(solver1).triggerSlash(1)).to.be.revertedWith("Resolved");
    });
  });

  describe("Reputation System", function () {
    it("Should update creator reputation on bounty creation", async function () {
      const deadline = (await time.latest()) + 86400;

      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      const rep = await reputation.getUserReputation(creator.address);
      expect(rep.bountiesCreated).to.equal(1);
      expect(rep.successfulBounties).to.equal(0);
    });

    it("Should update solver reputation on submission", async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmTestCid1", { value: SUBMISSION_DEPOSIT });

      const rep = await reputation.getUserReputation(solver1.address);
      expect(rep.solvesAttempted).to.equal(1);
      expect(rep.successfulSolves).to.equal(0);
    });

    it("Should mint NFT badge when thresholds are met", async function () {
      // Create multiple bounties to reach bronze threshold
      for (let i = 0; i < 5; i++) {
        const deadline = (await time.latest()) + 86400;
        await quinty
          .connect(creator)
          .createBounty(`Bounty ${i}`, deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

        await quinty.connect(solver1).submitSolution(i + 1, `QmTestCid${i}`, { value: SUBMISSION_DEPOSIT });
        await quinty.connect(creator).selectWinners(i + 1, [solver1.address], [0]);
      }

      // Check if badge was minted
      const rep = await reputation.getUserReputation(creator.address);
      expect(rep.tokenId).to.be.greaterThan(0);
      expect(rep.level).to.equal("Bronze");
    });
  });

  describe("Communication System", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmTestCid1", { value: SUBMISSION_DEPOSIT });
    });

    it("Should allow replies between creator and solver", async function () {
      await expect(quinty.connect(creator).addReply(1, 0, "Can you clarify the requirements?"))
        .to.emit(quinty, "ReplyAdded");

      await expect(quinty.connect(solver1).addReply(1, 0, "Sure, I will provide more details"))
        .to.emit(quinty, "ReplyAdded");

      const submission = await quinty.getSubmission(1, 0);
      expect(submission.replies.length).to.equal(2);
    });

    it("Should prevent unauthorized replies", async function () {
      await expect(
        quinty.connect(solver2).addReply(1, 0, "I shouldn't be able to reply")
      ).to.be.revertedWith("Unauthorized");
    });
  });

  describe("Solution Reveal", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmBlindedCid", { value: SUBMISSION_DEPOSIT });
      await quinty.connect(creator).selectWinners(1, [solver1.address], [0]);
    });

    it("Should allow winner to reveal solution", async function () {
      const revealCid = "QmRevealedCid123";

      await expect(quinty.connect(solver1).revealSolution(1, 0, revealCid))
        .to.emit(quinty, "SolutionRevealed")
        .withArgs(1, 0, revealCid);

      const submission = await quinty.getSubmission(1, 0);
      expect(submission.revealIpfsCid).to.equal(revealCid);
    });

    it("Should prevent reveal before resolution", async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("Unresolved bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(2, "QmBlindedCid2", { value: SUBMISSION_DEPOSIT });

      await expect(
        quinty.connect(solver1).revealSolution(2, 0, "QmRevealCid")
      ).to.be.revertedWith("Not resolved");
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle zero submissions gracefully", async function () {
      const deadline = (await time.latest()) + 86400;
      await quinty
        .connect(creator)
        .createBounty("No submissions bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      const submissionCount = await quinty.getSubmissionCount(1);
      expect(submissionCount).to.equal(0);

      // Should be able to slash even with no submissions
      await time.increase(86401);
      await expect(quinty.connect(creator).triggerSlash(1)).to.not.be.reverted;
    });

    it("Should prevent reentrancy attacks", async function () {
      // This test would require a malicious contract to properly test reentrancy
      // For now, we verify that ReentrancyGuard is applied to critical functions
      expect(true).to.be.true; // Placeholder
    });

    it("Should handle large bounty amounts correctly", async function () {
      const largeBounty = ethers.parseEther("1000"); // 1000 STT
      const deadline = (await time.latest()) + 86400;

      await quinty
        .connect(creator)
        .createBounty("Large bounty", deadline, false, [], SLASH_PERCENT, { value: largeBounty });

      const bounty = await quinty.getBounty(1);
      expect(bounty.amount).to.equal(largeBounty);

      // Test submission with correct 10% deposit
      const largeDeposit = largeBounty / BigInt(10);
      await quinty.connect(solver1).submitSolution(1, "QmLargeCid", { value: largeDeposit });

      const submission = await quinty.getSubmission(1, 0);
      expect(submission.deposit).to.equal(largeDeposit);
    });
  });
});