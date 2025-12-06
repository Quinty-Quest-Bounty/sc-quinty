import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Crowdfunding Contract", function () {
  let crowdfunding: any;
  let nft: any;
  let owner: any;
  let creator: any;
  let donor1: any;
  let donor2: any;
  let donor3: any;
  let addrs: any[];

  const FUNDING_GOAL = ethers.parseEther("10.0");
  const CONTRIBUTION = ethers.parseEther("2.0");

  beforeEach(async function () {
    [owner, creator, donor1, donor2, donor3, ...addrs] = await ethers.getSigners();

    // Deploy QuintyNFT
    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    nft = await QuintyNFT.deploy("ipfs://QmNFTBase/");
    await nft.waitForDeployment();

    // Deploy Crowdfunding
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    crowdfunding = await Crowdfunding.deploy();
    await crowdfunding.waitForDeployment();

    // Set NFT address
    await crowdfunding.setNFTAddress(await nft.getAddress());
    await nft.transferOwnership(await crowdfunding.getAddress());
  });

  describe("Campaign Creation", function () {
    it("Should create a campaign with milestones", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2", "Milestone 3"];
      const milestoneAmounts = [
        ethers.parseEther("4"),
        ethers.parseEther("3"),
        ethers.parseEther("3"),
      ];

      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "Gaming Platform",
            "QmProjectDetails",
            "QmSocialAccounts",
            FUNDING_GOAL,
            deadline,
            milestoneDescriptions,
            milestoneAmounts
          )
      )
        .to.emit(crowdfunding, "CampaignCreated")
        .withArgs(1, creator.address, "Gaming Platform", FUNDING_GOAL, deadline);

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.creator).to.equal(creator.address);
      expect(campaign.fundingGoal).to.equal(FUNDING_GOAL);
      expect(campaign.status).to.equal(0); // Active
    });

    it("Should reject campaign with invalid parameters", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1"];
      const milestoneAmounts = [FUNDING_GOAL];

      // Empty title
      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "",
            "QmDetails",
            "QmSocial",
            FUNDING_GOAL,
            deadline,
            milestoneDescriptions,
            milestoneAmounts
          )
      ).to.be.revertedWith("Title required");

      // Zero funding goal
      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "Test",
            "QmDetails",
            "QmSocial",
            0,
            deadline,
            milestoneDescriptions,
            milestoneAmounts
          )
      ).to.be.revertedWith("Funding goal must be > 0");

      // Invalid deadline
      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "Test",
            "QmDetails",
            "QmSocial",
            FUNDING_GOAL,
            await time.latest(),
            milestoneDescriptions,
            milestoneAmounts
          )
      ).to.be.revertedWith("Invalid deadline");
    });

    it("Should reject milestones that don't sum to funding goal", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("4"), ethers.parseEther("4")]; // Only 8 ETH

      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "Test",
            "QmDetails",
            "QmSocial",
            FUNDING_GOAL,
            deadline,
            milestoneDescriptions,
            milestoneAmounts
          )
      ).to.be.revertedWith("Milestones must sum to funding goal");
    });

    it("Should reject mismatched milestone arrays", async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [FUNDING_GOAL];

      await expect(
        crowdfunding
          .connect(creator)
          .createCampaign(
            "Test",
            "QmDetails",
            "QmSocial",
            FUNDING_GOAL,
            deadline,
            milestoneDescriptions,
            milestoneAmounts
          )
      ).to.be.revertedWith("Milestone arrays length mismatch");
    });
  });

  describe("Contributions", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("6"), ethers.parseEther("4")];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );
    });

    it("Should accept contributions", async function () {
      await expect(crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION }))
        .to.emit(crowdfunding, "ContributionReceived")
        .withArgs(1, donor1.address, CONTRIBUTION, CONTRIBUTION);

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.totalRaised).to.equal(CONTRIBUTION);
    });

    it("Should track multiple contributors", async function () {
      await crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION });
      await crowdfunding.connect(donor2).contribute(1, { value: CONTRIBUTION });
      await crowdfunding.connect(donor3).contribute(1, { value: CONTRIBUTION });

      const count = await crowdfunding.getContributionCount(1);
      expect(count).to.equal(3);
    });

    it("Should reject zero contributions", async function () {
      await expect(crowdfunding.connect(donor1).contribute(1, { value: 0 })).to.be.revertedWith(
        "Must send ETH"
      );
    });

    it("Should reject contributions after deadline", async function () {
      await time.increase(86401);

      await expect(
        crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION })
      ).to.be.revertedWith("Campaign deadline passed");
    });

    it("Should auto-mark as successful when goal reached", async function () {
      await crowdfunding.connect(donor1).contribute(1, { value: FUNDING_GOAL });

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.status).to.equal(1); // Successful
    });
  });

  describe("Campaign Finalization", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("6"), ethers.parseEther("4")];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );
    });

    it("Should finalize successful campaign", async function () {
      await crowdfunding.connect(donor1).contribute(1, { value: FUNDING_GOAL });
      await time.increase(86401);

      await expect(crowdfunding.connect(owner).finalizeCampaign(1)).to.emit(
        crowdfunding,
        "CampaignSuccessful"
      );

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.status).to.equal(1); // Successful
    });

    it("Should finalize failed campaign", async function () {
      await crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION });
      await time.increase(86401);

      await expect(crowdfunding.connect(owner).finalizeCampaign(1)).to.emit(
        crowdfunding,
        "CampaignFailed"
      );

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.status).to.equal(2); // Failed
    });

    it("Should prevent finalization before deadline", async function () {
      await expect(crowdfunding.connect(owner).finalizeCampaign(1)).to.be.revertedWith(
        "Deadline not reached"
      );
    });
  });

  describe("Refunds", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("6"), ethers.parseEther("4")];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );

      await crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION });
      await crowdfunding.connect(donor2).contribute(1, { value: CONTRIBUTION });

      await time.increase(86401);
      await crowdfunding.connect(owner).finalizeCampaign(1);
    });

    it("Should allow donors to claim refunds from failed campaign", async function () {
      const balanceBefore = await ethers.provider.getBalance(donor1.address);

      await expect(crowdfunding.connect(donor1).claimRefund(1)).to.emit(crowdfunding, "RefundClaimed");

      const balanceAfter = await ethers.provider.getBalance(donor1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(CONTRIBUTION, ethers.parseEther("0.01"));
    });

    it("Should prevent double refunds", async function () {
      await crowdfunding.connect(donor1).claimRefund(1);

      await expect(crowdfunding.connect(donor1).claimRefund(1)).to.be.revertedWith(
        "No contributions to refund"
      );
    });

    it("Should prevent refunds from non-contributors", async function () {
      await expect(crowdfunding.connect(donor3).claimRefund(1)).to.be.revertedWith(
        "No contributions to refund"
      );
    });
  });

  describe("Milestone Management", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2", "Milestone 3"];
      const milestoneAmounts = [
        ethers.parseEther("4"),
        ethers.parseEther("3"),
        ethers.parseEther("3"),
      ];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );

      await crowdfunding.connect(donor1).contribute(1, { value: FUNDING_GOAL });
    });

    it("Should allow creator to release milestones in order", async function () {
      await expect(crowdfunding.connect(creator).releaseMilestone(1, 0)).to.emit(
        crowdfunding,
        "MilestoneReleased"
      );

      const milestone = await crowdfunding.getMilestone(1, 0);
      expect(milestone.status).to.equal(1); // Released
    });

    it("Should prevent releasing milestone out of order", async function () {
      await expect(crowdfunding.connect(creator).releaseMilestone(1, 1)).to.be.revertedWith(
        "Previous milestone not released"
      );
    });

    it("Should allow creator to withdraw released milestone", async function () {
      await crowdfunding.connect(creator).releaseMilestone(1, 0);

      const balanceBefore = await ethers.provider.getBalance(creator.address);

      await expect(crowdfunding.connect(creator).withdrawMilestone(1, 0)).to.emit(
        crowdfunding,
        "FundsWithdrawn"
      );

      const balanceAfter = await ethers.provider.getBalance(creator.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther("4"),
        ethers.parseEther("0.01")
      );
    });

    it("Should prevent non-creator from releasing milestones", async function () {
      await expect(crowdfunding.connect(donor1).releaseMilestone(1, 0)).to.be.revertedWith("Not creator");
    });

    it("Should prevent withdrawing unreleased milestone", async function () {
      await expect(crowdfunding.connect(creator).withdrawMilestone(1, 0)).to.be.revertedWith(
        "Milestone not released"
      );
    });

    it("Should mark campaign as completed when all milestones withdrawn", async function () {
      // Release and withdraw all milestones
      for (let i = 0; i < 3; i++) {
        await crowdfunding.connect(creator).releaseMilestone(1, i);
        await crowdfunding.connect(creator).withdrawMilestone(1, i);
      }

      const campaign = await crowdfunding.getCampaignInfo(1);
      expect(campaign.status).to.equal(3); // Completed
    });
  });

  describe("Campaign Updates", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1"];
      const milestoneAmounts = [FUNDING_GOAL];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );
    });

    it("Should allow creator to post updates", async function () {
      await expect(crowdfunding.connect(creator).postUpdate(1, "QmUpdate1")).to.emit(
        crowdfunding,
        "UpdatePosted"
      );

      const count = await crowdfunding.getUpdateCount(1);
      expect(count).to.equal(1);
    });

    it("Should prevent non-creator from posting updates", async function () {
      await expect(crowdfunding.connect(donor1).postUpdate(1, "QmUpdate1")).to.be.revertedWith(
        "Not creator"
      );
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const milestoneDescriptions = ["Milestone 1", "Milestone 2"];
      const milestoneAmounts = [ethers.parseEther("6"), ethers.parseEther("4")];

      await crowdfunding
        .connect(creator)
        .createCampaign(
          "Gaming Platform",
          "QmProjectDetails",
          "QmSocialAccounts",
          FUNDING_GOAL,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        );

      await crowdfunding.connect(donor1).contribute(1, { value: CONTRIBUTION });
      await crowdfunding.connect(donor2).contribute(1, { value: CONTRIBUTION * 2n });
    });

    it("Should return correct donor contribution", async function () {
      const contribution = await crowdfunding.getDonorContribution(1, donor2.address);
      expect(contribution).to.equal(CONTRIBUTION * 2n);
    });

    it("Should return correct milestone info", async function () {
      const milestone = await crowdfunding.getMilestone(1, 0);
      expect(milestone.description).to.equal("Milestone 1");
      expect(milestone.amount).to.equal(ethers.parseEther("6"));
      expect(milestone.status).to.equal(0); // Pending
    });

    it("Should return correct vault balance", async function () {
      const balance = await crowdfunding.getVaultBalance(1);
      expect(balance).to.equal(CONTRIBUTION * 3n);
    });
  });
});
