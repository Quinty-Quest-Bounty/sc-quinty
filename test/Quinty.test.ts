import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Quinty, QuintyReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Quinty - Bounty with Phases and Slash", function () {
    let quinty: Quinty;
    let reputation: QuintyReputation;
    let creator: SignerWithAddress;
    let submitter1: SignerWithAddress;
    let submitter2: SignerWithAddress;
    let other: SignerWithAddress;

    const BOUNTY_AMOUNT = ethers.parseEther("1");
    const DEPOSIT_AMOUNT = ethers.parseEther("0.01"); // 1% of 1 ETH
    const SLASH_PERCENT = 3000; // 30%

    beforeEach(async function () {
        [creator, submitter1, submitter2, other] = await ethers.getSigners();

        // Deploy Reputation
        const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
        reputation = await QuintyReputation.deploy("ipfs://base/");

        // Deploy Quinty
        const Quinty = await ethers.getContractFactory("Quinty");
        quinty = await Quinty.deploy();

        // Connect contracts
        await quinty.setReputationAddress(await reputation.getAddress());
        await reputation.transferOwnership(await quinty.getAddress());
    });

    describe("Bounty Creation with Phase Deadlines", function () {
        it("Should create a bounty with open and judging deadlines", async function () {
            const now = await time.latest();
            const openDeadline = now + 86400; // 1 day for submissions
            const judgingDeadline = now + 172800; // 2 days total for judging

            await expect(
                quinty.connect(creator).createBounty(
                    "Build a Dashboard",
                    "Create a React dashboard with charts",
                    openDeadline,
                    judgingDeadline,
                    SLASH_PERCENT,
                    { value: BOUNTY_AMOUNT }
                )
            ).to.emit(quinty, "BountyCreated");

            const bounty = await quinty.getBounty(1);
            expect(bounty.creator).to.equal(creator.address);
            expect(bounty.title).to.equal("Build a Dashboard");
            expect(bounty.amount).to.equal(BOUNTY_AMOUNT);
            expect(bounty.openDeadline).to.equal(openDeadline);
            expect(bounty.judgingDeadline).to.equal(judgingDeadline);
            expect(bounty.slashPercent).to.equal(SLASH_PERCENT);
            expect(bounty.status).to.equal(0); // OPEN
        });

        it("Should fail if judging deadline is before open deadline", async function () {
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc",
                    now + 86400,
                    now + 3600, // Before open deadline
                    SLASH_PERCENT,
                    { value: BOUNTY_AMOUNT }
                )
            ).to.be.revertedWith("Judging deadline must be after open deadline");
        });

        it("Should fail with invalid slash percent", async function () {
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc",
                    now + 86400,
                    now + 172800,
                    1000, // 10% - too low
                    { value: BOUNTY_AMOUNT }
                )
            ).to.be.revertedWith("Slash must be 25-50%");
        });
    });

    describe("Submissions with 1% Deposit", function () {
        let openDeadline: number;
        let judgingDeadline: number;

        beforeEach(async function () {
            const now = await time.latest();
            openDeadline = now + 86400;
            judgingDeadline = now + 172800;
            await quinty.connect(creator).createBounty(
                "Test Bounty", "Description",
                openDeadline, judgingDeadline, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
        });

        it("Should allow submission with 1% deposit and social handle", async function () {
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmTestCid123", "@testuser", { value: DEPOSIT_AMOUNT })
            ).to.emit(quinty, "SubmissionCreated");

            const submission = await quinty.getSubmission(1, 0);
            expect(submission.submitter).to.equal(submitter1.address);
            expect(submission.ipfsCid).to.equal("QmTestCid123");
            expect(submission.socialHandle).to.equal("@testuser");
            expect(submission.deposit).to.equal(DEPOSIT_AMOUNT);
        });

        it("Should fail with incorrect deposit amount", async function () {
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid", "@user", { value: ethers.parseEther("0.005") })
            ).to.be.revertedWith("Incorrect deposit amount (1% required)");
        });

        it("Should fail after open deadline", async function () {
            await time.increase(86401);
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid", "@user", { value: DEPOSIT_AMOUNT })
            ).to.be.revertedWith("Submission deadline passed");
        });

        it("Should store social account on-chain", async function () {
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", "@myhandle", { value: DEPOSIT_AMOUNT });
            
            const account = await quinty.getSocialAccount(submitter1.address);
            expect(account.xHandle).to.equal("@myhandle");
        });

        it("Should calculate required deposit correctly", async function () {
            const requiredDeposit = await quinty.getRequiredDeposit(1);
            expect(requiredDeposit).to.equal(DEPOSIT_AMOUNT);
        });
    });

    describe("Phase Transitions", function () {
        let openDeadline: number;
        let judgingDeadline: number;

        beforeEach(async function () {
            const now = await time.latest();
            openDeadline = now + 86400;
            judgingDeadline = now + 172800;
            await quinty.connect(creator).createBounty(
                "Test", "Desc", openDeadline, judgingDeadline, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", "@user1", { value: DEPOSIT_AMOUNT });
        });

        it("Should return correct current phase", async function () {
            expect(await quinty.getCurrentPhase(1)).to.equal("OPEN");

            await time.increase(86401);
            expect(await quinty.getCurrentPhase(1)).to.equal("JUDGING");

            await time.increase(86401);
            expect(await quinty.getCurrentPhase(1)).to.equal("SLASH_PENDING");
        });

        it("Should move to judging phase after open deadline", async function () {
            await time.increase(86401);
            await quinty.moveToJudging(1);

            const bounty = await quinty.getBounty(1);
            expect(bounty.status).to.equal(1); // JUDGING
        });
    });

    describe("Winner Selection", function () {
        let openDeadline: number;
        let judgingDeadline: number;

        beforeEach(async function () {
            const now = await time.latest();
            openDeadline = now + 86400;
            judgingDeadline = now + 172800;
            await quinty.connect(creator).createBounty(
                "Test", "Desc", openDeadline, judgingDeadline, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", "@user1", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter2).submitToBounty(1, "QmCid2", "@user2", { value: DEPOSIT_AMOUNT });
        });

        it("Should allow creator to select winner during judging phase", async function () {
            await time.increase(86401); // Move to judging

            const submitter1Before = await ethers.provider.getBalance(submitter1.address);
            const submitter2Before = await ethers.provider.getBalance(submitter2.address);

            await quinty.connect(creator).selectWinner(1, 0);

            const submitter1After = await ethers.provider.getBalance(submitter1.address);
            const submitter2After = await ethers.provider.getBalance(submitter2.address);

            // Winner gets escrow + their deposit back
            expect(submitter1After - submitter1Before).to.equal(BOUNTY_AMOUNT + DEPOSIT_AMOUNT);
            // Non-winner gets deposit refund
            expect(submitter2After - submitter2Before).to.equal(DEPOSIT_AMOUNT);

            const bounty = await quinty.getBounty(1);
            expect(bounty.status).to.equal(2); // RESOLVED
            expect(bounty.selectedWinner).to.equal(submitter1.address);
        });

        it("Should fail to select winner after judging deadline", async function () {
            await time.increase(172801); // Past judging deadline

            await expect(
                quinty.connect(creator).selectWinner(1, 0)
            ).to.be.revertedWith("Judging deadline passed - call triggerSlash");
        });
    });

    describe("Slash Mechanism", function () {
        let openDeadline: number;
        let judgingDeadline: number;

        beforeEach(async function () {
            const now = await time.latest();
            openDeadline = now + 86400;
            judgingDeadline = now + 172800;
            await quinty.connect(creator).createBounty(
                "Test", "Desc", openDeadline, judgingDeadline, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", "@user1", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter2).submitToBounty(1, "QmCid2", "@user2", { value: DEPOSIT_AMOUNT });
        });

        it("Should slash creator and distribute to submitters after judging deadline", async function () {
            await time.increase(172801); // Past judging deadline

            const submitter1Before = await ethers.provider.getBalance(submitter1.address);
            const submitter2Before = await ethers.provider.getBalance(submitter2.address);
            const creatorBefore = await ethers.provider.getBalance(creator.address);

            await quinty.connect(other).triggerSlash(1);

            const submitter1After = await ethers.provider.getBalance(submitter1.address);
            const submitter2After = await ethers.provider.getBalance(submitter2.address);
            const creatorAfter = await ethers.provider.getBalance(creator.address);

            // Slash amount = 30% of 1 ETH = 0.3 ETH
            const slashAmount = ethers.parseEther("0.3");
            const slashPerSubmitter = slashAmount / 2n;

            // Each submitter gets: slash share + their deposit
            expect(submitter1After - submitter1Before).to.equal(slashPerSubmitter + DEPOSIT_AMOUNT);
            expect(submitter2After - submitter2Before).to.equal(slashPerSubmitter + DEPOSIT_AMOUNT);

            // Creator gets refund (70% of bounty)
            expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.7"));

            const bounty = await quinty.getBounty(1);
            expect(bounty.status).to.equal(3); // SLASHED
        });

        it("Should fail to slash before judging deadline", async function () {
            await time.increase(86401); // Only past open deadline

            await expect(
                quinty.connect(other).triggerSlash(1)
            ).to.be.revertedWith("Judging deadline not passed");
        });
    });

    describe("No Submissions Refund", function () {
        it("Should refund creator if no submissions after deadline", async function () {
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );

            await time.increase(86401); // Past open deadline

            const creatorBefore = await ethers.provider.getBalance(creator.address);
            const tx = await quinty.connect(creator).refundNoSubmissions(1);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const creatorAfter = await ethers.provider.getBalance(creator.address);

            expect(creatorAfter + gasCost - creatorBefore).to.equal(BOUNTY_AMOUNT);
        });

        it("Should fail if there are submissions", async function () {
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", "@user", { value: DEPOSIT_AMOUNT });

            await time.increase(86401);

            await expect(
                quinty.connect(creator).refundNoSubmissions(1)
            ).to.be.revertedWith("Has submissions - use triggerSlash or selectWinner");
        });
    });

    describe("Social Account Linking", function () {
        it("Should allow users to link social accounts", async function () {
            await expect(
                quinty.connect(submitter1).linkSocialAccount("@mytwitter", "test@email.com")
            ).to.emit(quinty, "SocialAccountLinked");

            const account = await quinty.getSocialAccount(submitter1.address);
            expect(account.xHandle).to.equal("@mytwitter");
            expect(account.email).to.equal("test@email.com");
        });
    });

    describe("Reputation Updates", function () {
        it("Should update reputation on bounty creation", async function () {
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );

            const rep = await reputation.getUserStats(creator.address);
            expect(rep.totalBountiesCreated).to.equal(1);
        });

        it("Should update reputation on submission", async function () {
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", "@user", { value: DEPOSIT_AMOUNT });

            const rep = await reputation.getUserStats(submitter1.address);
            expect(rep.totalSubmissions).to.equal(1);
        });

        it("Should update reputation on win", async function () {
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", "@user", { value: DEPOSIT_AMOUNT });
            
            await time.increase(86401);
            await quinty.connect(creator).selectWinner(1, 0);

            const rep = await reputation.getUserStats(submitter1.address);
            expect(rep.totalWins).to.equal(1);
        });
    });
});
