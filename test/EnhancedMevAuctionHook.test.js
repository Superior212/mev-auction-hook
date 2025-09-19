const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Enhanced MevAuctionHook", function () {
    // Deploy fixture
    async function deployEnhancedMevAuctionHookFixture() {
        const [owner, searcher1, searcher2, swapper, lp] = await ethers.getSigners();

        // Deploy Enhanced MevAuctionHook
        const MevAuctionHook = await ethers.getContractFactory("MevAuctionHook");
        const mevAuctionHook = await MevAuctionHook.deploy();

        // Deploy mock ERC20 tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const token0 = await MockERC20.deploy("Token0", "T0");
        const token1 = await MockERC20.deploy("Token1", "T1");

        return {
            mevAuctionHook,
            token0,
            token1,
            owner,
            searcher1,
            searcher2,
            swapper,
            lp,
        };
    }

    describe("Enhanced Auction System", function () {
        it("Should deploy with correct initial state", async function () {
            const { mevAuctionHook } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            expect(await mevAuctionHook.nextAuctionId()).to.equal(1);
            expect(await mevAuctionHook.MIN_PRICE_IMPACT_BPS()).to.equal(50);
            expect(await mevAuctionHook.MAX_AUCTION_DURATION()).to.equal(1);
            expect(await mevAuctionHook.SWAPPER_REBATE_BPS()).to.equal(5000);
            expect(await mevAuctionHook.LP_REWARD_BPS()).to.equal(5000);
        });

        it("Should start enhanced auction with different types", async function () {
            const { mevAuctionHook, token0, token1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Create a mock pool key
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address
            };

            const expectedArbitrage = ethers.parseEther("1.0");

            // Test PUBLIC auction
            await expect(
                mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 0) // 0 = PUBLIC
            ).to.emit(mevAuctionHook, "EnhancedAuctionStarted");

            // Test PRIVATE auction
            await expect(
                mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 1) // 1 = PRIVATE
            ).to.emit(mevAuctionHook, "EnhancedAuctionStarted");

            // Test EIGENLAYER_PROTECTED auction
            await expect(
                mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 2) // 2 = EIGENLAYER_PROTECTED
            ).to.emit(mevAuctionHook, "EnhancedAuctionStarted");
        });

        it("Should register EigenLayer stakers", async function () {
            const { mevAuctionHook, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Initially not a staker
            expect(await mevAuctionHook.isEigenLayerStaker(searcher1.address)).to.be.false;

            // Register as staker
            await mevAuctionHook.registerEigenLayerStaker(searcher1.address);

            // Now should be a staker
            expect(await mevAuctionHook.isEigenLayerStaker(searcher1.address)).to.be.true;
        });

        it("Should allow EigenLayer-protected bidding", async function () {
            const { mevAuctionHook, token0, token1, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Register searcher as EigenLayer staker
            await mevAuctionHook.registerEigenLayerStaker(searcher1.address);

            // Create a mock pool key
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address
            };

            const expectedArbitrage = ethers.parseEther("1.0");

            // Start EigenLayer-protected auction
            await mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 2); // 2 = EIGENLAYER_PROTECTED

            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Bid should succeed
            await expect(
                mevAuctionHook.connect(searcher1).eigenLayerBid(auctionId, { value: bidAmount })
            ).to.emit(mevAuctionHook, "BidSubmitted");
        });

        it("Should reject EigenLayer bids from non-stakers", async function () {
            const { mevAuctionHook, token0, token1, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Don't register searcher as EigenLayer staker

            // Create a mock pool key
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address
            };

            const expectedArbitrage = ethers.parseEther("1.0");

            // Start EigenLayer-protected auction
            await mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 2); // 2 = EIGENLAYER_PROTECTED

            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Bid should fail
            await expect(
                mevAuctionHook.connect(searcher1).eigenLayerBid(auctionId, { value: bidAmount })
            ).to.be.revertedWith("No EigenLayer stake");
        });

        it("Should allow private bidding", async function () {
            const { mevAuctionHook, token0, token1, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Create a mock pool key
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address
            };

            const expectedArbitrage = ethers.parseEther("1.0");

            // Start private auction
            await mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 1); // 1 = PRIVATE

            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Private bid should succeed
            await expect(
                mevAuctionHook.connect(searcher1).privateBid(auctionId, bidAmount)
            ).to.emit(mevAuctionHook, "PrivateBidSubmitted");
        });

        it("Should allow slashing EigenLayer stakers", async function () {
            const { mevAuctionHook, token0, token1, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Register searcher as EigenLayer staker
            await mevAuctionHook.registerEigenLayerStaker(searcher1.address);

            // Create a mock pool key
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address
            };

            const expectedArbitrage = ethers.parseEther("1.0");

            // Start EigenLayer-protected auction
            await mevAuctionHook.startEnhancedAuction(poolKey, expectedArbitrage, 2); // 2 = EIGENLAYER_PROTECTED

            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Bid to become winner
            await mevAuctionHook.connect(searcher1).eigenLayerBid(auctionId, { value: bidAmount });

            // Slash the winner
            await expect(
                mevAuctionHook.slashEigenLayerStaker(auctionId, searcher1.address)
            ).to.emit(mevAuctionHook, "EigenLayerSlashing");
        });
    });
});
