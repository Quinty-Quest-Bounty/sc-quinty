import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Quest, QuintyReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Quest V2 - ERC-20, Pull Withdrawals, Delegated Verifiers", function () {
    let quest: Quest;
    let reputation: QuintyReputation;
    let mockToken: any;
    let owner: SignerWithAddress;
    let creator: SignerWithAddress;
    let solver1: SignerWithAddress;
    let solver2: SignerWithAddress;
    let solver3: SignerWithAddress;
    let verifier: SignerWithAddress;
    let other: SignerWithAddress;

    const PER_QUALIFIER = ethers.parseEther("0.1");
    const MAX_QUALIFIERS = 5;
    const TOTAL_ESCROW = PER_QUALIFIER * BigInt(MAX_QUALIFIERS);
    const ETH = ethers.ZeroAddress;

    async function createDefaultQuest(token = ETH) {
        const deadline = (await time.latest()) + 86400 * 7;
        const total = PER_QUALIFIER * BigInt(MAX_QUALIFIERS);

        if (token === ETH) {
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER, MAX_QUALIFIERS,
                deadline, "QmRequirements", token,
                { value: total }
            );
        } else {
            await mockToken.connect(creator).approve(await quest.getAddress(), total);
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER, MAX_QUALIFIERS,
                deadline, "QmRequirements", token
            );
        }
        return { deadline, total };
    }

    beforeEach(async function () {
        [owner, creator, solver1, solver2, solver3, verifier, other] = await ethers.getSigners();

        // Deploy mock ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Mock USDC", "MUSDC", 6);
        await mockToken.waitForDeployment();

        // Mint tokens
        const mintAmount = ethers.parseUnits("10000", 6);
        await mockToken.mint(creator.address, mintAmount);

        // Deploy Reputation
        const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
        reputation = await QuintyReputation.deploy("ipfs://base/");

        // Deploy Quest
        const Quest = await ethers.getContractFactory("Quest");
        quest = await Quest.deploy();

        // Connect contracts
        await quest.setReputationAddress(await reputation.getAddress());
        await reputation.authorizeCaller(await quest.getAddress());

        // Whitelist mock token
        await quest.allowToken(await mockToken.getAddress());
    });

    describe("Quest Creation (ETH)", function () {
        it("Should create quest with proper escrow", async function () {
            await createDefaultQuest();

            const questInfo = await quest.getQuest(1);
            expect(questInfo.creator).to.equal(creator.address);
            expect(questInfo.title).to.equal("Test Quest");
            expect(questInfo.totalAmount).to.equal(TOTAL_ESCROW);
            expect(questInfo.perQualifier).to.equal(PER_QUALIFIER);
            expect(questInfo.maxQualifiers).to.equal(MAX_QUALIFIERS);
            expect(questInfo.token).to.equal(ETH);
            expect(questInfo.resolved).to.be.false;
        });

        it("Should reject incorrect escrow amount", async function () {
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                    deadline, "QmReq", ETH,
                    { value: ethers.parseEther("0.3") }
                )
            ).to.be.revertedWith("Must escrow full amount");
        });

        it("Should reject invalid deadline", async function () {
            const pastDeadline = (await time.latest()) - 1;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                    pastDeadline, "QmReq", ETH,
                    { value: TOTAL_ESCROW }
                )
            ).to.be.revertedWith("Invalid deadline");
        });

        it("Should reject empty title", async function () {
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                    deadline, "QmReq", ETH,
                    { value: TOTAL_ESCROW }
                )
            ).to.be.revertedWith("Title required");
        });

        it("Should record reputation on creation", async function () {
            await createDefaultQuest();
            const stats = await reputation.getUserStats(creator.address);
            expect(stats.totalBountiesCreated).to.equal(1);
        });
    });

    describe("Quest Creation (ERC-20)", function () {
        it("Should create quest with ERC-20 token", async function () {
            const tokenAddr = await mockToken.getAddress();
            const perQ = ethers.parseUnits("10", 6);
            const deadline = (await time.latest()) + 86400 * 7;
            const total = perQ * BigInt(MAX_QUALIFIERS);

            await mockToken.connect(creator).approve(await quest.getAddress(), total);
            await quest.connect(creator).createQuest(
                "Token Quest", "Description",
                perQ, MAX_QUALIFIERS,
                deadline, "QmReq", tokenAddr
            );

            const questInfo = await quest.getQuest(1);
            expect(questInfo.token).to.equal(tokenAddr);
            expect(questInfo.totalAmount).to.equal(total);
        });

        it("Should reject non-whitelisted token", async function () {
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc", 100n, 5,
                    deadline, "QmReq", solver1.address
                )
            ).to.be.revertedWith("Token not allowed");
        });

        it("Should reject ETH sent with token quest", async function () {
            const tokenAddr = await mockToken.getAddress();
            const deadline = (await time.latest()) + 86400;
            const total = PER_QUALIFIER * BigInt(MAX_QUALIFIERS);
            await mockToken.connect(creator).approve(await quest.getAddress(), total);
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                    deadline, "QmReq", tokenAddr,
                    { value: 1 }
                )
            ).to.be.revertedWith("Do not send ETH for token quest");
        });
    });

    describe("Entry Submissions", function () {
        beforeEach(async function () {
            await createDefaultQuest();
        });

        it("Should accept valid entry", async function () {
            await expect(
                quest.connect(solver1).submitEntry(1, "QmProof123")
            ).to.emit(quest, "EntrySubmitted");

            const entry = await quest.getEntry(1, 0);
            expect(entry.solver).to.equal(solver1.address);
            expect(entry.ipfsProofCid).to.equal("QmProof123");
            expect(entry.status).to.equal(0); // Pending
        });

        it("Should prevent duplicate submissions", async function () {
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await expect(
                quest.connect(solver1).submitEntry(1, "QmProof2")
            ).to.be.revertedWith("Already submitted");
        });

        it("Should reject empty proof CID", async function () {
            await expect(
                quest.connect(solver1).submitEntry(1, "")
            ).to.be.revertedWith("Invalid proof CID");
        });

        it("Should reject submissions after deadline", async function () {
            await time.increase(86400 * 7 + 1);
            await expect(
                quest.connect(solver1).submitEntry(1, "QmProof")
            ).to.be.revertedWith("Quest inactive");
        });

        it("Should track user submissions correctly", async function () {
            let userSub = await quest.getUserSubmission(1, solver1.address);
            expect(userSub.hasSubmittedEntry).to.be.false;

            await quest.connect(solver1).submitEntry(1, "QmProof");

            userSub = await quest.getUserSubmission(1, solver1.address);
            expect(userSub.hasSubmittedEntry).to.be.true;
            expect(userSub.submissionIndex).to.equal(0);
            expect(userSub.status).to.equal(0); // Pending
        });

        it("Should record reputation on submission", async function () {
            await quest.connect(solver1).submitEntry(1, "QmProof");
            const stats = await reputation.getUserStats(solver1.address);
            expect(stats.totalSubmissions).to.equal(1);
        });
    });

    describe("Entry Verification (Pull-Based)", function () {
        beforeEach(async function () {
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
            await quest.connect(solver3).submitEntry(1, "QmProof3");
        });

        it("Should credit approved entry via pull pattern", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 1, "Great work!");

            // Solver should have pending balance, not direct payment
            const pending = await quest.pendingBalance(ETH, solver1.address);
            expect(pending).to.equal(PER_QUALIFIER);

            const entry = await quest.getEntry(1, 0);
            expect(entry.status).to.equal(1); // Approved
            expect(entry.feedback).to.equal("Great work!");
        });

        it("Should allow withdrawal after approval", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");

            const balBefore = await ethers.provider.getBalance(solver1.address);
            const tx = await quest.connect(solver1).withdrawETH();
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(solver1.address);

            expect(balAfter + gasCost - balBefore).to.equal(PER_QUALIFIER);
        });

        it("Should allow creator to reject entry", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 2, "Does not meet requirements");

            const entry = await quest.getEntry(1, 0);
            expect(entry.status).to.equal(2); // Rejected

            // No funds credited
            expect(await quest.pendingBalance(ETH, solver1.address)).to.equal(0);
        });

        it("Should prevent verifying already verified entries", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 1, "First");
            await expect(
                quest.connect(creator).verifyEntry(1, 0, 2, "Second")
            ).to.be.revertedWith("Already verified");
        });

        it("Should handle batch verification", async function () {
            const entryIds = [0, 1, 2];
            const statuses = [1, 2, 1]; // Approve, Reject, Approve
            const feedbacks = ["Good", "Bad", "Excellent"];

            await quest.connect(creator).verifyMultipleEntries(1, entryIds, statuses, feedbacks);

            expect((await quest.getEntry(1, 0)).status).to.equal(1);
            expect((await quest.getEntry(1, 1)).status).to.equal(2);
            expect((await quest.getEntry(1, 2)).status).to.equal(1);

            // Two approved = 2 * PER_QUALIFIER credited
            expect(await quest.pendingBalance(ETH, solver1.address)).to.equal(PER_QUALIFIER);
            expect(await quest.pendingBalance(ETH, solver3.address)).to.equal(PER_QUALIFIER);
            expect(await quest.pendingBalance(ETH, solver2.address)).to.equal(0);
        });

        it("Should auto-finalize when max qualifiers reached", async function () {
            const solver4 = (await ethers.getSigners())[7];
            const solver5 = (await ethers.getSigners())[8];

            await quest.connect(solver4).submitEntry(1, "QmProof4");
            await quest.connect(solver5).submitEntry(1, "QmProof5");

            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 1, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 2, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 3, 1, "Good");

            // 5th approval should trigger auto-finalization
            await expect(
                quest.connect(creator).verifyEntry(1, 4, 1, "Good")
            ).to.emit(quest, "QuestFinalized");

            const questInfo = await quest.getQuest(1);
            expect(questInfo.resolved).to.be.true;
            expect(questInfo.qualifiersCount).to.equal(MAX_QUALIFIERS);
        });
    });

    describe("Delegated Verifiers", function () {
        beforeEach(async function () {
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
        });

        it("Should allow creator to add verifier", async function () {
            await expect(
                quest.connect(creator).addVerifier(1, verifier.address)
            ).to.emit(quest, "VerifierAdded");

            expect(await quest.questVerifiers(1, verifier.address)).to.be.true;
        });

        it("Should allow delegated verifier to approve entries", async function () {
            await quest.connect(creator).addVerifier(1, verifier.address);
            await quest.connect(verifier).verifyEntry(1, 0, 1, "Looks good");

            expect((await quest.getEntry(1, 0)).status).to.equal(1);
            expect(await quest.pendingBalance(ETH, solver1.address)).to.equal(PER_QUALIFIER);
        });

        it("Should allow creator to remove verifier", async function () {
            await quest.connect(creator).addVerifier(1, verifier.address);
            await quest.connect(creator).removeVerifier(1, verifier.address);

            expect(await quest.questVerifiers(1, verifier.address)).to.be.false;
        });

        it("Should reject non-creator adding verifiers", async function () {
            await expect(
                quest.connect(other).addVerifier(1, verifier.address)
            ).to.be.revertedWith("Not quest creator");
        });

        it("Should reject unauthorized verifier", async function () {
            await expect(
                quest.connect(other).verifyEntry(1, 0, 1, "Approved")
            ).to.be.revertedWith("Not authorized verifier");
        });

        it("Should prevent self-approval", async function () {
            // solver1 tries to verify own entry
            await quest.connect(creator).addVerifier(1, solver1.address);
            await expect(
                quest.connect(solver1).verifyEntry(1, 0, 1, "Self approve")
            ).to.be.revertedWith("Cannot verify own entry");
        });

        it("Should prevent self-approval in batch", async function () {
            await quest.connect(creator).addVerifier(1, solver1.address);
            await expect(
                quest.connect(solver1).verifyMultipleEntries(
                    1, [0], [1], ["Self approve"]
                )
            ).to.be.revertedWith("Cannot verify own entry");
        });
    });

    describe("Quest Finalization", function () {
        beforeEach(async function () {
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
        });

        it("Should credit unused amount to creator on finalization", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 1, 1, "Good");

            await quest.connect(creator).finalizeQuest(1);

            // Creator should get refund for unused slots (3 * PER_QUALIFIER)
            const expectedRefund = PER_QUALIFIER * BigInt(3);
            expect(await quest.pendingBalance(ETH, creator.address)).to.equal(expectedRefund);

            const questInfo = await quest.getQuest(1);
            expect(questInfo.resolved).to.be.true;
        });

        it("Should allow finalization after deadline", async function () {
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await time.increase(86400 * 7 + 1);

            await expect(
                quest.connect(other).finalizeQuest(1)
            ).to.emit(quest, "QuestFinalized");
        });

        it("Should prevent unauthorized finalization before deadline", async function () {
            await expect(
                quest.connect(other).finalizeQuest(1)
            ).to.be.revertedWith("Not authorized to finalize");
        });
    });

    describe("Quest Cancellation", function () {
        beforeEach(async function () {
            await createDefaultQuest();
        });

        it("Should credit creator via pull on cancel", async function () {
            await quest.connect(creator).cancelQuest(1);

            expect(await quest.pendingBalance(ETH, creator.address)).to.equal(TOTAL_ESCROW);

            const questInfo = await quest.getQuest(1);
            expect(questInfo.cancelled).to.be.true;
        });

        it("Should prevent cancellation with approved entries", async function () {
            await quest.connect(solver1).submitEntry(1, "QmProof");
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");

            await expect(
                quest.connect(creator).cancelQuest(1)
            ).to.be.revertedWith("Has approved entries");
        });

        it("Should prevent non-creator from cancelling", async function () {
            await expect(
                quest.connect(other).cancelQuest(1)
            ).to.be.revertedWith("Not quest creator");
        });

        it("Should allow cancel during pause", async function () {
            await quest.pause();
            await expect(
                quest.connect(creator).cancelQuest(1)
            ).to.not.be.reverted;
        });
    });

    describe("Pausable", function () {
        it("Should prevent creation when paused", async function () {
            await quest.pause();
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                    deadline, "QmReq", ETH,
                    { value: TOTAL_ESCROW }
                )
            ).to.be.revertedWithCustomError(quest, "EnforcedPause");
        });

        it("Should prevent submissions when paused", async function () {
            await createDefaultQuest();
            await quest.pause();
            await expect(
                quest.connect(solver1).submitEntry(1, "QmProof")
            ).to.be.revertedWithCustomError(quest, "EnforcedPause");
        });

        it("Should allow withdrawals during pause", async function () {
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");

            await quest.pause();

            await expect(
                quest.connect(solver1).withdrawETH()
            ).to.not.be.reverted;
        });

        it("Should reject non-owner pause", async function () {
            await expect(
                quest.connect(other).pause()
            ).to.be.revertedWithCustomError(quest, "OwnableUnauthorizedAccount");
        });
    });

    describe("Token Whitelist", function () {
        it("Should allow/revoke tokens by owner", async function () {
            const tokenAddr = await mockToken.getAddress();
            expect(await quest.allowedTokens(tokenAddr)).to.be.true;

            await quest.revokeToken(tokenAddr);
            expect(await quest.allowedTokens(tokenAddr)).to.be.false;
        });

        it("Should reject non-owner token management", async function () {
            await expect(
                quest.connect(other).allowToken(solver1.address)
            ).to.be.revertedWithCustomError(quest, "OwnableUnauthorizedAccount");
        });
    });

    describe("Rescue ERC20", function () {
        it("Should rescue accidentally sent tokens", async function () {
            const tokenAddr = await mockToken.getAddress();
            await mockToken.connect(creator).transfer(await quest.getAddress(), 1000n);

            await quest.rescueERC20(tokenAddr, 1000n);
            expect(await mockToken.balanceOf(owner.address)).to.equal(1000n);
        });

        it("Should not drain active escrow", async function () {
            const tokenAddr = await mockToken.getAddress();
            const perQ = ethers.parseUnits("10", 6);
            const total = perQ * BigInt(MAX_QUALIFIERS);

            await mockToken.connect(creator).approve(await quest.getAddress(), total);
            await quest.connect(creator).createQuest(
                "Token Quest", "Desc", perQ, MAX_QUALIFIERS,
                (await time.latest()) + 86400 * 7, "QmReq", tokenAddr
            );

            await expect(
                quest.rescueERC20(tokenAddr, total)
            ).to.be.revertedWith("Cannot drain escrow");
        });
    });

    describe("Withdrawal Edge Cases", function () {
        it("Should reject withdrawal with zero balance", async function () {
            await expect(
                quest.connect(other).withdrawETH()
            ).to.be.revertedWith("Nothing to withdraw");
        });

        it("Should reject token withdrawal with zero balance", async function () {
            await expect(
                quest.connect(other).withdrawToken(await mockToken.getAddress())
            ).to.be.revertedWith("Nothing to withdraw");
        });

        it("Should accumulate multiple credits", async function () {
            // Create two quests, get approved on both
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");

            const deadline2 = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Quest 2", "Desc", PER_QUALIFIER, MAX_QUALIFIERS,
                deadline2, "QmReq2", ETH,
                { value: TOTAL_ESCROW }
            );
            await quest.connect(solver1).submitEntry(2, "QmProof2");
            await quest.connect(creator).verifyEntry(2, 0, 1, "Good");

            expect(await quest.pendingBalance(ETH, solver1.address))
                .to.equal(PER_QUALIFIER * 2n);
        });

        it("Should handle ERC-20 withdrawal", async function () {
            const tokenAddr = await mockToken.getAddress();
            const perQ = ethers.parseUnits("10", 6);
            const total = perQ * BigInt(MAX_QUALIFIERS);

            await mockToken.connect(creator).approve(await quest.getAddress(), total);
            await quest.connect(creator).createQuest(
                "Token Quest", "Desc", perQ, MAX_QUALIFIERS,
                (await time.latest()) + 86400 * 7, "QmReq", tokenAddr
            );
            await quest.connect(solver1).submitEntry(1, "QmProof");
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");

            const balBefore = await mockToken.balanceOf(solver1.address);
            await quest.connect(solver1).withdrawToken(tokenAddr);
            const balAfter = await mockToken.balanceOf(solver1.address);

            expect(balAfter - balBefore).to.equal(perQ);
        });
    });

    describe("Statistics", function () {
        beforeEach(async function () {
            await createDefaultQuest();
            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
            await quest.connect(solver3).submitEntry(1, "QmProof3");

            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 1, 2, "Bad");
        });

        it("Should provide accurate statistics", async function () {
            const stats = await quest.getQuestStats(1);
            expect(stats.totalEntries).to.equal(3);
            expect(stats.pendingEntries).to.equal(1);
            expect(stats.approvedEntries).to.equal(1);
            expect(stats.rejectedEntries).to.equal(1);
            expect(stats.remainingSlots).to.equal(4);
        });

        it("Should return correct entry count", async function () {
            expect(await quest.getEntryCount(1)).to.equal(3);
        });
    });
});
