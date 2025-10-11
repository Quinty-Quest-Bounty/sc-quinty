import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LookingForGrant Contract", function () {
  let lookingForGrant: any;
  let nft: any;
  let owner: any;
  let requester: any;
  let supporter1: any;
  let supporter2: any;
  let supporter3: any;
  let addrs: any[];

  const FUNDING_GOAL = ethers.parseEther("10.0");
  const SUPPORT_AMOUNT = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, requester, supporter1, supporter2, supporter3, ...addrs] = await ethers.getSigners();

    // Deploy QuintyNFT
    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    nft = await QuintyNFT.deploy("ipfs://QmNFTBase/");
    await nft.waitForDeployment();

    // Deploy LookingForGrant
    const LookingForGrant = await ethers.getContractFactory("LookingForGrant");
    lookingForGrant = await LookingForGrant.deploy();
    await lookingForGrant.waitForDeployment();

    // Set NFT address
    await lookingForGrant.setNFTAddress(await nft.getAddress());
    await nft.transferOwnership(await lookingForGrant.getAddress());
  });

  describe("Funding Request Creation", function () {
    it("Should create a funding request", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        lookingForGrant
          .connect(requester)
          .createFundingRequest(
            "DeFi Protocol",
            "QmProjectDetails",
            "QmProgress",
            "QmSocialAccounts",
            "QmOffering",
            FUNDING_GOAL,
            deadline
          )
      )
        .to.emit(lookingForGrant, "FundingRequestCreated")
        .withArgs(1, requester.address, "DeFi Protocol", FUNDING_GOAL, deadline);

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.requester).to.equal(requester.address);
      expect(request.fundingGoal).to.equal(FUNDING_GOAL);
      expect(request.status).to.equal(0); // Active
    });

    it("Should reject funding request with invalid parameters", async function () {
      const deadline = (await time.latest()) + 86400;

      // Empty title
      await expect(
        lookingForGrant
          .connect(requester)
          .createFundingRequest("", "QmDetails", "QmProgress", "QmSocial", "QmOffering", FUNDING_GOAL, deadline)
      ).to.be.revertedWith("Title required");

      // Zero funding goal
      await expect(
        lookingForGrant
          .connect(requester)
          .createFundingRequest(
            "Test",
            "QmDetails",
            "QmProgress",
            "QmSocial",
            "QmOffering",
            0,
            deadline
          )
      ).to.be.revertedWith("Funding goal must be > 0");

      // Invalid deadline
      await expect(
        lookingForGrant
          .connect(requester)
          .createFundingRequest(
            "Test",
            "QmDetails",
            "QmProgress",
            "QmSocial",
            "QmOffering",
            FUNDING_GOAL,
            await time.latest()
          )
      ).to.be.revertedWith("Invalid deadline");
    });

    it("Should create request with no deadline", async function () {
      await expect(
        lookingForGrant
          .connect(requester)
          .createFundingRequest(
            "DeFi Protocol",
            "QmProjectDetails",
            "QmProgress",
            "QmSocialAccounts",
            "QmOffering",
            FUNDING_GOAL,
            0
          )
      ).to.emit(lookingForGrant, "FundingRequestCreated");

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.deadline).to.equal(0);
    });
  });

  describe("Supporting Requests", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );
    });

    it("Should accept support with ETH", async function () {
      await expect(lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT }))
        .to.emit(lookingForGrant, "SupportReceived")
        .withArgs(1, supporter1.address, SUPPORT_AMOUNT, SUPPORT_AMOUNT);

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.totalRaised).to.equal(SUPPORT_AMOUNT);
    });

    it("Should track multiple supporters", async function () {
      await lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT });
      await lookingForGrant.connect(supporter2).supportRequest(1, { value: SUPPORT_AMOUNT });
      await lookingForGrant.connect(supporter3).supportRequest(1, { value: SUPPORT_AMOUNT });

      const count = await lookingForGrant.getSupporterCount(1);
      expect(count).to.equal(3);
    });

    it("Should allow multiple contributions from same supporter", async function () {
      await lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT });
      await lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT });

      const contribution = await lookingForGrant.getSupporterContribution(1, supporter1.address);
      expect(contribution).to.equal(SUPPORT_AMOUNT * 2n);

      // Should still have only 1 supporter in the list (amount updated)
      const count = await lookingForGrant.getSupporterCount(1);
      expect(count).to.equal(1);
    });

    it("Should reject support with zero ETH", async function () {
      await expect(lookingForGrant.connect(supporter1).supportRequest(1, { value: 0 })).to.be.revertedWith(
        "Must send ETH"
      );
    });

    it("Should reject support after deadline", async function () {
      await time.increase(86401);

      await expect(
        lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT })
      ).to.be.revertedWith("Deadline passed");
    });

    it("Should auto-mark as funded when goal reached", async function () {
      await lookingForGrant.connect(supporter1).supportRequest(1, { value: FUNDING_GOAL });

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.status).to.equal(1); // Funded
    });
  });

  describe("Withdrawing Funds", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );

      await lookingForGrant.connect(supporter1).supportRequest(1, { value: FUNDING_GOAL });
    });

    it("Should allow requester to withdraw funds", async function () {
      const balanceBefore = await ethers.provider.getBalance(requester.address);

      await expect(lookingForGrant.connect(requester).withdrawFunds(1, SUPPORT_AMOUNT)).to.emit(
        lookingForGrant,
        "FundsWithdrawn"
      );

      const balanceAfter = await ethers.provider.getBalance(requester.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(SUPPORT_AMOUNT, ethers.parseEther("0.01"));
    });

    it("Should prevent non-requester from withdrawing", async function () {
      await expect(
        lookingForGrant.connect(supporter1).withdrawFunds(1, SUPPORT_AMOUNT)
      ).to.be.revertedWith("Not requester");
    });

    it("Should prevent withdrawing more than raised", async function () {
      await expect(
        lookingForGrant.connect(requester).withdrawFunds(1, FUNDING_GOAL * 2n)
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should allow multiple partial withdrawals", async function () {
      await lookingForGrant.connect(requester).withdrawFunds(1, SUPPORT_AMOUNT);
      await lookingForGrant.connect(requester).withdrawFunds(1, SUPPORT_AMOUNT);

      const available = await lookingForGrant.getAvailableFunds(1);
      expect(available).to.equal(FUNDING_GOAL - SUPPORT_AMOUNT * 2n);
    });
  });

  describe("Project Updates", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );
    });

    it("Should allow requester to post updates", async function () {
      await expect(lookingForGrant.connect(requester).postUpdate(1, "QmUpdate1")).to.emit(
        lookingForGrant,
        "UpdatePosted"
      );

      const count = await lookingForGrant.getUpdateCount(1);
      expect(count).to.equal(1);
    });

    it("Should prevent non-requester from posting updates", async function () {
      await expect(lookingForGrant.connect(supporter1).postUpdate(1, "QmUpdate1")).to.be.revertedWith(
        "Not requester"
      );
    });

    it("Should allow requester to update project info", async function () {
      await lookingForGrant.connect(requester).updateProjectInfo(1, "QmNewDetails", "QmNewProgress");

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.projectDetails).to.equal("QmNewDetails");
      expect(request.progress).to.equal("QmNewProgress");
    });
  });

  describe("Request Cancellation", function () {
    it("Should allow cancellation with no funds raised", async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );

      await expect(lookingForGrant.connect(requester).cancelRequest(1)).to.emit(
        lookingForGrant,
        "RequestCancelled"
      );

      const request = await lookingForGrant.getRequestInfo(1);
      expect(request.status).to.equal(2); // Cancelled
    });

    it("Should prevent cancellation with raised funds", async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );

      await lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT });

      await expect(lookingForGrant.connect(requester).cancelRequest(1)).to.be.revertedWith(
        "Cannot cancel with raised funds"
      );
    });

    it("Should prevent non-requester from cancelling", async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );

      await expect(lookingForGrant.connect(supporter1).cancelRequest(1)).to.be.revertedWith(
        "Not requester"
      );
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      await lookingForGrant
        .connect(requester)
        .createFundingRequest(
          "DeFi Protocol",
          "QmProjectDetails",
          "QmProgress",
          "QmSocialAccounts",
          "QmOffering",
          FUNDING_GOAL,
          deadline
        );

      await lookingForGrant.connect(supporter1).supportRequest(1, { value: SUPPORT_AMOUNT });
      await lookingForGrant.connect(supporter2).supportRequest(1, { value: SUPPORT_AMOUNT * 2n });
    });

    it("Should return correct supporter info", async function () {
      const supporter = await lookingForGrant.getSupporter(1, 0);
      expect(supporter.addr).to.equal(supporter1.address);
      expect(supporter.amount).to.equal(SUPPORT_AMOUNT);
    });

    it("Should return correct supporter contribution", async function () {
      const contribution = await lookingForGrant.getSupporterContribution(1, supporter2.address);
      expect(contribution).to.equal(SUPPORT_AMOUNT * 2n);
    });

    it("Should return correct available funds", async function () {
      const available = await lookingForGrant.getAvailableFunds(1);
      expect(available).to.equal(SUPPORT_AMOUNT * 3n);
    });
  });
});
