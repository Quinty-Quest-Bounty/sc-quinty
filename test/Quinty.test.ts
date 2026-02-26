import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Quinty, QuintyReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Quinty V3 - Multi-Winner Bounty with ERC-20 + Security", function () {
    let quinty: Quinty;
    let reputation: QuintyReputation;
    let mockToken: any; // ERC20 mock
    let owner: SignerWithAddress;
    let creator: SignerWithAddress;
    let submitter1: SignerWithAddress;
    let submitter2: SignerWithAddress;
    let submitter3: SignerWithAddress;
    let other: SignerWithAddress;

    const BOUNTY_AMOUNT = ethers.parseEther("1");
    const DEPOSIT_AMOUNT = ethers.parseEther("0.01"); // 1% of 1 ETH
    const SLASH_PERCENT = 3000; // 30%
    const PRIZES_1 = [ethers.parseEther("1")]; // single winner
    const PRIZES_3 = [ethers.parseEther("0.5"), ethers.parseEther("0.3"), ethers.parseEther("0.2")]; // 3 winners
    const ETH = ethers.ZeroAddress;

    // Helper to create a default bounty
    async function createDefaultBounty(prizes = PRIZES_1, token = ETH) {
        const now = await time.latest();
        const openDeadline = now + 86400;
        const judgingDeadline = now + 172800;
        const total = prizes.reduce((a, b) => a + b, 0n);

        if (token === ETH) {
            await quinty.connect(creator).createBounty(
                "Test Bounty", "Description",
                openDeadline, judgingDeadline, SLASH_PERCENT,
                prizes, token,
                { value: total }
            );
        } else {
            await mockToken.connect(creator).approve(await quinty.getAddress(), total);
            await quinty.connect(creator).createBounty(
                "Test Bounty", "Description",
                openDeadline, judgingDeadline, SLASH_PERCENT,
                prizes, token
            );
        }
        return { openDeadline, judgingDeadline, total };
    }

    beforeEach(async function () {
        [owner, creator, submitter1, submitter2, submitter3, other] = await ethers.getSigners();

        // Deploy mock ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Mock USDC", "MUSDC", 6);
        await mockToken.waitForDeployment();

        // Mint tokens to creator and submitters
        const mintAmount = ethers.parseUnits("10000", 6);
        await mockToken.mint(creator.address, mintAmount);
        await mockToken.mint(submitter1.address, mintAmount);
        await mockToken.mint(submitter2.address, mintAmount);
        await mockToken.mint(submitter3.address, mintAmount);

        // Deploy Reputation
        const QuintyReputation = await ethers.getContractFactory("QuintyReputation");
        reputation = await QuintyReputation.deploy("ipfs://base/");

        // Deploy Quinty
        const Quinty = await ethers.getContractFactory("Quinty");
        quinty = await Quinty.deploy();

        // Connect contracts
        await quinty.setReputationAddress(await reputation.getAddress());
        await reputation.authorizeCaller(await quinty.getAddress());

        // Whitelist mock token
        await quinty.allowToken(await mockToken.getAddress());
    });

    describe("Bounty Creation (ETH)", function () {
        it("Should create a single-prize bounty", async function () {
            await createDefaultBounty();

            const bounty = await quinty.getBounty(1);
            expect(bounty.creator).to.equal(creator.address);
            expect(bounty.title).to.equal("Test Bounty");
            expect(bounty.totalAmount).to.equal(BOUNTY_AMOUNT);
            expect(bounty.prizes.length).to.equal(1);
            expect(bounty.prizes[0]).to.equal(BOUNTY_AMOUNT);
            expect(bounty.token).to.equal(ETH);
            expect(bounty.status).to.equal(0); // OPEN
        });

        it("Should create a multi-prize bounty", async function () {
            await createDefaultBounty(PRIZES_3);

            const bounty = await quinty.getBounty(1);
            expect(bounty.prizes.length).to.equal(3);
            expect(bounty.totalAmount).to.equal(BOUNTY_AMOUNT);
        });

        it("Should reject empty prizes", async function () {
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    [], ETH, { value: 0 }
                )
            ).to.be.revertedWith("No prizes");
        });

        it("Should reject more than 10 prizes", async function () {
            const now = await time.latest();
            const prizes = Array(11).fill(ethers.parseEther("0.1"));
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    prizes, ETH, { value: ethers.parseEther("1.1") }
                )
            ).to.be.revertedWith("Max 10 winners");
        });

        it("Should reject incorrect ETH amount", async function () {
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    PRIZES_1, ETH, { value: ethers.parseEther("0.5") }
                )
            ).to.be.revertedWith("ETH amount mismatch");
        });

        it("Should reject invalid slash percent", async function () {
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, 1000,
                    PRIZES_1, ETH, { value: BOUNTY_AMOUNT }
                )
            ).to.be.revertedWith("Slash 25-50%");
        });
    });

    describe("Bounty Creation (ERC-20)", function () {
        it("Should create bounty with ERC-20 token", async function () {
            const tokenAddr = await mockToken.getAddress();
            const prizes = [ethers.parseUnits("100", 6)];

            await createDefaultBounty(prizes, tokenAddr);

            const bounty = await quinty.getBounty(1);
            expect(bounty.token).to.equal(tokenAddr);
            expect(bounty.totalAmount).to.equal(prizes[0]);
        });

        it("Should reject non-whitelisted token", async function () {
            const now = await time.latest();
            const fakeToken = submitter1.address; // Not a real token but tests the modifier
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    [100n], fakeToken
                )
            ).to.be.revertedWith("Token not allowed");
        });

        it("Should reject ETH sent with token bounty", async function () {
            const now = await time.latest();
            const tokenAddr = await mockToken.getAddress();
            await mockToken.connect(creator).approve(await quinty.getAddress(), 100n);
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    [100n], tokenAddr, { value: 1 }
                )
            ).to.be.revertedWith("Do not send ETH for token bounty");
        });
    });

    describe("Submissions", function () {
        beforeEach(async function () {
            await createDefaultBounty();
        });

        it("Should accept submission with 1% deposit", async function () {
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            const sub = await quinty.getSubmission(1, 0);
            expect(sub.submitter).to.equal(submitter1.address);
            expect(sub.deposit).to.equal(DEPOSIT_AMOUNT);
        });

        it("Should reject incorrect deposit", async function () {
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: ethers.parseEther("0.005") })
            ).to.be.revertedWith("Incorrect deposit");
        });

        it("Should reject duplicate submissions", async function () {
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid2", { value: DEPOSIT_AMOUNT })
            ).to.be.revertedWith("Already submitted");
        });

        it("Should reject submission after open deadline", async function () {
            await time.increase(86401);
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT })
            ).to.be.revertedWith("Submissions closed");
        });
    });

    describe("Winner Selection (Single)", function () {
        beforeEach(async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter2).submitToBounty(1, "QmCid2", { value: DEPOSIT_AMOUNT });
        });

        it("Should select winner and credit funds via pull", async function () {
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0]);

            // Winner gets prize + deposit
            const pending1 = await quinty.pendingBalance(ETH, submitter1.address);
            expect(pending1).to.equal(BOUNTY_AMOUNT + DEPOSIT_AMOUNT);

            // Non-winner gets deposit refund
            const pending2 = await quinty.pendingBalance(ETH, submitter2.address);
            expect(pending2).to.equal(DEPOSIT_AMOUNT);

            const bounty = await quinty.getBounty(1);
            expect(bounty.status).to.equal(2); // RESOLVED
        });

        it("Should allow withdrawal after winning", async function () {
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0]);

            const balBefore = await ethers.provider.getBalance(submitter1.address);
            const tx = await quinty.connect(submitter1).withdrawETH();
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(submitter1.address);

            expect(balAfter + gasCost - balBefore).to.equal(BOUNTY_AMOUNT + DEPOSIT_AMOUNT);
        });
    });

    describe("Winner Selection (Multi-Winner)", function () {
        beforeEach(async function () {
            await createDefaultBounty(PRIZES_3);
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter2).submitToBounty(1, "QmCid2", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter3).submitToBounty(1, "QmCid3", { value: DEPOSIT_AMOUNT });
        });

        it("Should distribute prizes to 3 winners correctly", async function () {
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0, 1, 2]);

            // Rank 1: 0.5 ETH + deposit
            expect(await quinty.pendingBalance(ETH, submitter1.address))
                .to.equal(PRIZES_3[0] + DEPOSIT_AMOUNT);
            // Rank 2: 0.3 ETH + deposit
            expect(await quinty.pendingBalance(ETH, submitter2.address))
                .to.equal(PRIZES_3[1] + DEPOSIT_AMOUNT);
            // Rank 3: 0.2 ETH + deposit
            expect(await quinty.pendingBalance(ETH, submitter3.address))
                .to.equal(PRIZES_3[2] + DEPOSIT_AMOUNT);
        });

        it("Should refund unused prizes when fewer winners selected", async function () {
            await time.increase(86401);
            // Only 2 winners for 3-prize bounty
            await quinty.connect(creator).selectWinners(1, [0, 1]);

            // Winner 1: 0.5 ETH + deposit
            expect(await quinty.pendingBalance(ETH, submitter1.address))
                .to.equal(PRIZES_3[0] + DEPOSIT_AMOUNT);
            // Winner 2: 0.3 ETH + deposit
            expect(await quinty.pendingBalance(ETH, submitter2.address))
                .to.equal(PRIZES_3[1] + DEPOSIT_AMOUNT);
            // Non-winner: deposit refund
            expect(await quinty.pendingBalance(ETH, submitter3.address))
                .to.equal(DEPOSIT_AMOUNT);
            // Creator: unused prize (0.2 ETH)
            expect(await quinty.pendingBalance(ETH, creator.address))
                .to.equal(PRIZES_3[2]);
        });

        it("Should reject duplicate winner IDs", async function () {
            await time.increase(86401);
            await expect(
                quinty.connect(creator).selectWinners(1, [0, 0])
            ).to.be.revertedWith("Duplicate winner");
        });

        it("Should reject too many winners", async function () {
            await time.increase(86401);
            await expect(
                quinty.connect(creator).selectWinners(1, [0, 1, 2, 0]) // 4 > 3 prizes
            ).to.be.revertedWith("Too many winners");
        });

        it("Should reject empty winners", async function () {
            await time.increase(86401);
            await expect(
                quinty.connect(creator).selectWinners(1, [])
            ).to.be.revertedWith("No winners");
        });
    });

    describe("Slash Mechanism", function () {
        beforeEach(async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await quinty.connect(submitter2).submitToBounty(1, "QmCid2", { value: DEPOSIT_AMOUNT });
        });

        it("Should slash and credit submitters via pull", async function () {
            await time.increase(172801);
            await quinty.connect(other).triggerSlash(1);

            const slashAmount = BOUNTY_AMOUNT * 3000n / 10000n; // 0.3 ETH
            const slashPer = slashAmount / 2n;
            const remainder = slashAmount - (slashPer * 2n);

            expect(await quinty.pendingBalance(ETH, submitter1.address))
                .to.equal(slashPer + DEPOSIT_AMOUNT);
            // Last submitter gets dust remainder
            expect(await quinty.pendingBalance(ETH, submitter2.address))
                .to.equal(slashPer + DEPOSIT_AMOUNT + remainder);

            // Creator gets refund
            expect(await quinty.pendingBalance(ETH, creator.address))
                .to.equal(BOUNTY_AMOUNT - slashAmount);

            expect((await quinty.getBounty(1)).status).to.equal(3); // SLASHED
        });

        it("Should handle slash with single submitter", async function () {
            // Create a new bounty with just 1 submitter
            const now = await time.latest();
            await quinty.connect(creator).createBounty(
                "Solo", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                PRIZES_1, ETH, { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter3).submitToBounty(2, "QmCid", { value: DEPOSIT_AMOUNT });

            await time.increase(172801);
            await quinty.connect(other).triggerSlash(2);

            const slashAmount = BOUNTY_AMOUNT * 3000n / 10000n;
            expect(await quinty.pendingBalance(ETH, submitter3.address))
                .to.equal(slashAmount + DEPOSIT_AMOUNT);
        });
    });

    describe("No Submissions Refund", function () {
        it("Should refund creator via pull", async function () {
            await createDefaultBounty();
            await time.increase(86401);

            await quinty.connect(creator).refundNoSubmissions(1);

            expect(await quinty.pendingBalance(ETH, creator.address))
                .to.equal(BOUNTY_AMOUNT);
        });
    });

    describe("Pausable", function () {
        it("Should prevent creation when paused", async function () {
            await quinty.pause();
            const now = await time.latest();
            await expect(
                quinty.connect(creator).createBounty(
                    "Test", "Desc", now + 86400, now + 172800, SLASH_PERCENT,
                    PRIZES_1, ETH, { value: BOUNTY_AMOUNT }
                )
            ).to.be.revertedWithCustomError(quinty, "EnforcedPause");
        });

        it("Should prevent submissions when paused", async function () {
            await createDefaultBounty();
            await quinty.pause();
            await expect(
                quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT })
            ).to.be.revertedWithCustomError(quinty, "EnforcedPause");
        });

        it("Should allow withdrawals during pause", async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0]);

            await quinty.pause();

            // Withdrawal should work during pause
            await expect(
                quinty.connect(submitter1).withdrawETH()
            ).to.not.be.reverted;
        });

        it("Should allow refundNoSubmissions during pause", async function () {
            await createDefaultBounty();
            await time.increase(86401);
            await quinty.pause();

            await expect(
                quinty.connect(creator).refundNoSubmissions(1)
            ).to.not.be.reverted;
        });

        it("Should reject non-owner pause", async function () {
            await expect(
                quinty.connect(other).pause()
            ).to.be.revertedWithCustomError(quinty, "OwnableUnauthorizedAccount");
        });
    });

    describe("Token Whitelist", function () {
        it("Should allow/revoke tokens by owner", async function () {
            const tokenAddr = await mockToken.getAddress();
            expect(await quinty.allowedTokens(tokenAddr)).to.be.true;

            await quinty.revokeToken(tokenAddr);
            expect(await quinty.allowedTokens(tokenAddr)).to.be.false;
        });

        it("Should reject non-owner token management", async function () {
            await expect(
                quinty.connect(other).allowToken(submitter1.address)
            ).to.be.revertedWithCustomError(quinty, "OwnableUnauthorizedAccount");
        });
    });

    describe("Rescue ERC20", function () {
        it("Should rescue accidentally sent tokens", async function () {
            const tokenAddr = await mockToken.getAddress();
            // Send tokens directly to contract (accident)
            await mockToken.connect(creator).transfer(await quinty.getAddress(), 1000n);

            await quinty.rescueERC20(tokenAddr, 1000n);
            expect(await mockToken.balanceOf(owner.address)).to.equal(1000n);
        });

        it("Should not drain active escrow", async function () {
            const tokenAddr = await mockToken.getAddress();
            const prizes = [ethers.parseUnits("100", 6)];
            await createDefaultBounty(prizes, tokenAddr);

            // Try to rescue escrowed tokens
            await expect(
                quinty.rescueERC20(tokenAddr, ethers.parseUnits("100", 6))
            ).to.be.revertedWith("Cannot drain escrow");
        });
    });

    describe("Withdrawal Edge Cases", function () {
        it("Should reject withdrawal with zero balance", async function () {
            await expect(
                quinty.connect(other).withdrawETH()
            ).to.be.revertedWith("Nothing to withdraw");
        });

        it("Should accumulate multiple credits", async function () {
            // Win two bounties
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0]);

            const now2 = await time.latest();
            await quinty.connect(creator).createBounty(
                "Bounty 2", "Desc", now2 + 86400, now2 + 172800, SLASH_PERCENT,
                PRIZES_1, ETH, { value: BOUNTY_AMOUNT }
            );
            await quinty.connect(submitter1).submitToBounty(2, "QmCid2", { value: DEPOSIT_AMOUNT });
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(2, [0]);

            // Should have cumulative balance
            expect(await quinty.pendingBalance(ETH, submitter1.address))
                .to.equal((BOUNTY_AMOUNT + DEPOSIT_AMOUNT) * 2n);
        });
    });

    describe("Reputation Integration", function () {
        it("Should record bounty creation", async function () {
            await createDefaultBounty();
            const stats = await reputation.getUserStats(creator.address);
            expect(stats.totalBountiesCreated).to.equal(1);
        });

        it("Should record submission", async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", { value: DEPOSIT_AMOUNT });
            const stats = await reputation.getUserStats(submitter1.address);
            expect(stats.totalSubmissions).to.equal(1);
        });

        it("Should record win", async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid", { value: DEPOSIT_AMOUNT });
            await time.increase(86401);
            await quinty.connect(creator).selectWinners(1, [0]);
            const stats = await reputation.getUserStats(submitter1.address);
            expect(stats.totalWins).to.equal(1);
        });
    });

    describe("Phase Transitions", function () {
        it("Should return correct phases", async function () {
            await createDefaultBounty();
            await quinty.connect(submitter1).submitToBounty(1, "QmCid1", { value: DEPOSIT_AMOUNT });

            expect(await quinty.getCurrentPhase(1)).to.equal("OPEN");
            await time.increase(86401);
            expect(await quinty.getCurrentPhase(1)).to.equal("JUDGING");
            await time.increase(86401);
            expect(await quinty.getCurrentPhase(1)).to.equal("SLASH_PENDING");
        });
    });
});
