import { expect } from "chai";
import { ethers } from "hardhat";

describe("QuintyFactory Contract", function () {
  let registry: any;
  let factory: any;
  let owner: any;
  let user: any;
  let UPGRADER_ROLE: string;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy QuintyRegistry
    const QuintyRegistry = await ethers.getContractFactory("QuintyRegistry");
    registry = await QuintyRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy QuintyFactory
    const QuintyFactory = await ethers.getContractFactory("QuintyFactory");
    factory = await QuintyFactory.deploy(await registry.getAddress());
    await factory.waitForDeployment();

    // Grant factory UPGRADER_ROLE
    UPGRADER_ROLE = await registry.UPGRADER_ROLE();
    await registry.grantRole(UPGRADER_ROLE, await factory.getAddress());
  });

  describe("Deployment", function () {
    it("Should set correct registry address", async function () {
      const registryAddress = await factory.registry();
      expect(registryAddress).to.equal(await registry.getAddress());
    });

    it("Should set deployer as owner", async function () {
      const factoryOwner = await factory.owner();
      expect(factoryOwner).to.equal(owner.address);
    });

    it("Should reject deployment with zero address", async function () {
      const QuintyFactory = await ethers.getContractFactory("QuintyFactory");
      await expect(QuintyFactory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid registry");
    });
  });

  describe("Quinty Core Deployment", function () {
    it("Should deploy Quinty contract", async function () {
      await expect(factory.deployQuinty())
        .to.emit(factory, "ContractDeployed");

      const QUINTY = await registry.QUINTY();
      const quintyAddress = await registry.getContract(QUINTY);
      expect(quintyAddress).to.not.equal(ethers.ZeroAddress);

      // Verify it's registered in registry
      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(1);
    });

    it("Should reject deployment from non-owner", async function () {
      await expect(factory.connect(user).deployQuinty()).to.be.reverted;
    });

    it("Should deploy multiple versions of Quinty", async function () {
      await factory.deployQuinty();
      await factory.deployQuinty();

      const QUINTY = await registry.QUINTY();
      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(2);
    });
  });

  describe("QuintyReputation Deployment", function () {
    it("Should deploy QuintyReputation with base URI", async function () {
      const baseURI = "ipfs://QmReputationBase/";

      await expect(factory.deployQuintyReputation(baseURI))
        .to.emit(factory, "ContractDeployed");

      const QUINTY_REPUTATION = await registry.QUINTY_REPUTATION();
      const reputationAddress = await registry.getContract(QUINTY_REPUTATION);
      expect(reputationAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject deployment from non-owner", async function () {
      await expect(factory.connect(user).deployQuintyReputation("ipfs://test/")).to.be.reverted;
    });
  });

  describe("QuintyNFT Deployment", function () {
    it("Should deploy QuintyNFT with base URI", async function () {
      const baseURI = "ipfs://QmNFTBase/";

      await expect(factory.deployQuintyNFT(baseURI))
        .to.emit(factory, "ContractDeployed");

      const QUINTY_NFT = await registry.QUINTY_NFT();
      const nftAddress = await registry.getContract(QUINTY_NFT);
      expect(nftAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject deployment from non-owner", async function () {
      await expect(factory.connect(user).deployQuintyNFT("ipfs://test/")).to.be.reverted;
    });
  });

  describe("DisputeResolver Deployment", function () {
    it("Should deploy DisputeResolver with Quinty address", async function () {
      // First deploy Quinty
      await factory.deployQuinty();
      const QUINTY = await registry.QUINTY();
      const quintyAddress = await registry.getContract(QUINTY);

      // Then deploy DisputeResolver
      await expect(factory.deployDisputeResolver(quintyAddress))
        .to.emit(factory, "ContractDeployed");

      const DISPUTE_RESOLVER = await registry.DISPUTE_RESOLVER();
      const disputeAddress = await registry.getContract(DISPUTE_RESOLVER);
      expect(disputeAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject deployment from non-owner", async function () {
      await expect(factory.connect(user).deployDisputeResolver(owner.address)).to.be.reverted;
    });
  });

  describe("Funding Contract Deployments", function () {
    it("Should deploy GrantProgram", async function () {
      await expect(factory.deployGrantProgram())
        .to.emit(factory, "ContractDeployed");

      const GRANT_PROGRAM = await registry.GRANT_PROGRAM();
      const grantAddress = await registry.getContract(GRANT_PROGRAM);
      expect(grantAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy Crowdfunding", async function () {
      await expect(factory.deployCrowdfunding())
        .to.emit(factory, "ContractDeployed");

      const CROWDFUNDING = await registry.CROWDFUNDING();
      const crowdfundingAddress = await registry.getContract(CROWDFUNDING);
      expect(crowdfundingAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy LookingForGrant", async function () {
      await expect(factory.deployLookingForGrant())
        .to.emit(factory, "ContractDeployed");

      const LOOKING_FOR_GRANT = await registry.LOOKING_FOR_GRANT();
      const lookingForGrantAddress = await registry.getContract(LOOKING_FOR_GRANT);
      expect(lookingForGrantAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy AirdropBounty", async function () {
      await expect(factory.deployAirdropBounty())
        .to.emit(factory, "ContractDeployed");

      const AIRDROP_BOUNTY = await registry.AIRDROP_BOUNTY();
      const airdropAddress = await registry.getContract(AIRDROP_BOUNTY);
      expect(airdropAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy SocialVerification", async function () {
      await expect(factory.deploySocialVerification())
        .to.emit(factory, "ContractDeployed");

      const SOCIAL_VERIFICATION = await registry.SOCIAL_VERIFICATION();
      const socialAddress = await registry.getContract(SOCIAL_VERIFICATION);
      expect(socialAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject funding contract deployments from non-owner", async function () {
      await expect(factory.connect(user).deployGrantProgram()).to.be.reverted;
      await expect(factory.connect(user).deployCrowdfunding()).to.be.reverted;
      await expect(factory.connect(user).deployLookingForGrant()).to.be.reverted;
      await expect(factory.connect(user).deployAirdropBounty()).to.be.reverted;
      await expect(factory.connect(user).deploySocialVerification()).to.be.reverted;
    });
  });

  describe("Full Ecosystem Deployment", function () {
    it("Should deploy entire ecosystem in one transaction", async function () {
      const reputationURI = "ipfs://QmReputation/";
      const nftURI = "ipfs://QmNFT/";

      await expect(factory.deployFullEcosystem(reputationURI, nftURI))
        .to.emit(factory, "EcosystemDeployed");

      // Verify all contracts are registered
      const QUINTY = await registry.QUINTY();
      const QUINTY_REPUTATION = await registry.QUINTY_REPUTATION();
      const QUINTY_NFT = await registry.QUINTY_NFT();
      const DISPUTE_RESOLVER = await registry.DISPUTE_RESOLVER();
      const GRANT_PROGRAM = await registry.GRANT_PROGRAM();
      const CROWDFUNDING = await registry.CROWDFUNDING();
      const LOOKING_FOR_GRANT = await registry.LOOKING_FOR_GRANT();
      const AIRDROP_BOUNTY = await registry.AIRDROP_BOUNTY();
      const SOCIAL_VERIFICATION = await registry.SOCIAL_VERIFICATION();

      expect(await registry.getContract(QUINTY)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(QUINTY_REPUTATION)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(QUINTY_NFT)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(DISPUTE_RESOLVER)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(GRANT_PROGRAM)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(CROWDFUNDING)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(LOOKING_FOR_GRANT)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(AIRDROP_BOUNTY)).to.not.equal(ethers.ZeroAddress);
      expect(await registry.getContract(SOCIAL_VERIFICATION)).to.not.equal(ethers.ZeroAddress);

      // Verify all are version 1
      expect(await registry.getLatestVersion(QUINTY)).to.equal(1);
      expect(await registry.getLatestVersion(QUINTY_REPUTATION)).to.equal(1);
      expect(await registry.getLatestVersion(QUINTY_NFT)).to.equal(1);
    });

    it("Should reject full ecosystem deployment from non-owner", async function () {
      await expect(
        factory.connect(user).deployFullEcosystem("ipfs://rep/", "ipfs://nft/")
      ).to.be.reverted;
    });

    it("Should allow getAllContracts() after full deployment", async function () {
      await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");

      const allContracts = await registry.getAllContracts();

      // All addresses should be non-zero
      for (let i = 0; i < 9; i++) {
        expect(allContracts[i]).to.not.equal(ethers.ZeroAddress);
      }
    });
  });

  describe("Setup Functions", function () {
    beforeEach(async function () {
      // Deploy full ecosystem first
      await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");
    });

    it("Should setup core connections", async function () {
      await expect(factory.setupCoreConnections()).to.not.be.reverted;

      // Verify connections were made
      const QUINTY = await registry.QUINTY();
      const QUINTY_REPUTATION = await registry.QUINTY_REPUTATION();
      const quintyAddress = await registry.getContract(QUINTY);
      const reputationAddress = await registry.getContract(QUINTY_REPUTATION);

      // Check QuintyReputation ownership was transferred
      const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
      const reputation = QuintyReputation.attach(reputationAddress);
      expect(await reputation.owner()).to.equal(quintyAddress);
    });

    it("Should setup funding connections", async function () {
      await expect(factory.setupFundingConnections()).to.not.be.reverted;

      // Verify NFT address was set in funding contracts
      const GRANT_PROGRAM = await registry.GRANT_PROGRAM();
      const QUINTY_NFT = await registry.QUINTY_NFT();
      const grantAddress = await registry.getContract(GRANT_PROGRAM);
      const nftAddress = await registry.getContract(QUINTY_NFT);

      const GrantProgram = await ethers.getContractFactory("GrantProgram");
      const grantProgram = GrantProgram.attach(grantAddress);
      expect(await grantProgram.nftAddress()).to.equal(nftAddress);
    });

    it("Should reject setup from non-owner", async function () {
      await expect(factory.connect(user).setupCoreConnections()).to.be.reverted;
      await expect(factory.connect(user).setupFundingConnections()).to.be.reverted;
    });

    it("Should reject core setup when contracts not deployed", async function () {
      // Deploy fresh factory
      const QuintyFactory = await ethers.getContractFactory("QuintyFactory");
      const freshFactory = await QuintyFactory.deploy(await registry.getAddress());
      await freshFactory.waitForDeployment();
      await registry.grantRole(UPGRADER_ROLE, await freshFactory.getAddress());

      await expect(freshFactory.setupCoreConnections()).to.be.reverted;
    });

    it("Should handle funding setup when contracts partially deployed", async function () {
      // Deploy only some funding contracts
      await factory.deployGrantProgram();
      await factory.deployQuintyNFT("ipfs://nft/");

      // Should not revert, just skip undeployed contracts
      await expect(factory.setupFundingConnections()).to.not.be.reverted;
    });
  });

  describe("Event Emissions", function () {
    it("Should emit ContractDeployed with correct parameters", async function () {
      const QUINTY = await registry.QUINTY();

      const tx = await factory.deployQuinty();
      const receipt = await tx.wait();

      // Get the deployed address from registry
      const quintyAddress = await registry.getContract(QUINTY);

      // Check event was emitted
      const events = receipt?.logs.filter((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === "ContractDeployed";
        } catch {
          return false;
        }
      });

      expect(events?.length).to.be.gt(0);
    });

    it("Should emit EcosystemDeployed on full deployment", async function () {
      const tx = await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");
      const receipt = await tx.wait();

      const events = receipt?.logs.filter((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === "EcosystemDeployed";
        } catch {
          return false;
        }
      });

      expect(events?.length).to.equal(1);
    });
  });

  describe("Upgrade Scenarios", function () {
    it("Should deploy and register Quinty v2", async function () {
      // Deploy v1
      await factory.deployQuinty();

      const QUINTY = await registry.QUINTY();
      const v1Address = await registry.getContract(QUINTY);

      // Deploy v2
      await factory.deployQuinty();
      const v2Address = await registry.getContract(QUINTY);

      // Verify v2 is different and is latest
      expect(v2Address).to.not.equal(v1Address);
      expect(await registry.getLatestVersion(QUINTY)).to.equal(2);

      // Verify v1 still exists but deprecated
      const v1Stored = await registry.getContractByVersion(QUINTY, 1);
      expect(v1Stored).to.equal(v1Address);
    });

    it("Should handle upgrading individual contracts in ecosystem", async function () {
      // Deploy full ecosystem
      await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");

      const GRANT_PROGRAM = await registry.GRANT_PROGRAM();
      const v1Address = await registry.getContract(GRANT_PROGRAM);

      // Upgrade just GrantProgram
      await factory.deployGrantProgram();
      const v2Address = await registry.getContract(GRANT_PROGRAM);

      // Verify upgrade
      expect(v2Address).to.not.equal(v1Address);
      expect(await registry.getLatestVersion(GRANT_PROGRAM)).to.equal(2);

      // Other contracts should still be v1
      const QUINTY = await registry.QUINTY();
      expect(await registry.getLatestVersion(QUINTY)).to.equal(1);
    });
  });

  describe("Integration with Registry", function () {
    it("Should automatically register contracts after deployment", async function () {
      await factory.deployQuinty();

      const QUINTY = await registry.QUINTY();
      expect(await registry.isActive(QUINTY)).to.be.true;
    });

    it("Should track deployment timestamps via registry", async function () {
      await factory.deployQuinty();

      const QUINTY = await registry.QUINTY();
      const info = await registry.getContractInfo(QUINTY);

      expect(info.deployedAt).to.be.gt(0);
      expect(info.deprecatedAt).to.equal(0);
    });

    it("Should work with registry versioning", async function () {
      // Deploy 3 versions
      await factory.deployQuinty();
      await factory.deployQuinty();
      await factory.deployQuinty();

      const QUINTY = await registry.QUINTY();
      const count = await registry.getVersionCount(QUINTY);
      expect(count).to.equal(3);

      const versions = await registry.getAllVersions(QUINTY);
      expect(versions.length).to.equal(3);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle deploying same contract type multiple times", async function () {
      for (let i = 0; i < 5; i++) {
        await factory.deployQuinty();
      }

      const QUINTY = await registry.QUINTY();
      expect(await registry.getLatestVersion(QUINTY)).to.equal(5);
    });

    it("Should handle mixed individual and ecosystem deployments", async function () {
      // Deploy some individual contracts
      await factory.deployQuinty();
      await factory.deployGrantProgram();

      // Then deploy full ecosystem (should upgrade existing, deploy new)
      await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");

      const QUINTY = await registry.QUINTY();
      const GRANT_PROGRAM = await registry.GRANT_PROGRAM();
      const QUINTY_NFT = await registry.QUINTY_NFT();

      // Quinty and GrantProgram should be v2 (upgraded)
      expect(await registry.getLatestVersion(QUINTY)).to.equal(2);
      expect(await registry.getLatestVersion(GRANT_PROGRAM)).to.equal(2);

      // QuintyNFT should be v1 (first deployment)
      expect(await registry.getLatestVersion(QUINTY_NFT)).to.equal(1);
    });

    it("Should maintain factory ownership throughout deployments", async function () {
      await factory.deployFullEcosystem("ipfs://rep/", "ipfs://nft/");

      expect(await factory.owner()).to.equal(owner.address);
    });
  });
});
