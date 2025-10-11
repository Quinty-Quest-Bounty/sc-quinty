import { expect } from "chai";
import { ethers } from "hardhat";

describe("QuintyNFT Contract", function () {
  let quintyNFT: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let addrs: any[];

  beforeEach(async function () {
    [owner, user1, user2, user3, ...addrs] = await ethers.getSigners();

    const QuintyNFT = await ethers.getContractFactory("QuintyNFT");
    quintyNFT = await QuintyNFT.deploy("ipfs://QmBaseURI/");
    await quintyNFT.waitForDeployment();
  });

  describe("Badge Minting", function () {
    it("Should mint BountyCreator badge", async function () {
      await expect(quintyNFT.mintBadge(user1.address, 0, "ipfs://creator-badge/"))
        .to.emit(quintyNFT, "BadgeMinted")
        .withArgs(user1.address, 1, 0);

      expect(await quintyNFT.ownerOf(1)).to.equal(user1.address);
      expect(await quintyNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("Should mint different badge types", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://creator-badge/"); // BountyCreator
      await quintyNFT.mintBadge(user1.address, 1, "ipfs://solver-badge/"); // BountySolver
      await quintyNFT.mintBadge(user1.address, 2, "ipfs://team-badge/"); // TeamMember

      expect(await quintyNFT.balanceOf(user1.address)).to.equal(3);
    });

    it("Should mint badges to multiple users", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge1/");
      await quintyNFT.mintBadge(user2.address, 1, "ipfs://badge2/");
      await quintyNFT.mintBadge(user3.address, 2, "ipfs://badge3/");

      expect(await quintyNFT.balanceOf(user1.address)).to.equal(1);
      expect(await quintyNFT.balanceOf(user2.address)).to.equal(1);
      expect(await quintyNFT.balanceOf(user3.address)).to.equal(1);
    });

    it("Should prevent non-owner from minting", async function () {
      await expect(
        quintyNFT.connect(user1).mintBadge(user2.address, 0, "ipfs://badge/")
      ).to.be.revertedWithCustomError(quintyNFT, "OwnableUnauthorizedAccount");
    });

    it("Should prevent minting invalid badge type", async function () {
      await expect(
        quintyNFT.mintBadge(user1.address, 99, "ipfs://badge/")
      ).to.be.revertedWith("Invalid badge type");
    });
  });

  describe("Soulbound Token Behavior", function () {
    beforeEach(async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/");
    });

    it("Should prevent transfers", async function () {
      await expect(
        quintyNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: Transfer not allowed");
    });

    it("Should prevent safeTransferFrom", async function () {
      await expect(
        quintyNFT.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        )
      ).to.be.revertedWith("Soulbound: Transfer not allowed");
    });

    it("Should prevent approve", async function () {
      await expect(quintyNFT.connect(user1).approve(user2.address, 1)).to.be.revertedWith(
        "Soulbound: Approval not allowed"
      );
    });

    it("Should prevent setApprovalForAll", async function () {
      await expect(quintyNFT.connect(user1).setApprovalForAll(user2.address, true)).to.be.revertedWith(
        "Soulbound: Approval not allowed"
      );
    });

    it("Should allow burning by owner", async function () {
      await expect(quintyNFT.burn(1)).to.emit(quintyNFT, "Transfer").withArgs(user1.address, ethers.ZeroAddress, 1);

      await expect(quintyNFT.ownerOf(1)).to.be.revertedWithCustomError(quintyNFT, "ERC721NonexistentToken");
      expect(await quintyNFT.balanceOf(user1.address)).to.equal(0);
    });

    it("Should prevent non-owner from burning", async function () {
      await expect(quintyNFT.connect(user1).burn(1)).to.be.revertedWithCustomError(
        quintyNFT,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Badge Queries", function () {
    beforeEach(async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge1/"); // Token 1
      await quintyNFT.mintBadge(user1.address, 1, "ipfs://badge2/"); // Token 2
      await quintyNFT.mintBadge(user2.address, 2, "ipfs://badge3/"); // Token 3
    });

    it("Should return correct badge info", async function () {
      const badgeInfo = await quintyNFT.getBadgeInfo(1);
      expect(badgeInfo.badgeType).to.equal(0); // BountyCreator
      expect(badgeInfo.metadataURI).to.equal("ipfs://badge1/");
    });

    it("Should return user's badges", async function () {
      const user1Badges = await quintyNFT.getUserBadges(user1.address);
      expect(user1Badges.length).to.equal(2);
      expect(user1Badges[0]).to.equal(1);
      expect(user1Badges[1]).to.equal(2);
    });

    it("Should return correct badge count by type", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge4/"); // Another BountyCreator

      const count = await quintyNFT.getBadgeCountByType(user1.address, 0);
      expect(count).to.equal(2);
    });

    it("Should check badge ownership", async function () {
      expect(await quintyNFT.hasBadgeType(user1.address, 0)).to.be.true;
      expect(await quintyNFT.hasBadgeType(user1.address, 2)).to.be.false;
      expect(await quintyNFT.hasBadgeType(user2.address, 2)).to.be.true;
    });
  });

  describe("Token URI", function () {
    beforeEach(async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://QmCustomBadge/");
    });

    it("Should return custom token URI", async function () {
      const tokenURI = await quintyNFT.tokenURI(1);
      expect(tokenURI).to.equal("ipfs://QmCustomBadge/");
    });

    it("Should revert for nonexistent token", async function () {
      await expect(quintyNFT.tokenURI(999)).to.be.revertedWithCustomError(
        quintyNFT,
        "ERC721NonexistentToken"
      );
    });

    it("Should allow owner to update base URI", async function () {
      await quintyNFT.setBaseTokenURI("ipfs://QmNewBase/");
      // Note: Custom URIs override base URI, so this doesn't change existing tokens
      const tokenURI = await quintyNFT.tokenURI(1);
      expect(tokenURI).to.equal("ipfs://QmCustomBadge/");
    });
  });

  describe("Badge Statistics", function () {
    it("Should track total badges minted", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge1/");
      await quintyNFT.mintBadge(user1.address, 1, "ipfs://badge2/");
      await quintyNFT.mintBadge(user2.address, 0, "ipfs://badge3/");

      // 3 tokens minted (IDs 1, 2, 3)
      expect(await quintyNFT.balanceOf(user1.address)).to.equal(2);
      expect(await quintyNFT.balanceOf(user2.address)).to.equal(1);
    });

    it("Should correctly report all badge types", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge1/"); // BountyCreator
      await quintyNFT.mintBadge(user1.address, 1, "ipfs://badge2/"); // BountySolver
      await quintyNFT.mintBadge(user1.address, 2, "ipfs://badge3/"); // TeamMember
      await quintyNFT.mintBadge(user1.address, 3, "ipfs://badge4/"); // GrantGiver
      await quintyNFT.mintBadge(user1.address, 4, "ipfs://badge5/"); // GrantRecipient
      await quintyNFT.mintBadge(user1.address, 5, "ipfs://badge6/"); // CrowdfundingDonor
      await quintyNFT.mintBadge(user1.address, 6, "ipfs://badge7/"); // LookingForGrantSupporter

      expect(await quintyNFT.balanceOf(user1.address)).to.equal(7);
      expect(await quintyNFT.getUserBadges(user1.address)).to.have.lengthOf(7);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to mint badges", async function () {
      await expect(quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/")).to.not.be.reverted;
    });

    it("Should allow owner to burn badges", async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/");
      await expect(quintyNFT.burn(1)).to.not.be.reverted;
    });

    it("Should allow ownership transfer", async function () {
      await quintyNFT.transferOwnership(user1.address);
      expect(await quintyNFT.owner()).to.equal(user1.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      await expect(
        quintyNFT.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWithCustomError(quintyNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC721 Compliance", function () {
    beforeEach(async function () {
      await quintyNFT.mintBadge(user1.address, 0, "ipfs://badge/");
    });

    it("Should support ERC721 interface", async function () {
      // ERC721 interface ID: 0x80ac58cd
      expect(await quintyNFT.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should return correct token owner", async function () {
      expect(await quintyNFT.ownerOf(1)).to.equal(user1.address);
    });

    it("Should return correct balance", async function () {
      expect(await quintyNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("Should revert for zero address balance query", async function () {
      await expect(quintyNFT.balanceOf(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        quintyNFT,
        "ERC721InvalidOwner"
      );
    });
  });
});
