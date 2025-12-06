import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Quinty Oprec & Team Features", function () {
  let quinty: any;
  let reputation: any;
  let dispute: any;
  let nft: any;
  let owner: any;
  let creator: any;
  let solver1: any;
  let solver2: any;
  let teamMember1: any;
  let teamMember2: any;
  let addrs: any[];

  const BOUNCE_AMOUNT = ethers.parseEther("1.0");
  const SLASH_PERCENT = 3000;
  const SUBMISSION_DEPOSIT = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, creator, solver1, solver2, teamMember1, teamMember2, ...addrs] =
      await ethers.getSigners();

    // Deploy QuintyNFT
    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    nft = await QuintyNFT.deploy("ipfs://badge-metadata/");
    await nft.waitForDeployment();

    // Deploy QuintyReputation
    const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
    reputation = await QuintyReputation.deploy("ipfs://QmExampleCid/");
    await reputation.waitForDeployment();

    // Deploy Quinty
    const Quinty = await ethers.getContractFactory("Quinty");
    quinty = await Quinty.deploy();
    await quinty.waitForDeployment();

    // Deploy DisputeResolver
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    dispute = await DisputeResolver.deploy(await quinty.getAddress());
    await dispute.waitForDeployment();

    // Set up connections
    await quinty.setAddresses(
      await reputation.getAddress(),
      await dispute.getAddress(),
      await nft.getAddress()
    );
    await reputation.transferOwnership(await quinty.getAddress());

    // Authorize Quinty contract to mint NFT badges
    await nft.authorizeMinter(await quinty.getAddress());
  });

  describe("Bounty Creation with Oprec", function () {
    it("Should create bounty with oprec phase", async function () {
      const now = await time.latest();
      const oprecDeadline = now + 3600; // 1 hour for oprec
      const bountyDeadline = now + 7200; // 2 hours for bounty

      await quinty
        .connect(creator)
        .createBounty(
          "Test bounty with oprec",
          bountyDeadline,
          false,
          [],
          SLASH_PERCENT,
          true, // hasOprec
          oprecDeadline,
          { value: BOUNCE_AMOUNT }
        );

      const bountyData = await quinty.getBountyData(1);
      expect(bountyData.status).to.equal(0); // BountyStatus.OPREC
      expect(bountyData.hasOprec).to.be.true;
      expect(bountyData.oprecDeadline).to.equal(oprecDeadline);
    });

    it("Should create bounty without oprec phase", async function () {
      const now = await time.latest();
      const bountyDeadline = now + 7200;

      await quinty
        .connect(creator)
        .createBounty(
          "Test bounty without oprec",
          bountyDeadline,
          false,
          [],
          SLASH_PERCENT,
          false, // no oprec
          0,
          { value: BOUNCE_AMOUNT }
        );

      const bountyData = await quinty.getBountyData(1);
      expect(bountyData.status).to.equal(1); // BountyStatus.OPEN
      expect(bountyData.hasOprec).to.be.false;
    });
  });

  describe("Oprec Applications", function () {
    beforeEach(async function () {
      const now = await time.latest();
      const oprecDeadline = now + 3600;
      const bountyDeadline = now + 7200;

      await quinty
        .connect(creator)
        .createBounty(
          "Oprec bounty",
          bountyDeadline,
          false,
          [],
          SLASH_PERCENT,
          true,
          oprecDeadline,
          { value: BOUNCE_AMOUNT }
        );
    });

    it("Should allow solo application to oprec", async function () {
      await expect(
        quinty
          .connect(solver1)
          .applyToOprec(
            1,
            [], // no team
            "ipfs://my-work-examples",
            "I am a skilled developer"
          )
      )
        .to.emit(quinty, "OprecApplicationSubmitted")
        .withArgs(1, 0, solver1.address, false);

      const appCount = await quinty.getOprecApplicationCount(1);
      expect(appCount).to.equal(1);

      const app = await quinty.getOprecApplication(1, 0);
      expect(app.applicant).to.equal(solver1.address);
      expect(app.teamMembers.length).to.equal(0);
    });

    it("Should allow team application to oprec", async function () {
      const teamMembers = [teamMember1.address, teamMember2.address];

      await expect(
        quinty
          .connect(solver1)
          .applyToOprec(
            1,
            teamMembers,
            "ipfs://team-portfolio",
            "We are a team of experienced devs"
          )
      )
        .to.emit(quinty, "OprecApplicationSubmitted")
        .withArgs(1, 0, solver1.address, true);

      const app = await quinty.getOprecApplication(1, 0);
      expect(app.applicant).to.equal(solver1.address);
      expect(app.teamMembers.length).to.equal(2);
      expect(app.teamMembers[0]).to.equal(teamMember1.address);
    });

    it("Should allow creator to approve applications", async function () {
      await quinty
        .connect(solver1)
        .applyToOprec(1, [], "ipfs://work", "Skills");

      await quinty
        .connect(solver2)
        .applyToOprec(1, [], "ipfs://work2", "More skills");

      await expect(
        quinty.connect(creator).approveOprecApplications(1, [0, 1])
      )
        .to.emit(quinty, "OprecApplicationApproved")
        .withArgs(1, 0, solver1.address);

      expect(await quinty.isApprovedParticipant(1, solver1.address)).to.be.true;
      expect(await quinty.isApprovedParticipant(1, solver2.address)).to.be.true;
    });

    it("Should allow creator to reject applications", async function () {
      await quinty
        .connect(solver1)
        .applyToOprec(1, [], "ipfs://work", "Skills");

      await expect(
        quinty.connect(creator).rejectOprecApplications(1, [0])
      )
        .to.emit(quinty, "OprecApplicationRejected")
        .withArgs(1, 0, solver1.address);

      const app = await quinty.getOprecApplication(1, 0);
      expect(app.rejected).to.be.true;
      expect(await quinty.isApprovedParticipant(1, solver1.address)).to.be.false;
    });

    it("Should allow ending oprec phase", async function () {
      await time.increase(3601); // Past oprec deadline

      await expect(quinty.connect(creator).endOprecPhase(1))
        .to.emit(quinty, "OprecPhaseEnded")
        .withArgs(1);

      const bountyData = await quinty.getBountyData(1);
      expect(bountyData.status).to.equal(1); // BountyStatus.OPEN
    });
  });

  describe("Team Submissions & Rewards", function () {
    beforeEach(async function () {
      const now = await time.latest();
      const bountyDeadline = now + 7200;

      // Create bounty without oprec for simplicity
      await quinty
        .connect(creator)
        .createBounty(
          "Team bounty",
          bountyDeadline,
          false,
          [],
          SLASH_PERCENT,
          false,
          0,
          { value: BOUNCE_AMOUNT }
        );
    });

    it("Should allow team submission", async function () {
      const teamMembers = [teamMember1.address, teamMember2.address];

      await expect(
        quinty
          .connect(solver1)
          .submitSolution(1, "ipfs://blinded-solution", teamMembers, {
            value: SUBMISSION_DEPOSIT,
          })
      )
        .to.emit(quinty, "SubmissionCreated")
        .withArgs(1, 0, solver1.address, "ipfs://blinded-solution", true);

      const subCount = await quinty.getSubmissionCount(1);
      expect(subCount).to.equal(1);
    });

    it("Should split rewards equally among team members", async function () {
      const teamMembers = [teamMember1.address, teamMember2.address];

      // Submit team solution
      await quinty
        .connect(solver1)
        .submitSolution(1, "ipfs://blinded", teamMembers, {
          value: SUBMISSION_DEPOSIT,
        });

      // Select winner
      await quinty
        .connect(creator)
        .selectWinners(1, [solver1.address], [0]);

      // Get balances before reveal
      const leaderBefore = await ethers.provider.getBalance(solver1.address);
      const member1Before = await ethers.provider.getBalance(teamMember1.address);
      const member2Before = await ethers.provider.getBalance(teamMember2.address);

      // Reveal solution
      const tx = await quinty
        .connect(solver1)
        .revealSolution(1, 0, "ipfs://revealed");
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Check balances after reveal
      const leaderAfter = await ethers.provider.getBalance(solver1.address);
      const member1After = await ethers.provider.getBalance(teamMember1.address);
      const member2After = await ethers.provider.getBalance(teamMember2.address);

      // Each member should get 1/3 of (prize + deposit)
      const totalReward = BOUNCE_AMOUNT + SUBMISSION_DEPOSIT;
      const rewardPerMember = totalReward / 3n;

      // Leader gets reward minus gas
      expect(leaderAfter).to.be.closeTo(
        leaderBefore + rewardPerMember - gasCost,
        ethers.parseEther("0.001") // Allow 0.001 ETH tolerance
      );

      // Team members get exact reward
      expect(member1After - member1Before).to.equal(rewardPerMember);
      expect(member2After - member2Before).to.equal(rewardPerMember);
    });
  });
});
