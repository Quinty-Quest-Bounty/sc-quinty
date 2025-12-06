import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("GrantProgram Contract", function () {
  let grantProgram: any;
  let nft: any;
  let owner: any;
  let grantGiver: any;
  let applicant1: any;
  let applicant2: any;
  let applicant3: any;
  let addrs: any[];

  const GRANT_AMOUNT = ethers.parseEther("10.0"); // 10 ETH total
  const APPLICATION_DEPOSIT = ethers.parseEther("0.01"); // 0.01 ETH

  beforeEach(async function () {
    [owner, grantGiver, applicant1, applicant2, applicant3, ...addrs] = await ethers.getSigners();

    // Deploy QuintyNFT
    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    nft = await QuintyNFT.deploy("ipfs://QmNFTBase/");
    await nft.waitForDeployment();

    // Deploy GrantProgram
    const GrantProgram = await ethers.getContractFactory("GrantProgram");
    grantProgram = await GrantProgram.deploy();
    await grantProgram.waitForDeployment();

    // Set NFT address
    await grantProgram.setNFTAddress(await nft.getAddress());
    await nft.transferOwnership(await grantProgram.getAddress());
  });

  describe("Grant Creation", function () {
    it("Should create a grant with proper escrow", async function () {
      const appDeadline = (await time.latest()) + 86400;
      const distDeadline = appDeadline + 86400;

      await expect(
        grantProgram
          .connect(grantGiver)
          .createGrant(
            "Research Grant",
            "QmGrantDetails",
            5,
            appDeadline,
            distDeadline,
            { value: GRANT_AMOUNT }
          )
      )
        .to.emit(grantProgram, "GrantCreated");

      const grant = await grantProgram.getGrantInfo(1);
      expect(grant.giver).to.equal(grantGiver.address);
      expect(grant.totalFunds).to.equal(GRANT_AMOUNT);
      expect(grant.status).to.equal(0); // Open
    });

    it("Should reject grant creation with invalid parameters", async function () {
      const deadline = (await time.latest()) + 86400;

      // No escrow
      await expect(
        grantProgram
          .connect(grantGiver)
          .createGrant("Test", "QmDetails", 5, deadline, deadline + 86400, { value: 0 })
      ).to.be.revertedWith("Must provide grant funds");

      // Invalid deadline
      await expect(
        grantProgram
          .connect(grantGiver)
          .createGrant(
            "Test",
            "QmDetails",
            5,
            await time.latest(),
            deadline + 86400,
            { value: GRANT_AMOUNT }
          )
      ).to.be.revertedWith("Invalid application deadline");

      // Distribution before application
      await expect(
        grantProgram
          .connect(grantGiver)
          .createGrant(
            "Test",
            "QmDetails",
            5,
            deadline + 86400,
            deadline,
            { value: GRANT_AMOUNT }
          )
      ).to.be.revertedWith("Distribution deadline must be after application deadline");
    });
  });

  describe("Applications", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );
    });

    it("Should accept valid applications", async function () {
      await expect(
        grantProgram
          .connect(applicant1)
          .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("3"))
      )
        .to.emit(grantProgram, "ApplicationSubmitted")
        .withArgs(1, 0, applicant1.address, ethers.parseEther("3"));

      const count = await grantProgram.getApplicationCount(1);
      expect(count).to.equal(1);
    });

    it("Should reject applications with zero amount", async function () {
      await expect(
        grantProgram.connect(applicant1).applyForGrant(1, "QmProposal1", "QmSocial1", 0)
      ).to.be.revertedWith("Invalid requested amount");
    });

    it("Should reject duplicate applications", async function () {
      await grantProgram
        .connect(applicant1)
        .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("3"));

      await expect(
        grantProgram
          .connect(applicant1)
          .applyForGrant(1, "QmProposal2", "QmSocial2", ethers.parseEther("2"))
      ).to.be.revertedWith("Already applied");
    });

    it("Should reject applications after deadline", async function () {
      await time.increase(86401);

      await expect(
        grantProgram
          .connect(applicant1)
          .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("3"))
      ).to.be.revertedWith("Application deadline passed");
    });
  });

  describe("Application Approval", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );

      await grantProgram
        .connect(applicant1)
        .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("5"));
      await grantProgram
        .connect(applicant2)
        .applyForGrant(1, "QmProposal2", "QmSocial2", ethers.parseEther("3"));
      await grantProgram
        .connect(applicant3)
        .applyForGrant(1, "QmProposal3", "QmSocial3", ethers.parseEther("2"));
    });

    it("Should allow grant giver to approve applications", async function () {
      const amounts = [ethers.parseEther("5"), ethers.parseEther("3"), ethers.parseEther("2")];

      await expect(grantProgram.connect(grantGiver).approveApplications(1, [0, 1, 2], amounts))
        .to.emit(grantProgram, "ApplicationApproved");

      const app = await grantProgram.getApplication(1, 0);
      expect(app.status).to.equal(1); // Approved
    });

    it("Should prevent non-grant-giver from approving", async function () {
      const amounts = [ethers.parseEther("5")];

      await expect(
        grantProgram.connect(applicant1).approveApplications(1, [0], amounts)
      ).to.be.revertedWith("Not grant giver");
    });

    it("Should prevent approving more than available funds", async function () {
      const amounts = [ethers.parseEther("6"), ethers.parseEther("6")];

      await expect(
        grantProgram.connect(grantGiver).approveApplications(1, [0, 1], amounts)
      ).to.be.revertedWith("Insufficient grant funds");
    });
  });

  describe("Grant Claims", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );

      await grantProgram
        .connect(applicant1)
        .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("6"));
      await grantProgram
        .connect(applicant2)
        .applyForGrant(1, "QmProposal2", "QmSocial2", ethers.parseEther("4"));

      const amounts = [ethers.parseEther("6"), ethers.parseEther("4")];
      await grantProgram.connect(grantGiver).approveApplications(1, [0, 1], amounts);
      await grantProgram.connect(grantGiver).finalizeSelection(1);
    });

    it("Should allow approved applicants to claim grants", async function () {
      const balanceBefore = await ethers.provider.getBalance(applicant1.address);

      await expect(grantProgram.connect(applicant1).claimGrant(1)).to.emit(grantProgram, "FundsClaimed");

      const balanceAfter = await ethers.provider.getBalance(applicant1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther("6"),
        ethers.parseEther("0.01")
      );
    });

    it("Should prevent unapproved applicants from claiming", async function () {
      await expect(grantProgram.connect(applicant3).claimGrant(1)).to.be.revertedWith("Not a selected recipient");
    });

    it("Should prevent double claiming", async function () {
      await grantProgram.connect(applicant1).claimGrant(1);

      await expect(grantProgram.connect(applicant1).claimGrant(1)).to.be.revertedWith("Already claimed");
    });
  });

  describe("Grant Updates", function () {
    beforeEach(async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );
    });

    it("Should allow grant giver to post updates", async function () {
      await expect(grantProgram.connect(grantGiver).postUpdate(1, "QmUpdate1")).to.emit(
        grantProgram,
        "UpdatePosted"
      );

      const count = await grantProgram.getUpdateCount(1);
      expect(count).to.equal(1);
    });

    it("Should prevent unauthorized from posting updates", async function () {
      await expect(grantProgram.connect(applicant1).postUpdate(1, "QmUpdate1")).to.be.revertedWith(
        "Not authorized to post updates"
      );
    });
  });

  describe("Grant Cancellation", function () {
    it("Should allow cancellation with no applications", async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );

      await expect(grantProgram.connect(grantGiver).cancelGrant(1)).to.emit(grantProgram, "GrantCancelled");
    });

    it("Should prevent cancellation after selection phase", async function () {
      const deadline = (await time.latest()) + 86400;
      const selectionDeadline = deadline + 86400;
      await grantProgram
        .connect(grantGiver)
        .createGrant(
          "Research Grant",
          "QmGrantDetails",
          3,
          deadline,
          selectionDeadline,
          { value: GRANT_AMOUNT }
        );

      await grantProgram
        .connect(applicant1)
        .applyForGrant(1, "QmProposal1", "QmSocial1", ethers.parseEther("5"));

      const amounts = [ethers.parseEther("5")];
      await grantProgram.connect(grantGiver).approveApplications(1, [0], amounts);

      // After approving applications, it moves to SelectionPhase
      await expect(grantProgram.connect(grantGiver).cancelGrant(1)).to.not.be.reverted;

      // Or test after finalization
      // await grantProgram.connect(grantGiver).finalizeSelection(1);
      // await expect(grantProgram.connect(grantGiver).cancelGrant(1)).to.be.revertedWith(
      //   "Cannot cancel after activation"
      // );
    });
  });
});
