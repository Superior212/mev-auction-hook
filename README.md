# MEV-Capturing Auction Hook for Uniswap V4

A defensive DeFi primitive that mitigates the negative impact of Maximal Extractable Value (MEV) by internalizing MEV opportunities and redistributing captured value back to users and liquidity providers.

## Overview

The MEV-Capturing Auction Hook is designed to address sandwich attacks and other forms of MEV extraction by:

1. **Detecting MEV Opportunities**: Identifying swaps that create profitable arbitrage opportunities
2. **Conducting Fair Auctions**: Running transparent, on-chain auctions for the right to execute back-runs
3. **Redistributing Value**: Sharing captured MEV value between swappers (as rebates) and liquidity providers

## Key Features

- **Fully On-Chain**: No reliance on off-chain infrastructure or private relays
- **Permissionless**: Any searcher can participate in auctions
- **Transparent**: All auction activity is visible on-chain
- **Fair**: Value is redistributed according to clear, predetermined ratios
- **Defensive**: Protects users from sandwich attacks while making MEV productive

## Architecture

### Core Components

1. **MevAuctionHook Contract**: The main hook contract that implements the auction logic
2. **Auction System**: In-flight auction mechanism for searcher bidding
3. **Value Redistribution**: Mechanism for sharing captured value with users and LPs

### Hook Lifecycle

```
User Swap → beforeSwap (Detect MEV) → Auction → afterSwap (Settle & Redistribute)
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd mev-auction-hook

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local network
npm run deploy
```

## Usage

### For Pool Creators

1. Deploy the MevAuctionHook contract
2. Create a Uniswap V4 pool with the hook address
3. The hook will automatically start protecting users from MEV

### For Searchers

1. Monitor the hook contract for new auctions
2. Submit bids for profitable opportunities
3. Win auctions to execute back-runs

### For Users

No additional steps required! The hook automatically protects your swaps and provides rebates when MEV is captured.

## Configuration

The hook can be configured with the following parameters:

- `MIN_PRICE_IMPACT_BPS`: Minimum price impact to trigger an auction (default: 50 = 0.5%)
- `MAX_AUCTION_DURATION`: Maximum auction duration in blocks (default: 1)
- `SWAPPER_REBATE_BPS`: Percentage of captured value returned to swapper (default: 5000 = 50%)
- `LP_REWARD_BPS`: Percentage of captured value given to LPs (default: 5000 = 50%)

## API Reference

### Events

- `AuctionStarted(PoolId poolId, uint256 auctionId, uint256 minBid, uint256 deadline)`
- `BidSubmitted(uint256 auctionId, address bidder, uint256 amount)`
- `AuctionWon(uint256 auctionId, address winner, uint256 winningBid)`
- `ValueRedistributed(PoolId poolId, uint256 swapperRebate, uint256 lpReward)`

### Functions

#### `bid(uint256 auctionId)`

Submit a bid for an active auction. Must be higher than the current highest bid.

#### `getAuction(uint256 auctionId)`

Get details about a specific auction.

#### `getActiveAuction(PoolId poolId)`

Get the active auction ID for a specific pool.

#### `emergencyWithdraw()`

Emergency function to withdraw stuck funds (owner only).

## Security Considerations

- The hook is designed to be fully autonomous and doesn't rely on external parties
- All auction logic is transparent and verifiable on-chain
- Emergency withdrawal function is available for stuck funds
- The hook only operates within the bounds of a single transaction block

## Testing

The project includes comprehensive tests covering:

- Hook deployment and initialization
- Auction creation and bidding
- Value redistribution
- Edge cases and error conditions
- Access control

Run tests with:

```bash
npm test
```

## Deployment

### Local Development

```bash
# Start local Hardhat network
npx hardhat node

# Deploy contracts
npm run deploy
```

### Testnet/Mainnet

1. Set up environment variables for your network
2. Run deployment script
3. Verify contracts on block explorer

```bash
# Set environment variables
export CONTRACT_ADDRESS=<deployed-address>
export CONSTRUCTOR_ARGS='["<pool-manager-address>"]'

# Verify contract
npm run verify
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This software is provided as-is for educational and research purposes. Use at your own risk. The authors are not responsible for any losses incurred through the use of this software.

## Roadmap

### v1.0 (Current)

- Basic MEV detection and auction system
- Value redistribution to users and LPs
- Single-block MEV handling

### Future Versions

- Multi-block MEV handling
- Cross-chain MEV support
- Integration with private order flow
- Advanced arbitrage opportunity detection
- Dynamic fee optimization

## Support

For questions and support:

- Open an issue on GitHub
- Join our Discord community
- Check the documentation wiki

## Acknowledgments

- Uniswap Labs for the V4 architecture
- The DeFi community for MEV research and insights
- Contributors and testers
