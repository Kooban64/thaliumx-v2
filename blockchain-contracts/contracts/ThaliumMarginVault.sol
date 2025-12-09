// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title ThaliumMarginVault
 * @dev Secure margin trading vault with strict fund separation
 *
 * This contract provides:
 * - Isolated margin accounts per user
 * - Strict fund separation (no cross-user leverage)
 * - Automated liquidation mechanisms
 * - Risk management controls
 * - Emergency pause functionality
 *
 * Security Model:
 * - On-chain: Basic margin calculations and liquidation
 * - Off-chain: Complex risk assessment, position monitoring
 *
 * @author Thalium Development Team
 */
contract ThaliumMarginVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant MARGIN_ADMIN_ROLE = keccak256("MARGIN_ADMIN_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    uint256 public constant MAX_LEVERAGE = 100; // 100x max leverage
    uint256 public constant MIN_LEVERAGE = 1;   // 1x min leverage
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80% (8000/10000)
    uint256 public constant MAINTENANCE_MARGIN = 5000;    // 50% (5000/10000)
    uint256 public constant PRECISION = 10000; // 100.00%

    // ========================================
    // STRUCTS
    // ========================================

    struct MarginAccount {
        address user;
        address collateralToken;
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 leverage;
        uint256 liquidationPrice;
        uint256 maintenanceMargin;
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct Position {
        address user;
        address asset;
        uint256 size;
        uint256 entryPrice;
        uint256 leverage;
        bool isLong;
        uint256 marginUsed;
        uint256 unrealizedPnL;
        uint256 realizedPnL;
        bool isActive;
        uint256 openedAt;
        uint256 closedAt;
    }

    struct LiquidationEvent {
        address user;
        address asset;
        uint256 positionSize;
        uint256 liquidationPrice;
        uint256 liquidatedAmount;
        uint256 timestamp;
    }

    // ========================================
    // STATE VARIABLES
    // ========================================

    mapping(address => MarginAccount) public marginAccounts;
    mapping(address => Position[]) public userPositions;
    mapping(address => uint256) public userTotalMargin;
    mapping(address => uint256) public userTotalBorrowed;

    // Asset configurations
    mapping(address => bool) public supportedAssets;
    mapping(address => uint256) public assetMaxLeverage;
    mapping(address => uint256) public assetLiquidationThreshold;

    // Risk management
    uint256 public totalMarginDeposited;
    uint256 public totalBorrowed;
    uint256 public liquidationPenalty = 500; // 5% penalty (500/10000)

    LiquidationEvent[] public liquidationEvents;
    uint256 public nextLiquidationId;

    // ========================================
    // EVENTS
    // ========================================

    event MarginAccountCreated(
        address indexed user,
        address indexed collateralToken,
        uint256 collateralAmount,
        uint256 maxLeverage
    );

    event PositionOpened(
        address indexed user,
        address indexed asset,
        uint256 size,
        uint256 entryPrice,
        uint256 leverage,
        bool isLong
    );

    event PositionClosed(
        address indexed user,
        address indexed asset,
        uint256 size,
        uint256 exitPrice,
        uint256 realizedPnL
    );

    event LiquidationExecuted(
        uint256 indexed liquidationId,
        address indexed user,
        address indexed asset,
        uint256 liquidatedAmount,
        uint256 liquidationPrice
    );

    event MarginDeposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event MarginWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    constructor(
        address defaultAdmin,
        address marginAdmin,
        address riskManager
    ) {
        require(defaultAdmin != address(0), "ThaliumMarginVault: Invalid admin");
        require(marginAdmin != address(0), "ThaliumMarginVault: Invalid margin admin");
        require(riskManager != address(0), "ThaliumMarginVault: Invalid risk manager");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MARGIN_ADMIN_ROLE, marginAdmin);
        _grantRole(RISK_MANAGER_ROLE, riskManager);
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Create margin account
     * @param collateralToken Token to use as collateral
     * @param collateralAmount Amount of collateral to deposit
     */
    function createMarginAccount(
        address collateralToken,
        uint256 collateralAmount
    ) external whenNotPaused nonReentrant {
        require(collateralToken != address(0), "ThaliumMarginVault: Invalid token");
        require(collateralAmount > 0, "ThaliumMarginVault: Invalid amount");
        require(!marginAccounts[msg.sender].isActive, "ThaliumMarginVault: Account exists");

        // Transfer collateral
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Create margin account
        marginAccounts[msg.sender] = MarginAccount({
            user: msg.sender,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            borrowedAmount: 0,
            leverage: 0,
            liquidationPrice: 0,
            maintenanceMargin: 0,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        userTotalMargin[msg.sender] = collateralAmount;
        totalMarginDeposited += collateralAmount;

        emit MarginAccountCreated(msg.sender, collateralToken, collateralAmount, MAX_LEVERAGE);
    }

    /**
     * @dev Open margin position
     * @param asset Asset to trade
     * @param size Position size
     * @param leverage Leverage multiplier
     * @param isLong True for long position, false for short
     * @param entryPrice Entry price (off-chain validated)
     */
    function openPosition(
        address asset,
        uint256 size,
        uint256 leverage,
        bool isLong,
        uint256 entryPrice
    ) external whenNotPaused nonReentrant {
        require(marginAccounts[msg.sender].isActive, "ThaliumMarginVault: No margin account");
        require(supportedAssets[asset], "ThaliumMarginVault: Asset not supported");
        require(leverage >= MIN_LEVERAGE && leverage <= assetMaxLeverage[asset], "ThaliumMarginVault: Invalid leverage");
        require(size > 0, "ThaliumMarginVault: Invalid size");
        require(entryPrice > 0, "ThaliumMarginVault: Invalid price");

        MarginAccount storage account = marginAccounts[msg.sender];
        
        // Calculate required margin
        uint256 requiredMargin = (size * entryPrice) / leverage;
        require(account.collateralAmount >= requiredMargin, "ThaliumMarginVault: Insufficient margin");

        // Calculate borrowed amount
        uint256 borrowedAmount = (size * entryPrice) - requiredMargin;
        
        // Update account
        account.borrowedAmount += borrowedAmount;
        account.leverage = leverage;
        account.lastUpdated = block.timestamp;

        // Calculate liquidation price
        uint256 liquidationPrice = _calculateLiquidationPrice(
            size,
            entryPrice,
            leverage,
            isLong,
            assetLiquidationThreshold[asset]
        );
        account.liquidationPrice = liquidationPrice;

        // Create position
        Position memory position = Position({
            user: msg.sender,
            asset: asset,
            size: size,
            entryPrice: entryPrice,
            leverage: leverage,
            isLong: isLong,
            marginUsed: requiredMargin,
            unrealizedPnL: 0,
            realizedPnL: 0,
            isActive: true,
            openedAt: block.timestamp,
            closedAt: 0
        });

        userPositions[msg.sender].push(position);
        userTotalBorrowed[msg.sender] += borrowedAmount;
        totalBorrowed += borrowedAmount;

        emit PositionOpened(msg.sender, asset, size, entryPrice, leverage, isLong);
    }

    /**
     * @dev Close position
     * @param positionIndex Index of position to close
     * @param exitPrice Exit price (off-chain validated)
     */
    function closePosition(
        uint256 positionIndex,
        uint256 exitPrice
    ) external whenNotPaused nonReentrant {
        require(positionIndex < userPositions[msg.sender].length, "ThaliumMarginVault: Invalid position");
        
        Position storage position = userPositions[msg.sender][positionIndex];
        require(position.isActive, "ThaliumMarginVault: Position not active");
        require(exitPrice > 0, "ThaliumMarginVault: Invalid price");

        // Calculate PnL with proper loss handling
        int256 realizedPnL;
        if (position.isLong) {
            // Long position: profit when exitPrice > entryPrice
            if (exitPrice >= position.entryPrice) {
                realizedPnL = int256((position.size * exitPrice) - (position.size * position.entryPrice));
            } else {
                // Loss: calculate as negative value
                realizedPnL = -int256((position.size * position.entryPrice) - (position.size * exitPrice));
            }
        } else {
            // Short position: profit when entryPrice > exitPrice
            if (position.entryPrice >= exitPrice) {
                realizedPnL = int256((position.size * position.entryPrice) - (position.size * exitPrice));
            } else {
                // Loss: calculate as negative value
                realizedPnL = -int256((position.size * exitPrice) - (position.size * position.entryPrice));
            }
        }

        // Update account with proper PnL handling
        MarginAccount storage account = marginAccounts[msg.sender];
        if (realizedPnL >= 0) {
            // Profit: add to collateral
            account.collateralAmount = account.collateralAmount + uint256(realizedPnL) - position.marginUsed;
        } else {
            // Loss: subtract from collateral (ensure no underflow)
            uint256 loss = uint256(-realizedPnL);
            require(account.collateralAmount >= loss + position.marginUsed, "ThaliumMarginVault: Insufficient collateral for loss");
            account.collateralAmount = account.collateralAmount - loss - position.marginUsed;
        }
        account.borrowedAmount -= (position.size * position.entryPrice) - position.marginUsed;
        account.lastUpdated = block.timestamp;

        // Update totals
        userTotalBorrowed[msg.sender] -= (position.size * position.entryPrice) - position.marginUsed;
        totalBorrowed -= (position.size * position.entryPrice) - position.marginUsed;

        // Close position
        position.isActive = false;
        position.closedAt = block.timestamp;
        position.realizedPnL = realizedPnL >= 0 ? uint256(realizedPnL) : 0; // Store absolute value for events

        emit PositionClosed(msg.sender, position.asset, position.size, exitPrice, realizedPnL >= 0 ? uint256(realizedPnL) : 0);
    }

    /**
     * @dev Liquidate position (only liquidators)
     * @param user User to liquidate
     * @param positionIndex Position to liquidate
     * @param liquidationPrice Liquidation price
     */
    function liquidatePosition(
        address user,
        uint256 positionIndex,
        uint256 liquidationPrice
    ) external onlyRole(LIQUIDATOR_ROLE) whenNotPaused nonReentrant {
        require(positionIndex < userPositions[user].length, "ThaliumMarginVault: Invalid position");
        
        Position storage position = userPositions[user][positionIndex];
        require(position.isActive, "ThaliumMarginVault: Position not active");

        MarginAccount storage account = marginAccounts[user];
        require(account.isActive, "ThaliumMarginVault: No margin account");

        // Check if position should be liquidated
        require(_shouldLiquidate(position, liquidationPrice), "ThaliumMarginVault: Position not liquidatable");

        // Calculate liquidation amount
        uint256 liquidatedAmount = (position.size * liquidationPrice * liquidationPenalty) / PRECISION;

        // Update account
        account.collateralAmount -= liquidatedAmount;
        account.borrowedAmount -= (position.size * position.entryPrice) - position.marginUsed;
        account.lastUpdated = block.timestamp;

        // Update totals
        userTotalBorrowed[user] -= (position.size * position.entryPrice) - position.marginUsed;
        totalBorrowed -= (position.size * position.entryPrice) - position.marginUsed;

        // Close position
        position.isActive = false;
        position.closedAt = block.timestamp;

        // Record liquidation
        LiquidationEvent memory liquidation = LiquidationEvent({
            user: user,
            asset: position.asset,
            positionSize: position.size,
            liquidationPrice: liquidationPrice,
            liquidatedAmount: liquidatedAmount,
            timestamp: block.timestamp
        });

        liquidationEvents.push(liquidation);
        uint256 liquidationId = nextLiquidationId++;

        emit LiquidationExecuted(liquidationId, user, position.asset, liquidatedAmount, liquidationPrice);
    }

    /**
     * @dev Deposit additional margin
     * @param amount Amount to deposit
     */
    function depositMargin(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "ThaliumMarginVault: Invalid amount");
        require(marginAccounts[msg.sender].isActive, "ThaliumMarginVault: No margin account");

        MarginAccount storage account = marginAccounts[msg.sender];
        
        // Transfer collateral
        IERC20(account.collateralToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update account
        account.collateralAmount += amount;
        account.lastUpdated = block.timestamp;

        userTotalMargin[msg.sender] += amount;
        totalMarginDeposited += amount;

        emit MarginDeposited(msg.sender, account.collateralToken, amount);
    }

    /**
     * @dev Withdraw margin (only if safe)
     * @param amount Amount to withdraw
     */
    function withdrawMargin(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "ThaliumMarginVault: Invalid amount");
        require(marginAccounts[msg.sender].isActive, "ThaliumMarginVault: No margin account");

        MarginAccount storage account = marginAccounts[msg.sender];
        require(account.collateralAmount >= amount, "ThaliumMarginVault: Insufficient balance");

        // Check if withdrawal is safe (no active positions or sufficient margin remaining)
        require(_canWithdraw(msg.sender, amount), "ThaliumMarginVault: Withdrawal not safe");

        // Update account
        account.collateralAmount -= amount;
        account.lastUpdated = block.timestamp;

        userTotalMargin[msg.sender] -= amount;
        totalMarginDeposited -= amount;

        // Transfer collateral
        IERC20(account.collateralToken).safeTransfer(msg.sender, amount);

        emit MarginWithdrawn(msg.sender, account.collateralToken, amount);
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    /**
     * @dev Add supported asset
     * @param asset Asset address
     * @param maxLeverage Maximum leverage for this asset
     * @param liquidationThreshold Liquidation threshold (in basis points)
     */
    function addSupportedAsset(
        address asset,
        uint256 maxLeverage,
        uint256 liquidationThreshold
    ) external onlyRole(MARGIN_ADMIN_ROLE) {
        require(asset != address(0), "ThaliumMarginVault: Invalid asset");
        require(maxLeverage <= MAX_LEVERAGE, "ThaliumMarginVault: Leverage too high");
        require(liquidationThreshold > 0 && liquidationThreshold < PRECISION, "ThaliumMarginVault: Invalid threshold");

        supportedAssets[asset] = true;
        assetMaxLeverage[asset] = maxLeverage;
        assetLiquidationThreshold[asset] = liquidationThreshold;
    }

    /**
     * @dev Remove supported asset
     * @param asset Asset address
     */
    function removeSupportedAsset(address asset) external onlyRole(MARGIN_ADMIN_ROLE) {
        require(asset != address(0), "ThaliumMarginVault: Invalid asset");
        supportedAssets[asset] = false;
    }

    /**
     * @dev Set liquidation penalty
     * @param penalty New penalty (in basis points)
     */
    function setLiquidationPenalty(uint256 penalty) external onlyRole(MARGIN_ADMIN_ROLE) {
        require(penalty <= 1000, "ThaliumMarginVault: Penalty too high"); // Max 10%
        liquidationPenalty = penalty;
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
     * @dev Get user margin account
     * @param user User address
     */
    function getMarginAccount(address user) external view returns (MarginAccount memory) {
        return marginAccounts[user];
    }

    /**
     * @dev Get user positions
     * @param user User address
     */
    function getUserPositions(address user) external view returns (Position[] memory) {
        return userPositions[user];
    }

    /**
     * @dev Get liquidation events
     * @param offset Starting index
     * @param limit Maximum results
     */
    function getLiquidationEvents(
        uint256 offset,
        uint256 limit
    ) external view returns (LiquidationEvent[] memory) {
        uint256 totalEvents = liquidationEvents.length;
        
        if (offset >= totalEvents) {
            return new LiquidationEvent[](0);
        }

        uint256 endIndex = offset + limit;
        if (endIndex > totalEvents) {
            endIndex = totalEvents;
        }

        uint256 resultLength = endIndex - offset;
        LiquidationEvent[] memory result = new LiquidationEvent[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = liquidationEvents[offset + i];
        }

        return result;
    }

    /**
     * @dev Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 totalMargin,
        uint256 totalBorrowedAmount,
        uint256 utilizationRate,
        uint256 liquidationCount
    ) {
        totalMargin = totalMarginDeposited;
        totalBorrowedAmount = totalBorrowed;
        utilizationRate = totalMargin > 0 ? (totalBorrowed * PRECISION) / totalMargin : 0;
        liquidationCount = liquidationEvents.length;
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Calculate liquidation price
     */
    function _calculateLiquidationPrice(
        uint256 /* size */,
        uint256 entryPrice,
        uint256 leverage,
        bool isLong,
        uint256 threshold
    ) internal pure returns (uint256) {
        uint256 marginRatio = PRECISION / leverage;
        uint256 liquidationRatio = threshold;

        if (isLong) {
            return entryPrice * (PRECISION - liquidationRatio + marginRatio) / PRECISION;
        } else {
            return entryPrice * (PRECISION + liquidationRatio - marginRatio) / PRECISION;
        }
    }

    /**
     * @dev Check if position should be liquidated
     */
    function _shouldLiquidate(
        Position memory position,
        uint256 currentPrice
    ) internal view returns (bool) {
        if (position.isLong) {
            return currentPrice <= position.entryPrice * (PRECISION - assetLiquidationThreshold[position.asset]) / PRECISION;
        } else {
            return currentPrice >= position.entryPrice * (PRECISION + assetLiquidationThreshold[position.asset]) / PRECISION;
        }
    }

    /**
     * @dev Check if user can withdraw margin
     */
    function _canWithdraw(address user, uint256 amount) internal view returns (bool) {
        Position[] memory positions = userPositions[user];
        
        // If no active positions, can withdraw
        bool hasActivePositions = false;
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].isActive) {
                hasActivePositions = true;
                break;
            }
        }

        if (!hasActivePositions) {
            return true;
        }

        // Check if remaining margin is sufficient for active positions
        MarginAccount memory account = marginAccounts[user];
        uint256 remainingMargin = account.collateralAmount - amount;
        
        // Calculate total margin required for active positions
        uint256 requiredMargin = 0;
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].isActive) {
                requiredMargin += positions[i].marginUsed;
            }
        }

        return remainingMargin >= requiredMargin;
    }
}
