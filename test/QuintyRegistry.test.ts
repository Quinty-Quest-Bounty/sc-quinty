import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("QuintyRegistry Contract", function () {
  let registry: any;
  let owner: any;
  let upgrader: any;
  let pauser: any;
  let unauthorized: any;
  let mockContract1: any;
  let mockContract2: any;

  let DEFAULT_ADMIN_ROLE: string;
  let UPGRADER_ROLE: string;
  let PAUSER_ROLE: string;
  let QUINTY: string;
  let QUINTY_REPUTATION: string;
  let GRANT_PROGRAM: string;

  beforeEach(async function () {
    [owner, upgrader, pauser, unauthorized, mockContract1, mockContract2] = await ethers.getSigners();

    // Deploy QuintyRegistry
    const QuintyRegistry = await ethers.getContractFactory("QuintyRegistry");
    registry = await QuintyRegistry.deploy();
    await registry.waitForDeployment();

    // Get role constants
    DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
    UPGRADER_ROLE = await registry.UPGRADER_ROLE();
    PAUSER_ROLE = await registry.PAUSER_ROLE();

    // Get contract type constants
    QUINTY = await registry.QUINTY();
    QUINTY_REPUTATION = await registry.QUINTY_REPUTATION();
    GRANT_PROGRAM = await registry.GRANT_PROGRAM();

    // Grant roles
    await registry.grantRole(UPGRADER_ROLE, upgrader.address);
    await registry.grantRole(PAUSER_ROLE, pauser.address);
  });

  describe("Deployment", function () {
    it("Should set correct deployer roles", async function () {
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await registry.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
      expect(await registry.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });

    it("Should set deployment timestamp", async function () {
      const deployedAt = await registry.deployedAt();
      expect(deployedAt).to.be.gt(0);
    });

    it("Should have correct contract type identifiers", async function () {
      expect(QUINTY).to.equal(ethers.keccak256(ethers.toUtf8Bytes("QUINTY")));
      expect(QUINTY_REPUTATION).to.equal(ethers.keccak256(ethers.toUtf8Bytes("QUINTY_REPUTATION")));
      expect(GRANT_PROGRAM).to.equal(ethers.keccak256(ethers.toUtf8Bytes("GRANT_PROGRAM")));
    });
  });

  describe("Contract Registration", function () {
    it("Should register first version of a contract", async function () {
      await expect(registry.connect(upgrader).registerContract(QUINTY, mockContract1.address))
        .to.emit(registry, "ContractRegistered")
        .withArgs(QUINTY, mockContract1.address, 1, ethers.ZeroAddress);

      const contractAddress = await registry.getContract(QUINTY);
      expect(contractAddress).to.equal(mockContract1.address);

      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(1);
    });

    it("Should register second version and auto-deprecate first", async function () {
      // Register v1
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);

      // Register v2
      await expect(registry.connect(upgrader).registerContract(QUINTY, mockContract2.address))
        .to.emit(registry, "ContractRegistered")
        .withArgs(QUINTY, mockContract2.address, 2, mockContract1.address);

      // Check v2 is active
      const contractAddress = await registry.getContract(QUINTY);
      expect(contractAddress).to.equal(mockContract2.address);

      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(2);

      // Check v1 is deprecated
      const v1Info = await registry.getContractByVersion(QUINTY, 1);
      expect(v1Info).to.equal(mockContract1.address);

      const info = await registry.getContractInfo(QUINTY);
      expect(info.version).to.equal(2);
      expect(info.isActive).to.be.true;
    });

    it("Should reject registration with invalid address", async function () {
      await expect(
        registry.connect(upgrader).registerContract(QUINTY, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid contract address");
    });

    it("Should reject registration with invalid contract type", async function () {
      await expect(
        registry.connect(upgrader).registerContract(ethers.ZeroHash, mockContract1.address)
      ).to.be.revertedWith("Invalid contract type");
    });

    it("Should reject registration from unauthorized account", async function () {
      await expect(
        registry.connect(unauthorized).registerContract(QUINTY, mockContract1.address)
      ).to.be.reverted;
    });
  });

  describe("Batch Registration", function () {
    it("Should batch register multiple contracts", async function () {
      const types = [QUINTY, QUINTY_REPUTATION, GRANT_PROGRAM];
      const addresses = [mockContract1.address, mockContract2.address, owner.address];

      await expect(registry.batchRegisterContracts(types, addresses))
        .to.emit(registry, "ContractRegistered")
        .withArgs(QUINTY, mockContract1.address, 1, ethers.ZeroAddress);

      expect(await registry.getContract(QUINTY)).to.equal(mockContract1.address);
      expect(await registry.getContract(QUINTY_REPUTATION)).to.equal(mockContract2.address);
      expect(await registry.getContract(GRANT_PROGRAM)).to.equal(owner.address);
    });

    it("Should reject batch with mismatched array lengths", async function () {
      const types = [QUINTY, QUINTY_REPUTATION];
      const addresses = [mockContract1.address];

      await expect(
        registry.batchRegisterContracts(types, addresses)
      ).to.be.revertedWith("Array length mismatch");
    });

    it("Should reject batch with too many contracts", async function () {
      const types = new Array(21).fill(QUINTY);
      const addresses = new Array(21).fill(mockContract1.address);

      await expect(
        registry.batchRegisterContracts(types, addresses)
      ).to.be.revertedWith("Too many contracts");
    });

    it("Should allow batch from upgrader role", async function () {
      const types = [QUINTY];
      const addresses = [mockContract1.address];

      await expect(
        registry.connect(upgrader).batchRegisterContracts(types, addresses)
      ).to.not.be.reverted;
    });

    it("Should reject batch from non-upgrader", async function () {
      const types = [QUINTY];
      const addresses = [mockContract1.address];

      await expect(
        registry.connect(unauthorized).batchRegisterContracts(types, addresses)
      ).to.be.reverted;
    });
  });

  describe("Contract Retrieval", function () {
    beforeEach(async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);
      await registry.connect(upgrader).registerContract(QUINTY, mockContract2.address);
    });

    it("Should get latest contract address", async function () {
      const address = await registry.getContract(QUINTY);
      expect(address).to.equal(mockContract2.address);
    });

    it("Should get specific version", async function () {
      const v1 = await registry.getContractByVersion(QUINTY, 1);
      const v2 = await registry.getContractByVersion(QUINTY, 2);

      expect(v1).to.equal(mockContract1.address);
      expect(v2).to.equal(mockContract2.address);
    });

    it("Should get contract info", async function () {
      const info = await registry.getContractInfo(QUINTY);

      expect(info.contractAddress).to.equal(mockContract2.address);
      expect(info.version).to.equal(2);
      expect(info.isActive).to.be.true;
      expect(info.deployedAt).to.be.gt(0);
      expect(info.deprecatedAt).to.equal(0);
    });

    it("Should get all versions", async function () {
      const versions = await registry.getAllVersions(QUINTY);

      expect(versions.length).to.equal(2);
      expect(versions[0]).to.equal(mockContract1.address);
      expect(versions[1]).to.equal(mockContract2.address);
    });

    it("Should reject getting unregistered contract", async function () {
      const CROWDFUNDING = await registry.CROWDFUNDING();
      await expect(registry.getContract(CROWDFUNDING)).to.be.revertedWith("Contract type not registered");
    });

    it("Should reject getting invalid version", async function () {
      await expect(registry.getContractByVersion(QUINTY, 0)).to.be.revertedWith("Invalid version");
      await expect(registry.getContractByVersion(QUINTY, 999)).to.be.revertedWith("Invalid version");
    });
  });

  describe("Contract Deprecation", function () {
    beforeEach(async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);
      await registry.connect(upgrader).registerContract(QUINTY, mockContract2.address);
    });

    it("Should manually deprecate a version", async function () {
      await expect(registry.deprecateContract(QUINTY, 2))
        .to.emit(registry, "ContractDeprecated")
        .withArgs(QUINTY, 2, mockContract2.address);

      const info = await registry.getContractInfo(QUINTY);
      expect(info.isActive).to.be.false;
      expect(info.deprecatedAt).to.be.gt(0);
    });

    it("Should reject deprecating non-existent version", async function () {
      await expect(registry.deprecateContract(QUINTY, 999)).to.be.revertedWith("Invalid version");
    });

    it("Should reject deprecating already deprecated version", async function () {
      await registry.deprecateContract(QUINTY, 2);

      await expect(registry.deprecateContract(QUINTY, 2)).to.be.revertedWith("Already deprecated");
    });

    it("Should reject deprecation from non-admin", async function () {
      await expect(
        registry.connect(upgrader).deprecateContract(QUINTY, 2)
      ).to.be.reverted;
    });

    it("Should reject getting deprecated contract", async function () {
      await registry.deprecateContract(QUINTY, 2);

      await expect(registry.getContract(QUINTY)).to.be.revertedWith("Contract is deprecated");
    });
  });

  describe("Active Status", function () {
    it("Should return false for unregistered contract", async function () {
      const isActive = await registry.isActive(QUINTY);
      expect(isActive).to.be.false;
    });

    it("Should return true for active contract", async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);

      const isActive = await registry.isActive(QUINTY);
      expect(isActive).to.be.true;
    });

    it("Should return false for deprecated contract", async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);
      await registry.deprecateContract(QUINTY, 1);

      const isActive = await registry.isActive(QUINTY);
      expect(isActive).to.be.false;
    });
  });

  describe("Pause Functionality", function () {
    it("Should pause protocol", async function () {
      await expect(registry.connect(pauser).setPaused(true))
        .to.emit(registry, "ProtocolPaused")
        .withArgs(true);

      expect(await registry.isPaused()).to.be.true;
    });

    it("Should unpause protocol", async function () {
      await registry.connect(pauser).setPaused(true);

      await expect(registry.connect(pauser).setPaused(false))
        .to.emit(registry, "ProtocolPaused")
        .withArgs(false);

      expect(await registry.isPaused()).to.be.false;
    });

    it("Should reject pause from unauthorized account", async function () {
      await expect(registry.connect(unauthorized).setPaused(true)).to.be.reverted;
    });
  });

  describe("Convenience Functions", function () {
    beforeEach(async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);
      await registry.connect(upgrader).registerContract(QUINTY_REPUTATION, mockContract2.address);
    });

    it("Should get all contracts", async function () {
      const allContracts = await registry.getAllContracts();

      expect(allContracts[0]).to.equal(mockContract1.address); // quinty
      expect(allContracts[1]).to.equal(mockContract2.address); // reputation
      expect(allContracts[2]).to.equal(ethers.ZeroAddress); // nft (not registered)
    });

    it("Should get contract type ID from string", async function () {
      const typeId = await registry.getContractTypeId("QUINTY");
      expect(typeId).to.equal(QUINTY);
    });

    it("Should get version count", async function () {
      await registry.connect(upgrader).registerContract(QUINTY, owner.address);

      const count = await registry.getVersionCount(QUINTY);
      expect(count).to.equal(2);
    });

    it("Should get latest version number", async function () {
      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(1);

      await registry.connect(upgrader).registerContract(QUINTY, owner.address);

      const version2 = await registry.getLatestVersion(QUINTY);
      expect(version2).to.equal(2);
    });
  });

  describe("Role Management", function () {
    it("Should grant upgrader role", async function () {
      await registry.grantRole(UPGRADER_ROLE, unauthorized.address);

      expect(await registry.hasRole(UPGRADER_ROLE, unauthorized.address)).to.be.true;

      // Should be able to register contracts
      await expect(
        registry.connect(unauthorized).registerContract(QUINTY, mockContract1.address)
      ).to.not.be.reverted;
    });

    it("Should revoke upgrader role", async function () {
      await registry.revokeRole(UPGRADER_ROLE, upgrader.address);

      expect(await registry.hasRole(UPGRADER_ROLE, upgrader.address)).to.be.false;

      // Should not be able to register contracts
      await expect(
        registry.connect(upgrader).registerContract(QUINTY, mockContract1.address)
      ).to.be.reverted;
    });

    it("Should grant pauser role", async function () {
      await registry.grantRole(PAUSER_ROLE, unauthorized.address);

      expect(await registry.hasRole(PAUSER_ROLE, unauthorized.address)).to.be.true;

      // Should be able to pause
      await expect(registry.connect(unauthorized).setPaused(true)).to.not.be.reverted;
    });
  });

  describe("Version Tracking", function () {
    it("Should track multiple versions correctly", async function () {
      // Register 5 versions
      const contracts = [mockContract1, mockContract2, owner, upgrader, pauser];

      for (let i = 0; i < contracts.length; i++) {
        await registry.connect(upgrader).registerContract(QUINTY, contracts[i].address);
      }

      // Verify version count
      const count = await registry.getVersionCount(QUINTY);
      expect(count).to.equal(5);

      // Verify latest version
      const latest = await registry.getLatestVersion(QUINTY);
      expect(latest).to.equal(5);

      // Verify all versions
      const allVersions = await registry.getAllVersions(QUINTY);
      expect(allVersions.length).to.equal(5);

      for (let i = 0; i < contracts.length; i++) {
        expect(allVersions[i]).to.equal(contracts[i].address);
      }

      // Verify current contract
      const current = await registry.getContract(QUINTY);
      expect(current).to.equal(pauser.address);

      // Verify old versions are deprecated
      for (let i = 1; i < 5; i++) {
        const info = await registry.getContractByVersion(QUINTY, i);
        expect(info).to.not.equal(ethers.ZeroAddress);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle registration of same address twice", async function () {
      await registry.connect(upgrader).registerContract(QUINTY, mockContract1.address);

      // Re-registering same address creates new version
      await expect(
        registry.connect(upgrader).registerContract(QUINTY, mockContract1.address)
      ).to.not.be.reverted;

      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(2);
    });

    it("Should handle empty batch registration", async function () {
      const types: any[] = [];
      const addresses: any[] = [];

      await expect(registry.batchRegisterContracts(types, addresses)).to.not.be.reverted;
    });

    it("Should return 0 for version count of unregistered contract", async function () {
      const count = await registry.getVersionCount(QUINTY);
      expect(count).to.equal(0);
    });

    it("Should return 0 for latest version of unregistered contract", async function () {
      const version = await registry.getLatestVersion(QUINTY);
      expect(version).to.equal(0);
    });

    it("Should return empty array for getAllVersions of unregistered contract", async function () {
      const versions = await registry.getAllVersions(QUINTY);
      expect(versions.length).to.equal(0);
    });
  });
});
