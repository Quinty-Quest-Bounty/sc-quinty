import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DisputeResolver Contract", function () {
  let quinty: any;
  let reputation: any;
  let dispute: any;
  let owner: any;
  let creator: any;
  let solver1: any;
  let solver2: any;
  let solver3: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;
  let addrs: any[];

  const BOUNCE_AMOUNT = ethers.parseEther("1.0");
  const SLASH_PERCENT = 3000; // 30%
  const SUBMISSION_DEPOSIT = ethers.parseEther("0.1");
  const VOTING_STAKE = ethers.parseEther("0.0001");

  beforeEach(async function () {
    [owner, creator, solver1, solver2, solver3, voter1, voter2, voter3, ...addrs] =
      await ethers.getSigners();

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

    // Set up connections
    await quinty.setAddresses(await reputation.getAddress(), await dispute.getAddress());
    await dispute.setQuintyAddress(await quinty.getAddress());
    await reputation.transferOwnership(await quinty.getAddress());
  });

  async function setupExpiredBounty() {
    const deadline = (await time.latest()) + 3600; // 1 hour
    await quinty
      .connect(creator)
      .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

    // Add multiple submissions
    await quinty.connect(solver1).submitSolution(1, "QmSolution1", { value: SUBMISSION_DEPOSIT });
    await quinty.connect(solver2).submitSolution(1, "QmSolution2", { value: SUBMISSION_DEPOSIT });
    await quinty.connect(solver3).submitSolution(1, "QmSolution3", { value: SUBMISSION_DEPOSIT });

    // Fast forward past deadline and trigger slash
    await time.increase(3601);
    await quinty.connect(solver1).triggerSlash(1);

    return 1; // Return dispute ID
  }

  describe("Expiry Voting", function () {
    it("Should initiate expiry vote when bounty is slashed", async function () {
      const deadline = (await time.latest()) + 3600;
      await quinty
        .connect(creator)
        .createBounty("Test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmSolution1", { value: SUBMISSION_DEPOSIT });

      await time.increase(3601);

      await expect(quinty.connect(solver1).triggerSlash(1))
        .to.emit(dispute, "DisputeInitiated")
        .withArgs(1, 1, true, (BOUNCE_AMOUNT * BigInt(SLASH_PERCENT)) / BigInt(10000));

      const disputeInfo = await dispute.getDispute(1);
      expect(disputeInfo.bountyId).to.equal(1);
      expect(disputeInfo.isExpiry).to.be.true;
      expect(disputeInfo.resolved).to.be.false;
    });

    it("Should accept votes with proper stake", async function () {
      const disputeId = await setupExpiredBounty();

      const rankings = [0, 1, 2]; // Rank submissions 0, 1, 2

      await expect(
        dispute.connect(voter1).vote(disputeId, rankings, { value: VOTING_STAKE })
      )
        .to.emit(dispute, "VoteCast")
        .withArgs(disputeId, voter1.address, rankings, VOTING_STAKE);

      const disputeInfo = await dispute.getDispute(disputeId);
      expect(disputeInfo.voteCount).to.equal(1);

      const vote = await dispute.getVote(disputeId, 0);
      expect(vote.voter).to.equal(voter1.address);
      expect(vote.stake).to.equal(VOTING_STAKE);
      expect(vote.rankedSubIds).to.deep.equal(rankings);
    });

    it("Should reject votes with insufficient stake", async function () {
      const disputeId = await setupExpiredBounty();
      const rankings = [0, 1, 2];

      await expect(
        dispute.connect(voter1).vote(disputeId, rankings, { value: ethers.parseEther("0.00005") })
      ).to.be.revertedWith("Minimum 0.0001 STT stake required");
    });

    it("Should reject invalid rankings", async function () {
      const disputeId = await setupExpiredBounty();

      // Too few rankings
      await expect(
        dispute.connect(voter1).vote(disputeId, [0, 1], { value: VOTING_STAKE })
      ).to.be.revertedWith("Must rank exactly 3 submissions");

      // Too many rankings
      await expect(
        dispute.connect(voter1).vote(disputeId, [0, 1, 2, 0], { value: VOTING_STAKE })
      ).to.be.revertedWith("Must rank exactly 3 submissions");

      // Invalid submission ID
      await expect(
        dispute.connect(voter1).vote(disputeId, [0, 1, 5], { value: VOTING_STAKE })
      ).to.be.revertedWith("Invalid submission ID");

      // Duplicate rankings
      await expect(
        dispute.connect(voter1).vote(disputeId, [0, 0, 1], { value: VOTING_STAKE })
      ).to.be.revertedWith("Duplicate rankings not allowed");
    });

    it("Should prevent double voting", async function () {
      const disputeId = await setupExpiredBounty();
      const rankings = [0, 1, 2];

      await dispute.connect(voter1).vote(disputeId, rankings, { value: VOTING_STAKE });

      await expect(
        dispute.connect(voter1).vote(disputeId, rankings, { value: VOTING_STAKE })
      ).to.be.revertedWith("Already voted");
    });

    it("Should prevent voting after deadline", async function () {
      const disputeId = await setupExpiredBounty();

      // Fast forward past voting deadline (3 days)
      await time.increase(3 * 24 * 3600 + 1);

      await expect(
        dispute.connect(voter1).vote(disputeId, [0, 1, 2], { value: VOTING_STAKE })
      ).to.be.revertedWith("Dispute inactive");
    });
  });

  describe("Vote Resolution", function () {
    it("Should resolve dispute and distribute rewards", async function () {
      const disputeId = await setupExpiredBounty();

      // Multiple voters vote for submission 0 as top
      await dispute.connect(voter1).vote(disputeId, [0, 1, 2], { value: VOTING_STAKE });
      await dispute.connect(voter2).vote(disputeId, [0, 2, 1], { value: VOTING_STAKE });
      await dispute.connect(voter3).vote(disputeId, [1, 0, 2], { value: VOTING_STAKE }); // Different top choice

      const solver1BalanceBefore = await ethers.provider.getBalance(solver1.address);
      const voter1BalanceBefore = await ethers.provider.getBalance(voter1.address);

      // Fast forward past voting period
      await time.increase(3 * 24 * 3600 + 1);

      await expect(dispute.connect(owner).resolveDispute(disputeId))
        .to.emit(dispute, "DisputeResolved");

      const disputeInfo = await dispute.getDispute(disputeId);
      expect(disputeInfo.resolved).to.be.true;

      // Check that rewards were distributed (solver1 should get top reward)
      const solver1BalanceAfter = await ethers.provider.getBalance(solver1.address);
      expect(solver1BalanceAfter).to.be.greaterThan(solver1BalanceBefore);
    });

    it("Should not resolve dispute before voting period ends", async function () {
      const disputeId = await setupExpiredBounty();

      await dispute.connect(voter1).vote(disputeId, [0, 1, 2], { value: VOTING_STAKE });

      await expect(
        dispute.connect(owner).resolveDispute(disputeId)
      ).to.be.revertedWith("Not resolvable");
    });

    it("Should not resolve dispute without votes", async function () {
      const disputeId = await setupExpiredBounty();

      // Fast forward past voting period
      await time.increase(3 * 24 * 3600 + 1);

      await expect(
        dispute.connect(owner).resolveDispute(disputeId)
      ).to.be.revertedWith("No votes cast");
    });
  });

  describe("Pengadilan (Court) Disputes", function () {
    beforeEach(async function () {
      // Create and resolve a bounty first
      const deadline = (await time.latest()) + 3600;
      await quinty
        .connect(creator)
        .createBounty("Court test bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmSolution1", { value: SUBMISSION_DEPOSIT });
      await quinty.connect(solver2).submitSolution(1, "QmSolution2", { value: SUBMISSION_DEPOSIT });

      // Creator selects solver1 as winner
      await quinty.connect(creator).selectWinners(1, [solver1.address], [0]);
    });

    it("Should allow creator to initiate pengadilan dispute", async function () {
      await expect(dispute.connect(creator).initiatePengadilanDispute(1))
        .to.emit(dispute, "DisputeInitiated");

      const disputeInfo = await dispute.getDispute(1);
      expect(disputeInfo.bountyId).to.equal(1);
      expect(disputeInfo.isExpiry).to.be.false;
      expect(disputeInfo.amount).to.equal(BOUNCE_AMOUNT);
    });

    it("Should prevent non-creator from initiating pengadilan", async function () {
      await expect(
        dispute.connect(solver2).initiatePengadilanDispute(1)
      ).to.be.revertedWith("Only creator can dispute");
    });

    it("Should prevent dispute of unresolved bounty", async function () {
      const deadline = (await time.latest()) + 3600;
      await quinty
        .connect(creator)
        .createBounty("Unresolved bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await expect(
        dispute.connect(creator).initiatePengadilanDispute(2)
      ).to.be.revertedWith("Bounty not resolved");
    });
  });

  describe("Voting Analytics", function () {
    it("Should correctly tally weighted votes", async function () {
      const disputeId = await setupExpiredBounty();

      // Voter1 stakes 2x minimum, votes for submission 0
      await dispute.connect(voter1).vote(disputeId, [0, 1, 2], { value: VOTING_STAKE * BigInt(2) });

      // Voter2 stakes 1x minimum, votes for submission 1
      await dispute.connect(voter2).vote(disputeId, [1, 0, 2], { value: VOTING_STAKE });

      // Voter3 stakes 1x minimum, votes for submission 0
      await dispute.connect(voter3).vote(disputeId, [0, 2, 1], { value: VOTING_STAKE });

      // Submission 0 should win: (3 * 2) + (2 * 1) = 8 points vs submission 1: (3 * 1) = 3 points
      await time.increase(3 * 24 * 3600 + 1);

      await expect(dispute.connect(owner).resolveDispute(disputeId))
        .to.emit(dispute, "DisputeResolved");

      // Verify the dispute was resolved (detailed tally verification would require internal access)
      const disputeInfo = await dispute.getDispute(disputeId);
      expect(disputeInfo.resolved).to.be.true;
    });
  });

  describe("Reward Distribution", function () {
    it("Should distribute rewards proportionally to correct voters", async function () {
      const disputeId = await setupExpiredBounty();

      const voter1StakeAmount = VOTING_STAKE * BigInt(2); // 2x stake
      const voter2StakeAmount = VOTING_STAKE; // 1x stake

      // Both vote for submission 0 as #1
      await dispute.connect(voter1).vote(disputeId, [0, 1, 2], { value: voter1StakeAmount });
      await dispute.connect(voter2).vote(disputeId, [0, 2, 1], { value: voter2StakeAmount });

      // Voter3 votes differently
      await dispute.connect(voter3).vote(disputeId, [1, 0, 2], { value: VOTING_STAKE });

      const voter1BalanceBefore = await ethers.provider.getBalance(voter1.address);
      const voter2BalanceBefore = await ethers.provider.getBalance(voter2.address);
      const voter3BalanceBefore = await ethers.provider.getBalance(voter3.address);

      await time.increase(3 * 24 * 3600 + 1);
      await dispute.connect(owner).resolveDispute(disputeId);

      const voter1BalanceAfter = await ethers.provider.getBalance(voter1.address);
      const voter2BalanceAfter = await ethers.provider.getBalance(voter2.address);
      const voter3BalanceAfter = await ethers.provider.getBalance(voter3.address);

      // Voter1 and Voter2 should receive rewards (proportional to their stakes)
      // Voter3 should not receive rewards (voted differently)
      expect(voter1BalanceAfter).to.be.greaterThan(voter1BalanceBefore);
      expect(voter2BalanceAfter).to.be.greaterThan(voter2BalanceBefore);

      // Voter1 should get more than Voter2 due to higher stake
      const voter1Gain = voter1BalanceAfter - voter1BalanceBefore;
      const voter2Gain = voter2BalanceAfter - voter2BalanceBefore;
      expect(voter1Gain).to.be.greaterThan(voter2Gain);
    });
  });

  describe("Access Control", function () {
    it("Should prevent unauthorized dispute initiation", async function () {
      // Only Quinty contract should be able to initiate expiry votes
      await expect(
        dispute.connect(creator).initiateExpiryVote(1, ethers.parseEther("0.3"))
      ).to.be.revertedWith("Only Quinty contract");
    });

    it("Should allow owner to set Quinty address", async function () {
      const newAddress = ethers.Wallet.createRandom().address;

      await expect(dispute.connect(owner).setQuintyAddress(newAddress))
        .to.not.be.reverted;

      await expect(
        dispute.connect(creator).setQuintyAddress(newAddress)
      ).to.be.revertedWithCustomError(dispute, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle disputes with no submissions", async function () {
      const deadline = (await time.latest()) + 3600;
      await quinty
        .connect(creator)
        .createBounty("No submission bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await time.increase(3601);
      await quinty.connect(creator).triggerSlash(1);

      // Should not be able to vote on non-existent submissions
      await expect(
        dispute.connect(voter1).vote(1, [0, 1, 2], { value: VOTING_STAKE })
      ).to.be.revertedWith("Invalid submission ID");
    });

    it("Should handle single submission votes correctly", async function () {
      const deadline = (await time.latest()) + 3600;
      await quinty
        .connect(creator)
        .createBounty("Single submission bounty", deadline, false, [], SLASH_PERCENT, { value: BOUNCE_AMOUNT });

      await quinty.connect(solver1).submitSolution(1, "QmOnlySolution", { value: SUBMISSION_DEPOSIT });

      await time.increase(3601);
      await quinty.connect(creator).triggerSlash(1);

      // Voters need to rank 3 submissions, but there's only 1
      await expect(
        dispute.connect(voter1).vote(1, [0, 1, 2], { value: VOTING_STAKE })
      ).to.be.revertedWith("Invalid submission ID");
    });
  });
});