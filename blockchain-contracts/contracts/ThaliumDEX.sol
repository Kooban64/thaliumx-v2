// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title ThaliumDEX
 * @dev Decentralized exchange with AMM functionality and THAL token benefits
 *
 * This contract provides:
 * - Automated Market Maker (AMM) functionality
 * - Liquidity pool management
 * - Token swaps with price impact calculation
 * - THAL token fee discounts
 * - Emergency controls and circuit breakers
 *
 * Security Model:
 * - On-chain: Basic AMM calculations and token transfers
 * - Off-chain: Complex routing, price optimization, risk management
 *
 * @author Thalium Development Team
 */
contract ThaliumDEX is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant DEX_ADMIN_ROLE = keccak256("DEX_ADMIN_ROLE");
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    bytes32 public constant PRICE_ORACLE_ROLE = keccak256("PRICE_ORACLE_ROLE");

    uint256 public constant FEE_PRECISION = 10000; // 100.00%
    uint256 public constant MAX_FEE = 1000; // 10% max fee
    uint256 public constant MIN_LIQUIDITY = 1000; // Minimum liquidity amount

    // THAL token benefits
    uint256 public constant THAL_TIER_1_MIN = 1000 * 10**18; // 1000 THAL
    uint256 public constant THAL_TIER_2_MIN = 10000 * 10**18; // 10000 THAL
    uint256 public constant THAL_TIER_3_MIN = 100000 * 10**18; // 100000 THAL

    // ========================================
    // STRUCTS
    // ========================================

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
        uint256 route;
    }

    struct LiquidityPosition {
        address user;
        address pool;
        uint256 liquidity;
        uint256 tokenAAmount;
        uint256 tokenBAmount;
        uint256 timestamp;
    }

    // ========================================
    // STATE VARIABLES
    // ========================================

    mapping(bytes32 => Pool) public pools;
    mapping(address => mapping(address => bytes32)) public poolKeys;
    mapping(address => LiquidityPosition[]) public userLiquidityPositions;
    mapping(address => uint256) public userTHALBalance;

    // THAL token for fee discounts
    address public thalToken;
    
    // Fee structure
    uint256 public baseFee = 300; // 3% (300/10000)
    uint256 public protocolFee = 50; // 0.5% (50/10000)
    
    // THAL discount tiers
    mapping(uint256 => uint256) public thalDiscountTiers;
    
    // Circuit breakers
    mapping(address => uint256) public maxPriceImpact;
    mapping(address => bool) public circuitBreakerActive;

    // ========================================
    // EVENTS
    // ========================================

    event PoolCreated(
        bytes32 indexed poolKey,
        address indexed tokenA,
        address indexed tokenB,
        uint256 fee
    );

    event LiquidityAdded(
        address indexed user,
        bytes32 indexed poolKey,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event LiquidityRemoved(
        address indexed user,
        bytes32 indexed poolKey,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

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

    event THALBalanceUpdated(
        address indexed user,
        uint256 newBalance,
        uint256 discountTier
    );

    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    constructor(
        address thalTokenAddress,
        address defaultAdmin,
        address dexAdmin,
        address liquidityManager
    ) {
        require(thalTokenAddress != address(0), "ThaliumDEX: Invalid THAL token");
        require(defaultAdmin != address(0), "ThaliumDEX: Invalid admin");
        require(dexAdmin != address(0), "ThaliumDEX: Invalid DEX admin");
        require(liquidityManager != address(0), "ThaliumDEX: Invalid liquidity manager");

        thalToken = thalTokenAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(DEX_ADMIN_ROLE, dexAdmin);
        _grantRole(LIQUIDITY_MANAGER_ROLE, liquidityManager);

        // Initialize THAL discount tiers
        thalDiscountTiers[1] = 500;  // 5% discount for Tier 1
        thalDiscountTiers[2] = 1000; // 10% discount for Tier 2
        thalDiscountTiers[3] = 1500; // 15% discount for Tier 3
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Create liquidity pool
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Pool fee (in basis points)
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint256 fee
    ) external onlyRole(LIQUIDITY_MANAGER_ROLE) whenNotPaused returns (bytes32) {
        require(tokenA != address(0) && tokenB != address(0), "ThaliumDEX: Invalid tokens");
        require(tokenA != tokenB, "ThaliumDEX: Same tokens");
        require(fee <= MAX_FEE, "ThaliumDEX: Fee too high");

        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB));
        require(pools[poolKey].tokenA == address(0), "ThaliumDEX: Pool exists");

        // Create pool
        pools[poolKey] = Pool({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            totalSupply: 0,
            fee: fee,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        poolKeys[tokenA][tokenB] = poolKey;
        poolKeys[tokenB][tokenA] = poolKey;

        emit PoolCreated(poolKey, tokenA, tokenB, fee);
        return poolKey;
    }

    /**
     * @dev Add liquidity to pool
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountA Amount of token A
     * @param amountB Amount of token B
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external whenNotPaused nonReentrant returns (uint256 liquidity) {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        
        Pool storage pool = pools[poolKey];
        require(pool.isActive, "ThaliumDEX: Pool inactive");

        // Transfer tokens
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        // Calculate liquidity
        if (pool.totalSupply == 0) {
            liquidity = Math.sqrt(amountA * amountB) - MIN_LIQUIDITY;
            require(liquidity > 0, "ThaliumDEX: Insufficient liquidity");
        } else {
            uint256 liquidityA = (amountA * pool.totalSupply) / pool.reserveA;
            uint256 liquidityB = (amountB * pool.totalSupply) / pool.reserveB;
            liquidity = Math.min(liquidityA, liquidityB);
        }

        // Update pool
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.totalSupply += liquidity;
        pool.lastUpdated = block.timestamp;

        // Create liquidity position
        LiquidityPosition memory position = LiquidityPosition({
            user: msg.sender,
            pool: address(this),
            liquidity: liquidity,
            tokenAAmount: amountA,
            tokenBAmount: amountB,
            timestamp: block.timestamp
        });

        userLiquidityPositions[msg.sender].push(position);

        emit LiquidityAdded(msg.sender, poolKey, amountA, amountB, liquidity);
    }

    /**
     * @dev Remove liquidity from pool
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param liquidity Amount of liquidity to remove
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity
    ) external whenNotPaused nonReentrant returns (uint256 amountA, uint256 amountB) {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        
        Pool storage pool = pools[poolKey];
        require(pool.isActive, "ThaliumDEX: Pool inactive");
        require(liquidity > 0, "ThaliumDEX: Invalid liquidity");

        // Calculate amounts
        amountA = (liquidity * pool.reserveA) / pool.totalSupply;
        amountB = (liquidity * pool.reserveB) / pool.totalSupply;

        // Update pool
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        pool.totalSupply -= liquidity;
        pool.lastUpdated = block.timestamp;

        // Transfer tokens
        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, poolKey, amountA, amountB, liquidity);
    }

    /**
     * @dev Execute token swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     * @param minAmountOut Minimum amount out (slippage protection)
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        
        Pool storage pool = pools[poolKey];
        require(pool.isActive, "ThaliumDEX: Pool inactive");
        require(amountIn > 0, "ThaliumDEX: Invalid amount");

        // Transfer input token
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Calculate swap amount
        uint256 fee = _calculateFee(amountIn, pool.fee, msg.sender);
        uint256 amountInAfterFee = amountIn - fee;
        
        amountOut = _calculateSwapAmount(
            amountInAfterFee,
            tokenIn == pool.tokenA ? pool.reserveA : pool.reserveB,
            tokenIn == pool.tokenA ? pool.reserveB : pool.reserveA
        );

        require(amountOut >= minAmountOut, "ThaliumDEX: Slippage too high");

        // Check circuit breaker
        uint256 priceImpact = _calculatePriceImpact(amountIn, amountOut, tokenIn, tokenOut);
        require(priceImpact <= maxPriceImpact[tokenIn], "ThaliumDEX: Price impact too high");

        // Update pool reserves
        if (tokenIn == pool.tokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }
        pool.lastUpdated = block.timestamp;

        // Transfer output token
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        // Get THAL discount info
        uint256 thalDiscount = _getTHALDiscount(msg.sender);

        emit SwapExecuted(msg.sender, poolKey, tokenIn, tokenOut, amountIn, amountOut, fee, thalDiscount);
    }

    /**
     * @dev Get swap quote
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (SwapQuote memory quote) {
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        
        Pool memory pool = pools[poolKey];
        require(pool.isActive, "ThaliumDEX: Pool inactive");

        uint256 fee = _calculateFee(amountIn, pool.fee, msg.sender);
        uint256 amountInAfterFee = amountIn - fee;
        
        uint256 amountOut = _calculateSwapAmount(
            amountInAfterFee,
            tokenIn == pool.tokenA ? pool.reserveA : pool.reserveB,
            tokenIn == pool.tokenA ? pool.reserveB : pool.reserveA
        );

        uint256 priceImpact = _calculatePriceImpact(amountIn, amountOut, tokenIn, tokenOut);
        uint256 thalDiscount = _getTHALDiscount(msg.sender);

        quote = SwapQuote({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOut: amountOut,
            priceImpact: priceImpact,
            fee: fee,
            feeDiscount: thalDiscount,
            route: uint256(poolKey)
        });
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    /**
     * @dev Update THAL balance for user (called by backend)
     * @param user User address
     * @param balance New THAL balance
     */
    function updateTHALBalance(address user, uint256 balance) external onlyRole(PRICE_ORACLE_ROLE) {
        userTHALBalance[user] = balance;
        
        uint256 discountTier = _getTHALTier(balance);
        emit THALBalanceUpdated(user, balance, discountTier);
    }

    /**
     * @dev Set circuit breaker for token
     * @param token Token address
     * @param maxImpact Maximum price impact (in basis points)
     */
    function setCircuitBreaker(address token, uint256 maxImpact) external onlyRole(DEX_ADMIN_ROLE) {
        require(maxImpact <= 5000, "ThaliumDEX: Impact too high"); // Max 50%
        maxPriceImpact[token] = maxImpact;
    }

    /**
     * @dev Activate/deactivate circuit breaker
     * @param token Token address
     * @param active Circuit breaker status
     */
    function setCircuitBreakerActive(address token, bool active) external onlyRole(DEX_ADMIN_ROLE) {
        circuitBreakerActive[token] = active;
    }

    /**
     * @dev Set pool fee
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee New fee (in basis points)
     */
    function setPoolFee(
        address tokenA,
        address tokenB,
        uint256 fee
    ) external onlyRole(DEX_ADMIN_ROLE) {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        require(fee <= MAX_FEE, "ThaliumDEX: Fee too high");
        
        pools[poolKey].fee = fee;
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @dev Emergency unpause
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // ========================================
    // VIEW FUNCTIONS
    // ========================================

    /**
     * @dev Get pool information
     * @param tokenA First token address
     * @param tokenB Second token address
     */
    function getPool(address tokenA, address tokenB) external view returns (Pool memory) {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "ThaliumDEX: Pool not found");
        return pools[poolKey];
    }

    /**
     * @dev Get user liquidity positions
     * @param user User address
     */
    function getUserLiquidityPositions(address user) external view returns (LiquidityPosition[] memory) {
        return userLiquidityPositions[user];
    }

    /**
     * @dev Get THAL discount tier for user
     * @param user User address
     */
    function getTHALDiscountTier(address user) external view returns (uint256 tier, uint256 discount) {
        uint256 balance = userTHALBalance[user];
        tier = _getTHALTier(balance);
        discount = thalDiscountTiers[tier];
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Calculate swap amount using AMM formula
     */
    function _calculateSwapAmount(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256) {
        require(amountIn > 0, "ThaliumDEX: Invalid amount");
        require(reserveIn > 0 && reserveOut > 0, "ThaliumDEX: Insufficient liquidity");
        
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    /**
     * @dev Calculate fee with THAL discount
     */
    function _calculateFee(
        uint256 amount,
        uint256 poolFee,
        address user
    ) internal view returns (uint256) {
        uint256 baseFeeAmount = (amount * poolFee) / FEE_PRECISION;
        uint256 discount = _getTHALDiscount(user);
        return baseFeeAmount - (baseFeeAmount * discount) / FEE_PRECISION;
    }

    /**
     * @dev Get THAL discount for user
     */
    function _getTHALDiscount(address user) internal view returns (uint256) {
        uint256 balance = userTHALBalance[user];
        uint256 tier = _getTHALTier(balance);
        return thalDiscountTiers[tier];
    }

    /**
     * @dev Get THAL tier based on balance
     */
    function _getTHALTier(uint256 balance) internal pure returns (uint256) {
        if (balance >= THAL_TIER_3_MIN) return 3;
        if (balance >= THAL_TIER_2_MIN) return 2;
        if (balance >= THAL_TIER_1_MIN) return 1;
        return 0;
    }

    /**
     * @dev Calculate price impact
     */
    function _calculatePriceImpact(
        uint256 amountIn,
        uint256 amountOut,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256) {
        // Simplified price impact calculation
        // In production, this would use more sophisticated pricing models
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        Pool memory pool = pools[poolKey];
        
        uint256 currentPrice = tokenIn == pool.tokenA ? 
            (pool.reserveB * FEE_PRECISION) / pool.reserveA :
            (pool.reserveA * FEE_PRECISION) / pool.reserveB;
            
        uint256 newPrice = (amountOut * FEE_PRECISION) / amountIn;
        
        if (newPrice > currentPrice) {
            return ((newPrice - currentPrice) * FEE_PRECISION) / currentPrice;
        } else {
            return ((currentPrice - newPrice) * FEE_PRECISION) / currentPrice;
        }
    }
}