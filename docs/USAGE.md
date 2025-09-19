# MEV-Capturing Auction Hook Usage Guide

## Quick Start

### 1. Installation

```bash
npm install
npm run compile
```

### 2. Running Tests

```bash
npm test
```

### 3. Deployment

```bash
npm run deploy
```

## For Pool Creators

### Creating a Pool with MEV Protection

1. **Deploy the Hook**:

```javascript
const MevAuctionHook = await ethers.getContractFactory("MevAuctionHook");
const hook = await MevAuctionHook.deploy();

// Set PoolManager (for production)
await hook.setPoolManager(poolManagerAddress);
```

2. **Create Pool with Hook**:

```javascript
const poolKey = {
  currency0: token0Address,
  currency1: token1Address,
  fee: 3000,
  tickSpacing: 60,
  hooks: hook.target, // Include the hook address
};

await poolManager.initialize(poolKey, initialSqrtPrice);
```

3. **Verify Hook is Active**:

```javascript
const permissions = await hook.getHookPermissions();
console.log("Hook permissions:", permissions);
```

### Configuration Options

The hook can be configured with these parameters:

```solidity
// Minimum price impact to trigger auction (0.5%)
uint256 public constant MIN_PRICE_IMPACT_BPS = 50;

// Maximum auction duration (1 block)
uint256 public constant MAX_AUCTION_DURATION = 1;

// Swapper rebate percentage (50%)
uint256 public constant SWAPPER_REBATE_BPS = 5000;

// LP reward percentage (50%)
uint256 public constant LP_REWARD_BPS = 5000;
```

## For Searchers

### Monitoring for Auctions

```javascript
// Listen for new auctions
hook.on("AuctionStarted", (poolId, auctionId, minBid, deadline) => {
  console.log(`New auction ${auctionId} for pool ${poolId}`);
  console.log(`Minimum bid: ${ethers.utils.formatEther(minBid)} ETH`);
  console.log(`Deadline: block ${deadline}`);
});
```

### Submitting Bids

```javascript
async function submitBid(auctionId, bidAmount) {
  try {
    const tx = await hook.bid(auctionId, { value: bidAmount });
    await tx.wait();
    console.log(`Bid submitted for auction ${auctionId}`);
  } catch (error) {
    console.error("Bid failed:", error.message);
  }
}
```

### Checking Auction Status

```javascript
async function checkAuction(auctionId) {
  const auction = await hook.getAuction(auctionId);
  console.log("Auction details:", {
    poolId: auction.poolId,
    highestBid: ethers.utils.formatEther(auction.highestBid),
    highestBidder: auction.highestBidder,
    deadline: auction.deadline,
    settled: auction.settled,
  });
}
```

### Complete Searcher Bot Example

```javascript
class MevSearcherBot {
  constructor(hookAddress, wallet) {
    this.hook = new ethers.Contract(hookAddress, hookABI, wallet);
    this.wallet = wallet;
  }

  async start() {
    // Listen for new auctions
    this.hook.on("AuctionStarted", this.handleNewAuction.bind(this));

    // Listen for bid updates
    this.hook.on("BidSubmitted", this.handleBidUpdate.bind(this));
  }

  async handleNewAuction(poolId, auctionId, minBid, deadline) {
    console.log(`New auction detected: ${auctionId}`);

    // Calculate optimal bid
    const optimalBid = await this.calculateOptimalBid(auctionId);

    if (optimalBid > minBid) {
      await this.submitBid(auctionId, optimalBid);
    }
  }

  async calculateOptimalBid(auctionId) {
    const auction = await this.hook.getAuction(auctionId);
    const expectedProfit = auction.expectedArbitrage;

    // Bid up to 80% of expected profit
    return ethers.BigNumber.from(expectedProfit).mul(80).div(100);
  }

  async submitBid(auctionId, amount) {
    try {
      const tx = await this.hook.bid(auctionId, { value: amount });
      await tx.wait();
      console.log(`Bid submitted: ${ethers.utils.formatEther(amount)} ETH`);
    } catch (error) {
      console.error("Bid failed:", error.message);
    }
  }
}

// Usage
const bot = new MevSearcherBot(hookAddress, wallet);
await bot.start();
```

## For Users

### Regular Swapping

Users don't need to do anything special! The hook automatically:

1. **Detects MEV opportunities** in your swaps
2. **Runs auctions** for searchers to bid on back-run rights
3. **Provides rebates** when MEV is captured
4. **Protects you** from sandwich attacks

### Checking for Rebates

```javascript
// Listen for value redistribution events
hook.on("ValueRedistributed", (poolId, swapperRebate, lpReward) => {
  console.log(`Value redistributed for pool ${poolId}:`);
  console.log(`Swapper rebate: ${ethers.utils.formatEther(swapperRebate)} ETH`);
  console.log(`LP reward: ${ethers.utils.formatEther(lpReward)} ETH`);
});
```

## For Liquidity Providers

### Earning Additional Yield

LPs automatically earn additional yield from MEV auctions:

1. **No additional setup required**
2. **Automatic distribution** of captured MEV value
3. **Transparent tracking** through events

### Monitoring LP Rewards

```javascript
// Track total LP rewards earned
let totalLPRewards = ethers.BigNumber.from(0);

hook.on("ValueRedistributed", (poolId, swapperRebate, lpReward) => {
  totalLPRewards = totalLPRewards.add(lpReward);
  console.log(
    `Total LP rewards: ${ethers.utils.formatEther(totalLPRewards)} ETH`
  );
});
```

## Advanced Usage

### Custom Hook Configuration

For advanced users, you can deploy a custom version with different parameters:

```solidity
contract CustomMevAuctionHook is MevAuctionHook {
    constructor(IPoolManager _poolManager) MevAuctionHook(_poolManager) {}

    // Override configuration constants
    uint256 public constant override MIN_PRICE_IMPACT_BPS = 100; // 1%
    uint256 public constant override SWAPPER_REBATE_BPS = 6000;  // 60%
    uint256 public constant override LP_REWARD_BPS = 4000;       // 40%
}
```

### Integration with Existing Systems

```javascript
// Integrate with existing DEX aggregators
class MevAwareAggregator {
  constructor(hookAddress) {
    this.hook = new ethers.Contract(hookAddress, hookABI);
  }

  async getOptimalRoute(tokenIn, tokenOut, amount) {
    // Check if pool has MEV protection
    const hasMevProtection = await this.checkMevProtection(tokenIn, tokenOut);

    if (hasMevProtection) {
      // Factor in potential rebates when calculating best route
      return this.calculateRouteWithRebates(tokenIn, tokenOut, amount);
    }

    return this.calculateStandardRoute(tokenIn, tokenOut, amount);
  }
}
```

### Analytics and Monitoring

```javascript
class MevAnalytics {
  constructor(hookAddress) {
    this.hook = new ethers.Contract(hookAddress, hookABI);
    this.metrics = {
      totalValueCaptured: ethers.BigNumber.from(0),
      totalAuctions: 0,
      totalBids: 0,
    };
  }

  async startMonitoring() {
    this.hook.on("AuctionStarted", () => {
      this.metrics.totalAuctions++;
    });

    this.hook.on("BidSubmitted", () => {
      this.metrics.totalBids++;
    });

    this.hook.on("AuctionWon", (auctionId, winner, winningBid) => {
      this.metrics.totalValueCaptured =
        this.metrics.totalValueCaptured.add(winningBid);
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      totalValueCapturedETH: ethers.utils.formatEther(
        this.metrics.totalValueCaptured
      ),
    };
  }
}
```

## Troubleshooting

### Common Issues

1. **"Auction does not exist"**

   - Check if the auction ID is correct
   - Verify the auction hasn't expired

2. **"Bid too low"**

   - Ensure your bid is higher than the current highest bid
   - Check the minimum bid requirement

3. **"Auction expired"**
   - Auctions only last for 1 block
   - Submit bids quickly after auction creation

### Debug Mode

Enable debug logging in your searcher bot:

```javascript
const DEBUG = true;

function debugLog(message, data) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data);
  }
}

// Usage
debugLog("New auction detected", { auctionId, minBid, deadline });
```

## Best Practices

### For Searchers

1. **Monitor continuously** for new auctions
2. **Calculate optimal bids** based on expected profit
3. **Submit bids quickly** due to short auction duration
4. **Handle refunds** properly in your bot logic

### For Pool Creators

1. **Test thoroughly** before mainnet deployment
2. **Monitor performance** after deployment
3. **Adjust parameters** based on market conditions
4. **Keep contracts updated** with latest versions

### For Users

1. **Use pools with MEV protection** when available
2. **Monitor for rebates** in your transactions
3. **Report issues** to help improve the system

## Support

For additional help:

- Check the [Architecture Documentation](./ARCHITECTURE.md)
- Review the [test files](../test/) for examples
- Open an issue on GitHub
- Join the community Discord
