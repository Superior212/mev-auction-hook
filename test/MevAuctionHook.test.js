const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MevAuctionHook", function () {
    // Deploy fixture
    async function deployMevAuctionHookFixture() {
        const [owner, searcher1, searcher2, swapper, lp] = await ethers.getSigners();

        // Deploy MevAuctionHook (no longer needs PoolManager in constructor)
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

    describe("Deployment", function () {
        it("Should deploy with correct initial state", async function () {
            const { mevAuctionHook } = await loadFixture(deployMevAuctionHookFixture);

            expect(await mevAuctionHook.nextAuctionId()).to.equal(1);
            expect(await mevAuctionHook.MIN_PRICE_IMPACT_BPS()).to.equal(50);
            expect(await mevAuctionHook.MAX_AUCTION_DURATION()).to.equal(1);
            expect(await mevAuctionHook.SWAPPER_REBATE_BPS()).to.equal(5000);
            expect(await mevAuctionHook.LP_REWARD_BPS()).to.equal(5000);
        });

        it("Should have correct hook permissions", async function () {
            const { mevAuctionHook } = await loadFixture(deployMevAuctionHookFixture);

            const permissions = await mevAuctionHook.getHookPermissions();
            expect(permissions.beforeSwap).to.be.true;
            expect(permissions.afterSwap).to.be.true;
            expect(permissions.beforeAddLiquidity).to.be.false;
            expect(permissions.afterAddLiquidity).to.be.false;
            expect(permissions.beforeRemoveLiquidity).to.be.false;
            expect(permissions.afterRemoveLiquidity).to.be.false;
            expect(permissions.beforeDonate).to.be.false;
            expect(permissions.afterDonate).to.be.false;
        });
    });

    describe("Auction System", function () {
        it("Should start auction for large swaps", async function () {
            const { mevAuctionHook, poolManager, token0, token1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            // Create a large swap that should trigger an auction
            const largeAmount = ethers.parseEther("1000");

            // Mock the beforeSwap call
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address,
            };

            const swapParams = {
                zeroForOne: true,
                amountSpecified: largeAmount,
                sqrtPriceLimitX96: 0,
            };

            // This would normally be called by the PoolManager
            // For testing, we'll simulate the auction creation logic
            await expect(
                mevAuctionHook.beforeSwap(
                    ethers.ZeroAddress,
                    poolKey,
                    swapParams,
                    "0x"
                )
            ).to.emit(mevAuctionHook, "AuctionStarted");
        });

        it("Should allow searchers to bid on auctions", async function () {
            const { mevAuctionHook, searcher1, searcher2 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            // Start an auction (this would normally happen in beforeSwap)
            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Submit first bid
            await expect(
                mevAuctionHook.connect(searcher1).bid(auctionId, { value: bidAmount })
            ).to.emit(mevAuctionHook, "BidSubmitted")
                .withArgs(auctionId, searcher1.address, bidAmount);

            // Submit higher bid
            const higherBid = ethers.parseEther("0.2");
            await expect(
                mevAuctionHook.connect(searcher2).bid(auctionId, { value: higherBid })
            ).to.emit(mevAuctionHook, "BidSubmitted")
                .withArgs(auctionId, searcher2.address, higherBid);

            // Check auction state
            const auction = await mevAuctionHook.getAuction(auctionId);
            expect(auction.highestBid).to.equal(higherBid);
            expect(auction.highestBidder).to.equal(searcher2.address);
        });

        it("Should reject bids below minimum", async function () {
            const { mevAuctionHook, searcher1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            const auctionId = 1;
            const lowBid = ethers.parseEther("0.001");

            await expect(
                mevAuctionHook.connect(searcher1).bid(auctionId, { value: lowBid })
            ).to.be.revertedWith("Bid too low");
        });

        it("Should refund previous highest bidder", async function () {
            const { mevAuctionHook, searcher1, searcher2 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            const auctionId = 1;
            const firstBid = ethers.parseEther("0.1");
            const secondBid = ethers.parseEther("0.2");

            // Get initial balance
            const initialBalance = await searcher1.getBalance();

            // Submit first bid
            await mevAuctionHook.connect(searcher1).bid(auctionId, { value: firstBid });

            // Submit higher bid (should refund first bidder)
            await mevAuctionHook.connect(searcher2).bid(auctionId, { value: secondBid });

            // Check that first bidder was refunded
            const finalBalance = await searcher1.getBalance();
            expect(finalBalance).to.be.closeTo(initialBalance, ethers.parseEther("0.01"));
        });

        it("Should not allow bidding on expired auctions", async function () {
            const { mevAuctionHook, searcher1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            const auctionId = 1;
            const bidAmount = ethers.parseEther("0.1");

            // Mine blocks to expire the auction
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);

            await expect(
                mevAuctionHook.connect(searcher1).bid(auctionId, { value: bidAmount })
            ).to.be.revertedWith("Auction expired");
        });
    });

    describe("Value Redistribution", function () {
        it("Should redistribute value after auction settlement", async function () {
            const { mevAuctionHook, poolManager, token0, token1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            // This test would verify that after an auction is settled,
            // the captured value is properly redistributed according to the configured ratios

            // The actual implementation would depend on the specific redistribution mechanism
            // For now, we'll test that the event is emitted correctly

            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address,
            };

            // Simulate afterSwap call
            await expect(
                mevAuctionHook.afterSwap(
                    ethers.ZeroAddress,
                    poolKey,
                    { zeroForOne: true, amountSpecified: 0, sqrtPriceLimitX96: 0 },
                    { amount0Delta: 0, amount1Delta: 0 },
                    "0x"
                )
            ).to.emit(mevAuctionHook, "ValueRedistributed");
        });
    });

    describe("Access Control", function () {
        it("Should allow only owner to emergency withdraw", async function () {
            const { mevAuctionHook, owner, searcher1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            // Send some ETH to the contract
            await searcher1.sendTransaction({
                to: mevAuctionHook.address,
                value: ethers.parseEther("1"),
            });

            // Non-owner should not be able to withdraw
            await expect(
                mevAuctionHook.connect(searcher1).emergencyWithdraw()
            ).to.be.revertedWith("Ownable: caller is not the owner");

            // Owner should be able to withdraw
            const initialBalance = await owner.getBalance();
            await mevAuctionHook.connect(owner).emergencyWithdraw();
            const finalBalance = await owner.getBalance();

            expect(finalBalance).to.be.greaterThan(initialBalance);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle auctions with no bids", async function () {
            const { mevAuctionHook, poolManager, token0, token1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            // Start an auction but don't submit any bids
            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address,
            };

            // Simulate afterSwap with no bids
            await mevAuctionHook.afterSwap(
                ethers.ZeroAddress,
                poolKey,
                { zeroForOne: true, amountSpecified: 0, sqrtPriceLimitX96: 0 },
                { amount0Delta: 0, amount1Delta: 0 },
                "0x"
            );

            // Should not emit AuctionWon event
            // The auction should be marked as settled but with no winner
        });

        it("Should not start multiple auctions for the same pool", async function () {
            const { mevAuctionHook, poolManager, token0, token1 } = await loadFixture(
                deployMevAuctionHookFixture
            );

            const poolKey = {
                currency0: token0.address,
                currency1: token1.address,
                fee: 3000,
                tickSpacing: 60,
                hooks: mevAuctionHook.address,
            };

            const largeAmount = ethers.parseEther("1000");
            const swapParams = {
                zeroForOne: true,
                amountSpecified: largeAmount,
                sqrtPriceLimitX96: 0,
            };

            // First swap should start an auction
            await mevAuctionHook.beforeSwap(
                ethers.ZeroAddress,
                poolKey,
                swapParams,
                "0x"
            );

            // Second swap should not start another auction
            await mevAuctionHook.beforeSwap(
                ethers.ZeroAddress,
                poolKey,
                swapParams,
                "0x"
            );

            // Should only have one active auction
            const activeAuction = await mevAuctionHook.getActiveAuction(poolKey.toId());
            expect(activeAuction).to.equal(1);
        });
    });
});
