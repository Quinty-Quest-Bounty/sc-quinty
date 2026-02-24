import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Quest } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Quest Contract", function () {
    let quest: Quest;
    let owner: SignerWithAddress;
    let creator: SignerWithAddress;
    let solver1: SignerWithAddress;
    let solver2: SignerWithAddress;
    let solver3: SignerWithAddress;
    let other: SignerWithAddress;

    const PER_QUALIFIER = ethers.parseEther("0.1"); // 0.1 ETH per qualifier
    const MAX_QUALIFIERS = 5;
    const TOTAL_ESCROW = PER_QUALIFIER * BigInt(MAX_QUALIFIERS); // 0.5 ETH total

    beforeEach(async function () {
        [owner, creator, solver1, solver2, solver3, other] = await ethers.getSigners();

        const Quest = await ethers.getContractFactory("Quest");
        quest = await Quest.deploy();
        await quest.waitForDeployment();
    });

    describe("Quest Creation", function () {
        it("Should create quest with proper escrow", async function () {
            const deadline = (await time.latest()) + 86400 * 7;
            const requirements = "QmRequirementsCid";

            await expect(
                quest.connect(creator).createQuest(
                    "Twitter Promotion",
                    "Share our post and get rewarded",
                    PER_QUALIFIER,
                    MAX_QUALIFIERS,
                    deadline,
                    requirements,
                    { value: TOTAL_ESCROW }
                )
            ).to.emit(quest, "QuestCreated");

            const questInfo = await quest.getQuest(1);
            expect(questInfo.creator).to.equal(creator.address);
            expect(questInfo.title).to.equal("Twitter Promotion");
            expect(questInfo.totalAmount).to.equal(TOTAL_ESCROW);
            expect(questInfo.perQualifier).to.equal(PER_QUALIFIER);
            expect(questInfo.maxQualifiers).to.equal(MAX_QUALIFIERS);
            expect(questInfo.resolved).to.be.false;
        });

        it("Should reject incorrect escrow amount", async function () {
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc",
                    PER_QUALIFIER,
                    MAX_QUALIFIERS,
                    deadline,
                    "QmReq",
                    { value: ethers.parseEther("0.3") } // Wrong amount
                )
            ).to.be.revertedWith("Must escrow full amount");
        });

        it("Should reject invalid deadline", async function () {
            const pastDeadline = (await time.latest()) - 1;
            await expect(
                quest.connect(creator).createQuest(
                    "Test", "Desc",
                    PER_QUALIFIER,
                    MAX_QUALIFIERS,
                    pastDeadline,
                    "QmReq",
                    { value: TOTAL_ESCROW }
                )
            ).to.be.revertedWith("Invalid deadline");
        });

        it("Should reject empty title", async function () {
            const deadline = (await time.latest()) + 86400;
            await expect(
                quest.connect(creator).createQuest(
                    "", "Desc",
                    PER_QUALIFIER,
                    MAX_QUALIFIERS,
                    deadline,
                    "QmReq",
                    { value: TOTAL_ESCROW }
                )
            ).to.be.revertedWith("Title required");
        });
    });

    describe("Entry Submissions", function () {
        beforeEach(async function () {
            const deadline = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER,
                MAX_QUALIFIERS,
                deadline,
                "QmRequirements",
                { value: TOTAL_ESCROW }
            );
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
    });

    describe("Entry Verification", function () {
        beforeEach(async function () {
            const deadline = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER,
                MAX_QUALIFIERS,
                deadline,
                "QmRequirements",
                { value: TOTAL_ESCROW }
            );

            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
            await quest.connect(solver3).submitEntry(1, "QmProof3");
        });

        it("Should allow creator to approve entry and pay immediately", async function () {
            const solver1BalanceBefore = await ethers.provider.getBalance(solver1.address);

            await expect(
                quest.connect(creator).verifyEntry(1, 0, 1, "Great work!") // 1 = Approved
            ).to.emit(quest, "EntryVerified");

            const solver1BalanceAfter = await ethers.provider.getBalance(solver1.address);
            expect(solver1BalanceAfter - solver1BalanceBefore).to.equal(PER_QUALIFIER);

            const entry = await quest.getEntry(1, 0);
            expect(entry.status).to.equal(1); // Approved
            expect(entry.feedback).to.equal("Great work!");
        });

        it("Should allow creator to reject entry", async function () {
            await expect(
                quest.connect(creator).verifyEntry(1, 0, 2, "Does not meet requirements")
            ).to.emit(quest, "EntryVerified");

            const entry = await quest.getEntry(1, 0);
            expect(entry.status).to.equal(2); // Rejected
        });

        it("Should prevent non-creator from verifying", async function () {
            await expect(
                quest.connect(other).verifyEntry(1, 0, 1, "Approved")
            ).to.be.revertedWith("Not quest creator");
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

            await expect(
                quest.connect(creator).verifyMultipleEntries(1, entryIds, statuses, feedbacks)
            ).to.not.be.reverted;

            const entry0 = await quest.getEntry(1, 0);
            expect(entry0.status).to.equal(1);

            const entry1 = await quest.getEntry(1, 1);
            expect(entry1.status).to.equal(2);

            const entry2 = await quest.getEntry(1, 2);
            expect(entry2.status).to.equal(1);
        });

        it("Should auto-finalize when max qualifiers reached", async function () {
            // Add more entries
            const solver4 = (await ethers.getSigners())[6];
            const solver5 = (await ethers.getSigners())[7];

            await quest.connect(solver4).submitEntry(1, "QmProof4");
            await quest.connect(solver5).submitEntry(1, "QmProof5");

            // Approve exactly MAX_QUALIFIERS entries (5)
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 1, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 2, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 3, 1, "Good");

            // This should trigger auto-finalization
            await expect(
                quest.connect(creator).verifyEntry(1, 4, 1, "Good")
            ).to.emit(quest, "QuestFinalized");

            const questInfo = await quest.getQuest(1);
            expect(questInfo.resolved).to.be.true;
            expect(questInfo.qualifiersCount).to.equal(MAX_QUALIFIERS);
        });
    });

    describe("Quest Finalization", function () {
        beforeEach(async function () {
            const deadline = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER,
                MAX_QUALIFIERS,
                deadline,
                "QmRequirements",
                { value: TOTAL_ESCROW }
            );

            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
        });

        it("Should refund unused amount on finalization", async function () {
            // Approve only 2 entries
            await quest.connect(creator).verifyEntry(1, 0, 1, "Good");
            await quest.connect(creator).verifyEntry(1, 1, 1, "Good");

            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

            const tx = await quest.connect(creator).finalizeQuest(1);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;

            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

            // Should refund 3 * PER_QUALIFIER (unused slots)
            const expectedRefund = PER_QUALIFIER * BigInt(3);
            expect(creatorBalanceAfter + gasCost - creatorBalanceBefore).to.equal(expectedRefund);

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
            const deadline = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Test Quest", "Description",
                PER_QUALIFIER,
                MAX_QUALIFIERS,
                deadline,
                "QmRequirements",
                { value: TOTAL_ESCROW }
            );
        });

        it("Should allow creator to cancel with no approvals", async function () {
            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

            const tx = await quest.connect(creator).cancelQuest(1);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;

            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
            expect(creatorBalanceAfter + gasCost - creatorBalanceBefore).to.equal(TOTAL_ESCROW);

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
    });

    describe("Statistics", function () {
        beforeEach(async function () {
            const deadline = (await time.latest()) + 86400 * 7;
            await quest.connect(creator).createQuest(
                "Stats Quest", "Description",
                PER_QUALIFIER,
                MAX_QUALIFIERS,
                deadline,
                "QmRequirements",
                { value: TOTAL_ESCROW }
            );

            await quest.connect(solver1).submitEntry(1, "QmProof1");
            await quest.connect(solver2).submitEntry(1, "QmProof2");
            await quest.connect(solver3).submitEntry(1, "QmProof3");

            await quest.connect(creator).verifyEntry(1, 0, 1, "Good"); // Approved
            await quest.connect(creator).verifyEntry(1, 1, 2, "Bad");  // Rejected
            // Entry 2 remains pending
        });

        it("Should provide accurate statistics", async function () {
            const stats = await quest.getQuestStats(1);

            expect(stats.totalEntries).to.equal(3);
            expect(stats.pendingEntries).to.equal(1);
            expect(stats.approvedEntries).to.equal(1);
            expect(stats.rejectedEntries).to.equal(1);
            expect(stats.remainingSlots).to.equal(4); // 5 max - 1 approved
        });

        it("Should return correct entry count", async function () {
            expect(await quest.getEntryCount(1)).to.equal(3);
        });
    });
});
