// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/**
 * @title MockPoolManager
 * @dev Mock implementation of IPoolManager for testing purposes
 */
contract MockPoolManager is IPoolManager {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    mapping(PoolId => PoolKey) public pools;
    mapping(Currency => mapping(address => uint256)) public currencyReserves;

    function initialize(
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external override returns (int24 tick) {
        pools[key.toId()] = key;
        return 0; // Mock tick
    }

    function lock(
        bytes calldata data
    ) external override returns (bytes memory result) {
        // Mock lock implementation
        return data;
    }

    function unlock(uint256, bytes calldata) external pure override {
        // Mock unlock implementation
    }

    function swap(
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (BalanceDelta delta) {
        // Mock swap implementation
        return BalanceDelta.wrap(0);
    }

    function donate(
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external override returns (BalanceDelta delta) {
        // Mock donate implementation
        return BalanceDelta.wrap(0);
    }

    function take(
        Currency currency,
        address to,
        uint256 amount
    ) external override {
        // Mock take implementation
    }

    function settle(
        Currency currency
    ) external override returns (uint256 paid) {
        // Mock settle implementation
        return 0;
    }

    function mint(
        address to,
        Currency currency,
        uint256 amount
    ) external override {
        // Mock mint implementation
    }

    function burn(
        address from,
        Currency currency,
        uint256 amount
    ) external override {
        // Mock burn implementation
    }

    function addLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external override returns (BalanceDelta delta, int128 liquidityDelta) {
        // Mock addLiquidity implementation
        return (BalanceDelta.wrap(0), 0);
    }

    function removeLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external override returns (BalanceDelta delta, int128 liquidityDelta) {
        // Mock removeLiquidity implementation
        return (BalanceDelta.wrap(0), 0);
    }

    function getSlot0(
        PoolId id
    )
        external
        view
        override
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        )
    {
        // Mock slot0 implementation
        return (79228162514264337593543950336, 0, 0, 0); // Mock values
    }

    function getLiquidity(
        PoolId id
    ) external view override returns (uint128 liquidity) {
        // Mock liquidity implementation
        return 0;
    }

    function getFeeGrowthGlobal0X128(
        PoolId id
    ) external view override returns (uint256 feeGrowthGlobal0X128) {
        // Mock fee growth implementation
        return 0;
    }

    function getFeeGrowthGlobal1X128(
        PoolId id
    ) external view override returns (uint256 feeGrowthGlobal1X128) {
        // Mock fee growth implementation
        return 0;
    }

    function getProtocolFees(
        Currency currency0,
        Currency currency1
    ) external view override returns (uint128 token0, uint128 token1) {
        // Mock protocol fees implementation
        return (0, 0);
    }

    function getLiquidity(
        PoolId id,
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external view override returns (uint128 liquidity) {
        // Mock liquidity implementation
        return 0;
    }

    function getPosition(
        PoolId id,
        address owner,
        int24 tickLower,
        int24 tickUpper
    )
        external
        view
        override
        returns (
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        // Mock position implementation
        return (0, 0, 0, 0, 0);
    }

    function getTick(
        PoolId id,
        int24 tick
    )
        external
        view
        override
        returns (
            uint128 liquidityGross,
            int128 liquidityNet,
            uint256 feeGrowthOutside0X128,
            uint256 feeGrowthOutside1X128,
            int56 tickCumulativeOutside,
            uint160 secondsPerLiquidityOutsideX128,
            uint32 secondsOutside,
            bool initialized
        )
    {
        // Mock tick implementation
        return (0, 0, 0, 0, 0, 0, 0, false);
    }

    function getBitmap(
        PoolId id,
        int16 wordPos
    ) external view override returns (uint256 bitmap) {
        // Mock bitmap implementation
        return 0;
    }

    function getCurrencyBalance(
        Currency currency
    ) external view override returns (uint256) {
        // Mock currency balance implementation
        return 0;
    }

    function getCurrencyBalance(
        Currency currency,
        address account
    ) external view override returns (uint256) {
        // Mock currency balance implementation
        return currencyReserves[currency][account];
    }

    function setCurrencyBalance(
        Currency currency,
        address account,
        uint256 amount
    ) external {
        currencyReserves[currency][account] = amount;
    }
}
