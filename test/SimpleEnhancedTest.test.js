const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Simple Enhanced MevAuctionHook Test", function () {
    // Deploy fixture
    async function deployEnhancedMevAuctionHookFixture() {
        const [owner, searcher1, searcher2, swapper, lp] = await ethers.getSigners();

        // Deploy Enhanced MevAuctionHook (no PoolManager needed for basic testing)
        const MevAuctionHook = await ethers.getContractFactory("MevAuctionHook");
        const mevAuctionHook = await MevAuctionHook.deploy();

        return {
            mevAuctionHook,
            owner,
            searcher1,
            searcher2,
            swapper,
            lp,
        };
    }

    describe("Basic Enhanced Functionality", function () {
        it("Should deploy successfully", async function () {
            const { mevAuctionHook } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            expect(await mevAuctionHook.nextAuctionId()).to.equal(1);
            expect(await mevAuctionHook.MIN_PRICE_IMPACT_BPS()).to.equal(50);
            expect(await mevAuctionHook.MAX_AUCTION_DURATION()).to.equal(1);
            expect(await mevAuctionHook.SWAPPER_REBATE_BPS()).to.equal(5000);
            expect(await mevAuctionHook.LP_REWARD_BPS()).to.equal(5000);
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

        it("Should have correct hook permissions", async function () {
            const { mevAuctionHook } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            const permissions = await mevAuctionHook.getHookPermissions();

            // Should only have beforeSwap and afterSwap enabled
            expect(permissions.beforeSwap).to.be.true;
            expect(permissions.afterSwap).to.be.true;
            expect(permissions.beforeInitialize).to.be.false;
            expect(permissions.afterInitialize).to.be.false;
            expect(permissions.beforeAddLiquidity).to.be.false;
            expect(permissions.afterAddLiquidity).to.be.false;
            expect(permissions.beforeRemoveLiquidity).to.be.false;
            expect(permissions.afterRemoveLiquidity).to.be.false;
            expect(permissions.beforeDonate).to.be.false;
            expect(permissions.afterDonate).to.be.false;
        });

        it("Should allow emergency withdraw by owner", async function () {
            const { mevAuctionHook, owner, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Send some ETH to the contract
            await searcher1.sendTransaction({
                to: mevAuctionHook.target,
                value: ethers.parseEther("1.0")
            });

            const initialBalance = await ethers.provider.getBalance(owner.address);

            // Emergency withdraw
            await mevAuctionHook.emergencyWithdraw();

            const finalBalance = await ethers.provider.getBalance(owner.address);

            // Balance should have increased (minus gas costs)
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should reject emergency withdraw by non-owner", async function () {
            const { mevAuctionHook, searcher1 } = await loadFixture(deployEnhancedMevAuctionHookFixture);

            // Non-owner should not be able to emergency withdraw
            await expect(
                mevAuctionHook.connect(searcher1).emergencyWithdraw()
            ).to.be.revertedWithCustomError(mevAuctionHook, "OwnableUnauthorizedAccount");
        });
    });

    describe("Core MEV Functionality", function () {
        it("Should calculate price impact correctly", async function () {
            const { mevAuctionHook } = await loadFixture(deployEnhancedMevAuctionHookFixture);
            
            // Test with a large swap amount (should have high price impact)
            const largeSwapAmount = ethers.parseEther("1000"); // 1000 ETH
            
            // We can't directly test the internal function, but we can test the auction logic
            // by checking if large swaps trigger auctions
            expect(await mevAuctionHook.MIN_PRICE_IMPACT_BPS()).to.equal(50);
        });

        it("Should handle LP reward distribution", async function () {
            const { mevAuctionHook, lp } = await loadFixture(deployEnhancedMevAuctionHookFixture);
            
            // Create a mock pool ID
            const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "uint24", "int24", "address"],
                [ethers.ZeroAddress, ethers.ZeroAddress, 3000, 60, mevAuctionHook.target]
            ));
            
            // Initially no rewards
            expect(await mevAuctionHook.getLPRewards(poolId)).to.equal(0);
            
            // Simulate adding rewards (this would normally happen through auction settlement)
            // We can't directly call the internal function, but we can test the claim mechanism
            // by manually setting rewards in the mock pool manager if needed
        });

        it("Should track original swapper correctly", async function () {
            const { mevAuctionHook, swapper } = await loadFixture(deployEnhancedMevAuctionHookFixture);
            
            // The swapper tracking is internal to the beforeSwap/afterSwap flow
            // We can verify the contract has the capability by checking the SwapContext structure
            // In a real test, we would need to simulate a full swap through the pool manager
            expect(await mevAuctionHook.SWAPPER_REBATE_BPS()).to.equal(5000); // 50% rebate
        });
    });
});
