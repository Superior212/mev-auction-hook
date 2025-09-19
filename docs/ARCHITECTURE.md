# MEV-Capturing Auction Hook Architecture

## Overview

The MEV-Capturing Auction Hook is a sophisticated DeFi primitive designed to internalize and redistribute MEV (Maximal Extractable Value) within Uniswap V4 pools. This document provides a detailed technical overview of the system architecture.

## System Design

### Core Principles

1. **Fully On-Chain**: All logic executes on-chain without external dependencies
2. **Atomic Operations**: MEV capture happens within the same transaction block
3. **Transparent**: All auction activity is publicly verifiable
4. **Permissionless**: Any participant can bid in auctions
5. **Defensive**: Protects users while making MEV productive

### Architecture Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Swap     │───▶│  MevAuctionHook  │───▶│  Value Capture  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Auction System  │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Value Redistribution │
                       └──────────────────┘
```

## Hook Lifecycle

### 1. beforeSwap Hook

**Purpose**: Detect MEV opportunities and initiate auctions

**Process**:

1. Analyze incoming swap parameters
2. Calculate expected price impact
3. Determine if arbitrage opportunity exists
4. Start auction if profitable opportunity detected

**Key Functions**:

- `_calculateExpectedArbitrage()`: Estimates potential MEV profit
- `_calculatePriceImpact()`: Determines swap's price impact
- `_shouldStartAuction()`: Decides whether to start an auction
- `_startAuction()`: Creates new auction instance

### 2. Auction System

**Purpose**: Conduct fair, transparent auctions for MEV execution rights

**Components**:

- **Auction Struct**: Contains auction metadata and state
- **Bidding Mechanism**: Allows searchers to submit competitive bids
- **Settlement Logic**: Determines winner and executes back-run

**Auction Lifecycle**:

```
Auction Created → Bidding Period → Settlement → Value Redistribution
```

### 3. afterSwap Hook

**Purpose**: Settle auctions and redistribute captured value

**Process**:

1. Identify active auction for the pool
2. Execute back-run on behalf of winning bidder
3. Redistribute captured value according to configured ratios
4. Clean up auction state

## Data Structures

### Auction Struct

```solidity
struct Auction {
    PoolId poolId;           // Pool identifier
    uint256 minBid;          // Minimum bid required
    uint256 highestBid;      // Current highest bid
    address highestBidder;   // Address of highest bidder
    uint256 deadline;        // Auction expiration block
    bool settled;            // Whether auction is settled
    Currency currency0;      // Pool currency 0
    Currency currency1;      // Pool currency 1
    int256 expectedArbitrage; // Expected MEV profit
}
```

### SwapContext Struct

```solidity
struct SwapContext {
    PoolId poolId;           // Pool identifier
    address originalSwapper; // Track who initiated the swap
    bool zeroForOne;         // Swap direction
    int256 amountSpecified;  // Swap amount
    uint160 sqrtPriceLimitX96; // Price limit
    bytes hookData;          // Additional hook data
}
```

### Advanced Auction Struct

```solidity
struct AdvancedAuction {
    AuctionType auctionType; // PUBLIC, PRIVATE, or EIGENLAYER_PROTECTED
    PoolId poolId;           // Pool identifier
    uint256 minBid;          // Minimum bid required
    uint256 highestBid;      // Current highest bid
    address highestBidder;   // Address of highest bidder
    uint256 deadline;        // Auction expiration block
    bool settled;            // Whether auction is settled
    Currency currency0;      // Pool currency 0
    Currency currency1;      // Pool currency 1
    int256 expectedArbitrage; // Expected MEV profit
    // Fhenix FHE encrypted fields
    euint256 encryptedBid;   // Encrypted bid amount
    eaddress encryptedBidder; // Encrypted bidder address
    bool decryptionRequested; // Whether decryption was requested
    // EigenLayer fields
    bool requiresEigenLayerStake; // Whether EigenLayer stake is required
    uint256 slashingAmount;  // Amount to slash if bidder fails
    bool isSlashed;          // Whether bidder was slashed
}
```

## MEV Detection Algorithm

### Price Impact Calculation

The hook uses a sophisticated price impact model that considers multiple pool parameters:

```solidity
function _calculatePriceImpact(PoolKey calldata key, SwapParams calldata params)
    internal view returns (uint256) {
    // Calculate the amount being swapped
    uint256 swapAmount = uint256(params.amountSpecified < 0 ? -params.amountSpecified : params.amountSpecified);

    // Get pool tick spacing for calculations
    int24 tickSpacing = key.tickSpacing;

    // Base impact calculation: larger swaps have more impact
    uint256 baseImpact = (swapAmount * 100) / 1e18; // Convert to basis points

    // Adjust for tick spacing (smaller tick spacing = less impact)
    uint256 tickAdjustment = (60 * 10000) / uint256(uint24(tickSpacing));
    baseImpact = (baseImpact * tickAdjustment) / 10000;

    // Adjust for fee tier (higher fees = more impact)
    uint256 feeAdjustment = (uint256(key.fee) * 10000) / 1000000;
    baseImpact = (baseImpact * feeAdjustment) / 10000;

    // Cap the price impact at 10% (1000 bps)
    if (baseImpact > 1000) {
        baseImpact = 1000;
    }

    return baseImpact;
}
```

### Arbitrage Opportunity Detection

```solidity
function _calculateExpectedArbitrage(PoolKey calldata key, SwapParams calldata params)
    internal view returns (int256) {
    // Calculate price impact based on swap parameters
    uint256 priceImpact = _calculatePriceImpact(key, params);

    if (priceImpact < MIN_PRICE_IMPACT_BPS) {
        return 0;
    }

    // Calculate expected arbitrage profit
    uint256 swapAmount = uint256(params.amountSpecified < 0 ? -params.amountSpecified : params.amountSpecified);

    // Estimate back-run profit based on price impact and swap size
    uint256 estimatedProfit = (swapAmount * priceImpact) / 10000;

    // Apply a conservative factor to account for gas costs and slippage
    uint256 netProfit = (estimatedProfit * 80) / 100; // 80% of estimated profit

    return int256(netProfit);
}
```

## Auction Mechanism

### Bidding Process

1. **Auction Creation**: Triggered by large swaps with significant price impact
2. **Bidding Window**: Single block duration for competitive bidding
3. **Bid Validation**: Ensures bids meet minimum requirements
4. **Refund Mechanism**: Automatically refunds outbid participants

### Settlement Process

1. **Winner Determination**: Highest bidder wins execution rights
2. **Back-run Execution**: Hook executes profitable trade on winner's behalf
3. **Value Capture**: Auction proceeds are captured by the hook
4. **Redistribution**: Value is shared between swapper and LPs

## Value Redistribution

### Distribution Ratios

- **Swapper Rebate**: 50% of captured value returned to original swapper
- **LP Reward**: 50% of captured value distributed to liquidity providers

### Implementation

```solidity
function _redistributeValue(uint256 totalValue, PoolKey calldata key) internal {
    uint256 swapperRebate = (totalValue * SWAPPER_REBATE_BPS) / 10000; // 50%
    uint256 lpReward = (totalValue * LP_REWARD_BPS) / 10000; // 50%

    // Send rebate to the original swapper
    if (swapperRebate > 0 && currentSwapContext.originalSwapper != address(0)) {
        (bool success, ) = currentSwapContext.originalSwapper.call{value: swapperRebate}("");
        if (!success) {
            // If swapper rebate fails, add it to LP reward
            lpReward += swapperRebate;
            swapperRebate = 0;
        }
    }

    // Send LP reward to the pool
    if (lpReward > 0) {
        _distributeLPReward(key, lpReward);
    }

    emit ValueRedistributed(key.toId(), swapperRebate, lpReward);
}
```

## Security Considerations

### Access Control

- **Owner Functions**: Emergency withdrawal and configuration updates
- **Public Functions**: Bidding and auction queries
- **Hook Functions**: Called only by PoolManager

### Economic Security

- **Minimum Bid Requirements**: Prevents spam and ensures serious participation
- **Auction Time Limits**: Prevents indefinite auction states
- **Refund Mechanisms**: Protects bidders from stuck funds

### Technical Security

- **Reentrancy Protection**: All external calls are made last
- **Integer Overflow Protection**: Uses SafeMath patterns
- **State Validation**: Ensures auction state consistency

## Gas Optimization

### Efficient Storage

- **Packed Structs**: Minimize storage slots used
- **State Cleanup**: Remove completed auction data
- **Batch Operations**: Group related operations

### Computational Efficiency

- **Simplified Calculations**: Use approximations where appropriate
- **Early Returns**: Exit early for non-profitable opportunities
- **Cached Values**: Store frequently accessed data

## Core Features

### Private Bidding (Fhenix FHE)

The hook supports private bidding through Fhenix's Fully Homomorphic Encryption:

- **Encrypted Bids**: Bidders can submit encrypted bid amounts and addresses
- **Private Auctions**: Auction type that uses FHE for privacy-preserving bidding
- **Asynchronous Decryption**: Decryption requests are handled off-chain
- **Winner Revelation**: Winners are revealed after decryption process

### Economic Security (EigenLayer)

Economic security through restaking mechanisms:

- **Staker Registration**: EigenLayer stakers can be registered for enhanced protection
- **Slashing Protection**: Bidders can provide slashing guarantees
- **Economic Security**: Failed bidders face slashing penalties
- **Trustless Operation**: No need for trusted third parties

### Auction Types

The system supports three types of auctions:

1. **PUBLIC**: Traditional open bidding with transparent amounts
2. **PRIVATE**: Fhenix FHE encrypted bidding for privacy
3. **EIGENLAYER_PROTECTED**: Bidding with EigenLayer slashing guarantees

## Integration Points

### Uniswap V4 Integration

- **Hook Interface**: Implements required hook functions
- **Pool Manager**: Interacts with pool state and operations
- **Currency System**: Handles different token types

### External Integrations

- **Searcher Bots**: Monitor and bid on auctions
- **Analytics Tools**: Track auction performance
- **User Interfaces**: Display auction information
- **Fhenix Network**: FHE decryption services
- **EigenLayer Protocol**: Restaking and slashing mechanisms

## Monitoring and Analytics

### Key Metrics

- **Total Value Captured**: Sum of all auction proceeds
- **Auction Success Rate**: Percentage of auctions with bids
- **Average Bid Amount**: Mean bid size across auctions
- **Value Redistribution**: Amount returned to users and LPs

### Events for Tracking

**Core Auction Events:**

- `AuctionStarted`: New auction creation
- `BidSubmitted`: Bidding activity
- `AuctionWon`: Successful auction settlement
- `ValueRedistributed`: Value sharing events

**Advanced Auction Events:**

- `AdvancedAuctionStarted`: Advanced auction with specific type
- `PrivateBidSubmitted`: Encrypted bid submission
- `WinnerRevealed`: Winner revealed after decryption
- `EigenLayerSlashing`: Slashing event for failed bidders

**Back-Run Execution Events:**

- `BackRunExecuted`: Successful back-run execution
- `BackRunFailed`: Failed back-run attempt

**LP Reward Events:**

- `LPRewardDistributed`: LP reward distribution
- `LPRewardClaimed`: LP reward claiming

## Future Enhancements

### Advanced MEV Detection

- **Multi-block MEV**: Handle complex arbitrage opportunities
- **Cross-pool MEV**: Detect opportunities across multiple pools
- **Dynamic Pricing**: Adjust detection thresholds based on market conditions

### Improved Auction Mechanisms

- **Sealed Bid Auctions**: Prevent front-running of bids
- **Multi-round Auctions**: Allow iterative bidding
- **Reserve Prices**: Set minimum acceptable bids

### Enhanced Value Distribution

- **Dynamic Ratios**: Adjust distribution based on market conditions
- **Staking Rewards**: Additional incentives for long-term participants
- **Governance Integration**: Community-controlled parameter updates
