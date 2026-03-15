// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

contract ThaliumDEX is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Pool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalSupply;
        uint256 fee;
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct SwapQuote {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 priceImpact;
        uint256 fee;
        uint256 feeDiscount;
        bytes32 route;
    }

    struct LiquidityPosition {
        address user;
        bytes32 poolKey;
        uint256 liquidity;
        uint256 tokenAAmount;
        uint256 tokenBAmount;
        uint256 timestamp;
    }

    bytes32 public constant DEX_ADMIN_ROLE = keccak256("DEX_ADMIN_ROLE");
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");

    uint256 public constant FEE_PRECISION = 10_000;
    uint256 public constant MAX_FEE = 1_000;
    uint256 public constant MIN_LIQUIDITY = 1_000;
    uint256 public constant DEFAULT_MAX_PRICE_IMPACT = 2_000;
    uint256 public constant MAX_ALLOWED_PRICE_IMPACT = 5_000;
    uint256 public constant THAL_TIER_1_MIN = 1_000 * 10 ** 18;
    uint256 public constant THAL_TIER_2_MIN = 10_000 * 10 ** 18;
    uint256 public constant THAL_TIER_3_MIN = 100_000 * 10 ** 18;

    IERC20 public immutable THAL_TOKEN;

    mapping(bytes32 => Pool) public pools;
    mapping(address => mapping(address => bytes32)) public poolKeys;
    mapping(address => mapping(bytes32 => uint256)) public liquidityBalances;
    mapping(address => LiquidityPosition[]) public userLiquidityPositions;
    mapping(uint256 => uint256) public thalDiscountTiers;
    mapping(bytes32 => uint256) public maxPriceImpact;
    mapping(bytes32 => bool) public circuitBreakerActive;

    uint256 public protocolFee = 50;

    event PoolCreated(bytes32 indexed poolKey, address indexed tokenA, address indexed tokenB, uint256 fee);
    event LiquidityAdded(address indexed user, bytes32 indexed poolKey, uint256 amountA, uint256 amountB, uint256 liquidity);
    event LiquidityRemoved(address indexed user, bytes32 indexed poolKey, uint256 amountA, uint256 amountB, uint256 liquidity);
    event SwapExecuted(
        address indexed user,
        bytes32 indexed poolKey,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 feeDiscount
    );
    event CircuitBreakerUpdated(bytes32 indexed poolKey, uint256 maxImpact, bool active);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    error InvalidAddress();
    error InvalidTokenPair();
    error PoolAlreadyExists();
    error PoolNotFound();
    error PoolInactive();
    error InvalidFee();
    error InvalidAmount();
    error InsufficientInitialLiquidity();
    error InsufficientPoolLiquidity();
    error InsufficientLiquidityBalance();
    error SlippageExceeded();
    error PriceImpactExceeded();

    constructor(address thalTokenAddress, address defaultAdmin, address dexAdmin, address liquidityManager) {
        if (thalTokenAddress == address(0) || defaultAdmin == address(0) || dexAdmin == address(0) || liquidityManager == address(0)) {
            revert InvalidAddress();
        }

        THAL_TOKEN = IERC20(thalTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(DEX_ADMIN_ROLE, dexAdmin);
        _grantRole(LIQUIDITY_MANAGER_ROLE, liquidityManager);

        thalDiscountTiers[1] = 500;
        thalDiscountTiers[2] = 1_000;
        thalDiscountTiers[3] = 1_500;
    }

    function createPool(address tokenA, address tokenB, uint256 fee) external onlyRole(LIQUIDITY_MANAGER_ROLE) whenNotPaused returns (bytes32) {
        if (tokenA == address(0) || tokenB == address(0)) {
            revert InvalidAddress();
        }
        if (tokenA == tokenB) {
            revert InvalidTokenPair();
        }
        if (fee > MAX_FEE) {
            revert InvalidFee();
        }

        (address sortedTokenA, address sortedTokenB) = _sortTokens(tokenA, tokenB);
        bytes32 poolKey = _getPoolKey(sortedTokenA, sortedTokenB);

        if (pools[poolKey].tokenA != address(0)) {
            revert PoolAlreadyExists();
        }

        pools[poolKey] = Pool({
            tokenA: sortedTokenA,
            tokenB: sortedTokenB,
            reserveA: 0,
            reserveB: 0,
            totalSupply: 0,
            fee: fee,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        poolKeys[sortedTokenA][sortedTokenB] = poolKey;
        poolKeys[sortedTokenB][sortedTokenA] = poolKey;
        maxPriceImpact[poolKey] = DEFAULT_MAX_PRICE_IMPACT;
        circuitBreakerActive[poolKey] = true;

        emit PoolCreated(poolKey, sortedTokenA, sortedTokenB, fee);
        emit CircuitBreakerUpdated(poolKey, DEFAULT_MAX_PRICE_IMPACT, true);

        return poolKey;
    }

    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 liquidity)
    {
        if (amountA == 0 || amountB == 0) {
            revert InvalidAmount();
        }

        bytes32 poolKey = _requirePool(tokenA, tokenB);
        Pool storage pool = pools[poolKey];

        (uint256 orderedAmountA, uint256 orderedAmountB) = tokenA == pool.tokenA ? (amountA, amountB) : (amountB, amountA);

        IERC20(pool.tokenA).safeTransferFrom(msg.sender, address(this), orderedAmountA);
        IERC20(pool.tokenB).safeTransferFrom(msg.sender, address(this), orderedAmountB);

        if (pool.totalSupply == 0) {
            uint256 initialLiquidity = Math.sqrt(orderedAmountA * orderedAmountB);
            if (initialLiquidity <= MIN_LIQUIDITY) {
                revert InsufficientInitialLiquidity();
            }
            liquidity = initialLiquidity - MIN_LIQUIDITY;
        } else {
            uint256 liquidityA = (orderedAmountA * pool.totalSupply) / pool.reserveA;
            uint256 liquidityB = (orderedAmountB * pool.totalSupply) / pool.reserveB;
            liquidity = Math.min(liquidityA, liquidityB);
        }

        if (liquidity == 0) {
            revert InsufficientPoolLiquidity();
        }

        pool.reserveA += orderedAmountA;
        pool.reserveB += orderedAmountB;
        pool.totalSupply += liquidity;
        pool.lastUpdated = block.timestamp;

        liquidityBalances[msg.sender][poolKey] += liquidity;
        userLiquidityPositions[msg.sender].push(
            LiquidityPosition({
                user: msg.sender,
                poolKey: poolKey,
                liquidity: liquidity,
                tokenAAmount: orderedAmountA,
                tokenBAmount: orderedAmountB,
                timestamp: block.timestamp
            })
        );

        emit LiquidityAdded(msg.sender, poolKey, orderedAmountA, orderedAmountB, liquidity);
    }

    function removeLiquidity(address tokenA, address tokenB, uint256 liquidity)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        if (liquidity == 0) {
            revert InvalidAmount();
        }

        bytes32 poolKey = _requirePool(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        uint256 providerLiquidity = liquidityBalances[msg.sender][poolKey];

        if (providerLiquidity < liquidity) {
            revert InsufficientLiquidityBalance();
        }
        if (pool.totalSupply == 0) {
            revert InsufficientPoolLiquidity();
        }

        amountA = (liquidity * pool.reserveA) / pool.totalSupply;
        amountB = (liquidity * pool.reserveB) / pool.totalSupply;

        liquidityBalances[msg.sender][poolKey] = providerLiquidity - liquidity;
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        pool.totalSupply -= liquidity;
        pool.lastUpdated = block.timestamp;

        IERC20(pool.tokenA).safeTransfer(msg.sender, amountA);
        IERC20(pool.tokenB).safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, poolKey, amountA, amountB, liquidity);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) {
            revert InvalidAmount();
        }

        bytes32 poolKey = _requirePool(tokenIn, tokenOut);
        Pool storage pool = pools[poolKey];
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == pool.tokenA ? (pool.reserveA, pool.reserveB) : (pool.reserveB, pool.reserveA);

        uint256 fee = _calculateFee(amountIn, pool.fee, msg.sender);
        uint256 amountInAfterFee = amountIn - fee;
        amountOut = _calculateSwapAmount(amountInAfterFee, reserveIn, reserveOut);

        if (amountOut < minAmountOut) {
            revert SlippageExceeded();
        }

        uint256 priceImpact = _calculatePriceImpact(amountInAfterFee, amountOut, reserveIn, reserveOut);
        if (circuitBreakerActive[poolKey] && priceImpact > maxPriceImpact[poolKey]) {
            revert PriceImpactExceeded();
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        if (tokenIn == pool.tokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }

        pool.lastUpdated = block.timestamp;
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(msg.sender, poolKey, tokenIn, tokenOut, amountIn, amountOut, fee, _getTHALDiscount(msg.sender));
    }

    function setCircuitBreaker(address tokenA, address tokenB, uint256 maxImpact, bool active) external onlyRole(DEX_ADMIN_ROLE) {
        if (maxImpact == 0 || maxImpact > MAX_ALLOWED_PRICE_IMPACT) {
            revert InvalidAmount();
        }

        bytes32 poolKey = _requireExistingPoolKey(tokenA, tokenB);
        maxPriceImpact[poolKey] = maxImpact;
        circuitBreakerActive[poolKey] = active;

        emit CircuitBreakerUpdated(poolKey, maxImpact, active);
    }

    function setPoolFee(address tokenA, address tokenB, uint256 fee) external onlyRole(DEX_ADMIN_ROLE) {
        if (fee > MAX_FEE) {
            revert InvalidFee();
        }

        bytes32 poolKey = _requireExistingPoolKey(tokenA, tokenB);
        pools[poolKey].fee = fee;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    function getSwapQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (SwapQuote memory quote) {
        bytes32 poolKey = _requireExistingPoolKey(tokenIn, tokenOut);
        Pool memory pool = pools[poolKey];
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == pool.tokenA ? (pool.reserveA, pool.reserveB) : (pool.reserveB, pool.reserveA);

        uint256 fee = _calculateFee(amountIn, pool.fee, msg.sender);
        uint256 amountInAfterFee = amountIn - fee;
        uint256 amountOut = _calculateSwapAmount(amountInAfterFee, reserveIn, reserveOut);
        uint256 priceImpact = _calculatePriceImpact(amountInAfterFee, amountOut, reserveIn, reserveOut);
        uint256 thalDiscount = _getTHALDiscount(msg.sender);

        quote = SwapQuote({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOut: amountOut,
            priceImpact: priceImpact,
            fee: fee,
            feeDiscount: thalDiscount,
            route: poolKey
        });
    }

    function getPool(address tokenA, address tokenB) external view returns (Pool memory) {
        bytes32 poolKey = _requireExistingPoolKey(tokenA, tokenB);
        return pools[poolKey];
    }

    function getUserLiquidityPositions(address user) external view returns (LiquidityPosition[] memory) {
        return userLiquidityPositions[user];
    }

    function getLiquidityBalance(address user, address tokenA, address tokenB) external view returns (uint256) {
        bytes32 poolKey = _requireExistingPoolKey(tokenA, tokenB);
        return liquidityBalances[user][poolKey];
    }

    function getTHALDiscountTier(address user) external view returns (uint256 tier, uint256 discount) {
        uint256 balance = THAL_TOKEN.balanceOf(user);
        tier = _getTHALTier(balance);
        discount = thalDiscountTiers[tier];
    }

    function _requirePool(address tokenA, address tokenB) internal view returns (bytes32 poolKey) {
        poolKey = _requireExistingPoolKey(tokenA, tokenB);
        if (!pools[poolKey].isActive) {
            revert PoolInactive();
        }
    }

    function _requireExistingPoolKey(address tokenA, address tokenB) internal view returns (bytes32 poolKey) {
        poolKey = poolKeys[tokenA][tokenB];
        if (poolKey == bytes32(0)) {
            revert PoolNotFound();
        }
    }

    function _calculateFee(uint256 amount, uint256 poolFee, address user) internal view returns (uint256) {
        uint256 baseFeeAmount = (amount * poolFee) / FEE_PRECISION;
        uint256 discount = _getTHALDiscount(user);
        return baseFeeAmount - ((baseFeeAmount * discount) / FEE_PRECISION);
    }

    function _getTHALDiscount(address user) internal view returns (uint256) {
        uint256 balance = THAL_TOKEN.balanceOf(user);
        uint256 tier = _getTHALTier(balance);
        return thalDiscountTiers[tier];
    }

    function _getTHALTier(uint256 balance) internal pure returns (uint256) {
        if (balance >= THAL_TIER_3_MIN) {
            return 3;
        }
        if (balance >= THAL_TIER_2_MIN) {
            return 2;
        }
        if (balance >= THAL_TIER_1_MIN) {
            return 1;
        }
        return 0;
    }

    function _getPoolKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA, tokenB));
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address, address) {
        return tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function _calculateSwapAmount(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn == 0) {
            revert InvalidAmount();
        }
        if (reserveIn == 0 || reserveOut == 0) {
            revert InsufficientPoolLiquidity();
        }

        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    function _calculatePriceImpact(uint256 amountIn, uint256 amountOut, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (reserveIn == 0 || reserveOut == 0 || amountIn == 0 || amountOut == 0) {
            revert InsufficientPoolLiquidity();
        }

        uint256 currentPrice = (reserveOut * FEE_PRECISION) / reserveIn;
        uint256 executionPrice = (amountOut * FEE_PRECISION) / amountIn;

        if (executionPrice > currentPrice) {
            return ((executionPrice - currentPrice) * FEE_PRECISION) / currentPrice;
        }

        return ((currentPrice - executionPrice) * FEE_PRECISION) / currentPrice;
    }
}
