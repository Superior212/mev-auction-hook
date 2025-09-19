const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying MEV Auction Hook...");

    // Get the contract factories
    const MevAuctionHook = await ethers.getContractFactory("MevAuctionHook");
    const MockPoolManager = await ethers.getContractFactory("MockPoolManager");
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy MockPoolManager first (needed for MevAuctionHook)
    console.log("\nDeploying MockPoolManager...");
    const poolManager = await MockPoolManager.deploy();
    await poolManager.deployed();
    console.log("MockPoolManager deployed to:", poolManager.address);

    // Deploy MevAuctionHook
    console.log("\nDeploying MevAuctionHook...");
    const mevAuctionHook = await MevAuctionHook.deploy(poolManager.address);
    await mevAuctionHook.deployed();
    console.log("MevAuctionHook deployed to:", mevAuctionHook.address);

    // Deploy mock ERC20 tokens for testing
    console.log("\nDeploying mock ERC20 tokens...");
    const token0 = await MockERC20.deploy("Token0", "T0");
    await token0.deployed();
    console.log("Token0 deployed to:", token0.address);

    const token1 = await MockERC20.deploy("Token1", "T1");
    await token1.deployed();
    console.log("Token1 deployed to:", token1.address);

    // Mint some tokens to the deployer for testing
    console.log("\nMinting test tokens...");
    const mintAmount = ethers.utils.parseEther("1000000");
    await token0.mint(deployer.address, mintAmount);
    await token1.mint(deployer.address, mintAmount);
    console.log("Minted 1,000,000 tokens of each type to deployer");

    // Verify deployment
    console.log("\nVerifying deployment...");
    console.log("Hook permissions:", await mevAuctionHook.getHookPermissions());
    console.log("Next auction ID:", await mevAuctionHook.nextAuctionId());
    console.log("Min price impact BPS:", await mevAuctionHook.MIN_PRICE_IMPACT_BPS());
    console.log("Max auction duration:", await mevAuctionHook.MAX_AUCTION_DURATION());
    console.log("Swapper rebate BPS:", await mevAuctionHook.SWAPPER_REBATE_BPS());
    console.log("LP reward BPS:", await mevAuctionHook.LP_REWARD_BPS());

    // Save deployment info
    const deploymentInfo = {
        network: await ethers.provider.getNetwork(),
        deployer: deployer.address,
        contracts: {
            MevAuctionHook: mevAuctionHook.address,
            MockPoolManager: poolManager.address,
            Token0: token0.address,
            Token1: token1.address,
        },
        timestamp: new Date().toISOString(),
    };

    console.log("\nDeployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Instructions for next steps
    console.log("\nNext Steps:");
    console.log("1. Run tests: npm test");
    console.log("2. Verify contracts on block explorer (if on testnet/mainnet)");
    console.log("3. Initialize pools with the hook");
    console.log("4. Start monitoring for MEV opportunities");

    return {
        mevAuctionHook,
        poolManager,
        token0,
        token1,
        deploymentInfo,
    };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
