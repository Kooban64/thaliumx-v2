// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ThaliumOracle
 * @dev Price oracle for Thalium ecosystem
 *
 * This contract provides secure price feeds with:
 * - Multiple price sources for redundancy
 * - Circuit breaker protection
 * - Emergency fallback prices
 * - Admin controls for price updates
 *
 * Security Model:
 * - On-chain: Price validation and circuit breakers
 * - Off-chain: Price feed monitoring and updates
 *
 * @author Thalium Development Team
 */
contract ThaliumOracle is AccessControl, Pausable {
    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    uint256 public constant MAX_PRICE_AGE = 24 hours;
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 50; // 50% price change threshold
    uint256 public constant EMERGENCY_PRICE_VALIDITY = 7 days;

    // ========================================
    // STRUCTS
    // ========================================

    struct PriceData {
        uint256 price;        // Price in USD with 8 decimals (e.g., 100000000 = $1.00)
        uint256 timestamp;    // When price was last updated
        uint256 blockNumber;  // Block number when updated
        address updater;      // Address that updated the price
        bool isEmergency;     // Whether this is an emergency price
    }

    struct PriceFeed {
        bytes32 symbol;       // Price symbol (e.g., "USDT", "THAL")
        PriceData primary;    // Primary price source
        PriceData secondary;  // Secondary price source for validation
        uint256 emergencyPrice; // Emergency fallback price
        uint256 lastEmergencyUpdate; // When emergency price was set
        bool circuitBreaker;  // Whether circuit breaker is active
    }

    // ========================================
    // STATE VARIABLES
    // ========================================

    mapping(bytes32 => PriceFeed) public priceFeeds;
    bytes32[] public supportedSymbols;

    // ========================================
    // EVENTS
    // ========================================

    event PriceUpdated(
        bytes32 indexed symbol,
        uint256 price,
        address indexed updater,
        bool isEmergency
    );

    event CircuitBreakerTriggered(bytes32 indexed symbol, uint256 oldPrice, uint256 newPrice);
    event CircuitBreakerReset(bytes32 indexed symbol);
    event EmergencyPriceSet(bytes32 indexed symbol, uint256 price);
    event SymbolAdded(bytes32 indexed symbol);
    event SymbolRemoved(bytes32 indexed symbol);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize oracle contract
     * @param defaultAdmin Default admin address
     * @param oracleAdmin Oracle admin address
     * @param priceUpdater Price updater address
     */
    constructor(
        address defaultAdmin,
        address oracleAdmin,
        address priceUpdater
    ) {
        require(defaultAdmin != address(0), "ThaliumOracle: Invalid default admin");
        require(oracleAdmin != address(0), "ThaliumOracle: Invalid oracle admin");
        require(priceUpdater != address(0), "ThaliumOracle: Invalid price updater");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ORACLE_ADMIN_ROLE, oracleAdmin);
        _grantRole(PRICE_UPDATER_ROLE, priceUpdater);

        // Initialize with USDT price feed
        _addSymbol("USDT");
        priceFeeds["USDT"].emergencyPrice = 100000000; // $1.00
        priceFeeds["USDT"].lastEmergencyUpdate = block.timestamp;
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Update price for a symbol
     * @param symbol Price symbol
     * @param price New price (8 decimals)
     * @param isPrimary Whether this is primary or secondary feed
     */
    function updatePrice(
        bytes32 symbol,
        uint256 price,
        bool isPrimary
    )
        external
        onlyRole(PRICE_UPDATER_ROLE)
        whenNotPaused
    {
        require(price > 0, "ThaliumOracle: Invalid price");
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];

        // Check for circuit breaker
        if (!feed.circuitBreaker) {
            uint256 currentPrice = _getEffectivePrice(feed);
            if (currentPrice > 0) {
                uint256 priceChange = _calculatePriceChange(currentPrice, price);
                if (priceChange >= CIRCUIT_BREAKER_THRESHOLD) {
                    feed.circuitBreaker = true;
                    emit CircuitBreakerTriggered(symbol, currentPrice, price);
                    return; // Don't update price when circuit breaker triggers
                }
            }
        }

        // Update price
        PriceData storage priceData = isPrimary ? feed.primary : feed.secondary;
        priceData.price = price;
        priceData.timestamp = block.timestamp;
        priceData.blockNumber = block.number;
        priceData.updater = msg.sender;
        priceData.isEmergency = false;

        emit PriceUpdated(symbol, price, msg.sender, false);
    }

    /**
     * @dev Set emergency price (admin only)
     * @param symbol Price symbol
     * @param price Emergency price
     */
    function setEmergencyPrice(bytes32 symbol, uint256 price)
        external
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        require(price > 0, "ThaliumOracle: Invalid emergency price");
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];
        feed.emergencyPrice = price;
        feed.lastEmergencyUpdate = block.timestamp;

        emit EmergencyPriceSet(symbol, price);
    }

    /**
     * @dev Reset circuit breaker
     * @param symbol Price symbol
     */
    function resetCircuitBreaker(bytes32 symbol)
        external
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];
        require(feed.circuitBreaker, "ThaliumOracle: Circuit breaker not active");

        feed.circuitBreaker = false;
        emit CircuitBreakerReset(symbol);
    }

    /**
     * @dev Add supported symbol
     * @param symbol Price symbol to add
     */
    function addSymbol(bytes32 symbol)
        external
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        require(!_symbolExists(symbol), "ThaliumOracle: Symbol already exists");
        require(symbol != bytes32(0), "ThaliumOracle: Invalid symbol");

        _addSymbol(symbol);
    }

    /**
     * @dev Remove supported symbol
     * @param symbol Price symbol to remove
     */
    function removeSymbol(bytes32 symbol)
        external
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        _removeSymbol(symbol);
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
    // PUBLIC VIEW FUNCTIONS
    // ========================================

    /**
     * @dev Get latest price for symbol
     * @param symbol Price symbol
     */
    function getPrice(bytes32 symbol) external view returns (uint256) {
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];

        // Check circuit breaker
        if (feed.circuitBreaker) {
            return feed.emergencyPrice;
        }

        uint256 effectivePrice = _getEffectivePrice(feed);
        require(effectivePrice > 0, "ThaliumOracle: No valid price available");

        return effectivePrice;
    }

    /**
     * @dev Get price data for symbol
     * @param symbol Price symbol
     */
    function getPriceData(bytes32 symbol)
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            uint256 blockNumber,
            address updater,
            bool isEmergency,
            bool circuitBreakerActive
        )
    {
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];
        PriceData storage priceData = _getEffectivePriceData(feed);

        return (
            priceData.price,
            priceData.timestamp,
            priceData.blockNumber,
            priceData.updater,
            priceData.isEmergency,
            feed.circuitBreaker
        );
    }

    /**
     * @dev Check if price is fresh
     * @param symbol Price symbol
     */
    function isPriceFresh(bytes32 symbol) external view returns (bool) {
        if (!_symbolExists(symbol)) return false;

        PriceFeed storage feed = priceFeeds[symbol];
        if (feed.circuitBreaker) return true; // Emergency price is always "fresh"

        PriceData storage priceData = _getEffectivePriceData(feed);
        return priceData.timestamp > 0 &&
               block.timestamp <= priceData.timestamp + MAX_PRICE_AGE;
    }

    /**
     * @dev Get multiple prices
     * @param symbols Array of price symbols
     */
    function getPrices(bytes32[] calldata symbols)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory prices = new uint256[](symbols.length);

        for (uint256 i = 0; i < symbols.length; i++) {
            prices[i] = this.getPrice(symbols[i]);
        }

        return prices;
    }

    /**
     * @dev Get supported symbols
     */
    function getSupportedSymbols() external view returns (bytes32[] memory) {
        return supportedSymbols;
    }

    /**
     * @dev Get emergency price info
     * @param symbol Price symbol
     */
    function getEmergencyPriceInfo(bytes32 symbol)
        external
        view
        returns (uint256 emergencyPrice, uint256 lastUpdate, bool isValid)
    {
        require(_symbolExists(symbol), "ThaliumOracle: Symbol not supported");

        PriceFeed storage feed = priceFeeds[symbol];
        bool valid = block.timestamp <= feed.lastEmergencyUpdate + EMERGENCY_PRICE_VALIDITY;

        return (feed.emergencyPrice, feed.lastEmergencyUpdate, valid);
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Get effective price (prioritizes primary, falls back to secondary)
     */
    function _getEffectivePrice(PriceFeed storage feed)
        internal
        view
        returns (uint256)
    {
        // Try primary price first
        if (_isPriceValid(feed.primary)) {
            return feed.primary.price;
        }

        // Fall back to secondary price
        if (_isPriceValid(feed.secondary)) {
            return feed.secondary.price;
        }

        // Fall back to emergency price
        if (feed.emergencyPrice > 0 &&
            block.timestamp <= feed.lastEmergencyUpdate + EMERGENCY_PRICE_VALIDITY) {
            return feed.emergencyPrice;
        }

        return 0; // No valid price available
    }

    /**
     * @dev Get effective price data
     */
    function _getEffectivePriceData(PriceFeed storage feed)
        internal
        view
        returns (PriceData storage)
    {
        if (_isPriceValid(feed.primary)) {
            return feed.primary;
        }

        if (_isPriceValid(feed.secondary)) {
            return feed.secondary;
        }

        // Return primary as fallback (even if invalid)
        return feed.primary;
    }

    /**
     * @dev Check if price data is valid
     */
    function _isPriceValid(PriceData storage priceData)
        internal
        view
        returns (bool)
    {
        return priceData.timestamp > 0 &&
               block.timestamp <= priceData.timestamp + MAX_PRICE_AGE &&
               !priceData.isEmergency;
    }

    /**
     * @dev Calculate price change percentage
     */
    function _calculatePriceChange(uint256 oldPrice, uint256 newPrice)
        internal
        pure
        returns (uint256)
    {
        if (oldPrice == 0) return 0;

        uint256 diff = oldPrice > newPrice ? oldPrice - newPrice : newPrice - oldPrice;
        return (diff * 100) / oldPrice;
    }

    /**
     * @dev Check if symbol exists
     */
    function _symbolExists(bytes32 symbol) internal view returns (bool) {
        for (uint256 i = 0; i < supportedSymbols.length; i++) {
            if (supportedSymbols[i] == symbol) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Add symbol to supported list
     */
    function _addSymbol(bytes32 symbol) internal {
        supportedSymbols.push(symbol);
        priceFeeds[symbol].emergencyPrice = 100000000; // Default $1.00
        priceFeeds[symbol].lastEmergencyUpdate = block.timestamp;

        emit SymbolAdded(symbol);
    }

    /**
     * @dev Remove symbol from supported list
     */
    function _removeSymbol(bytes32 symbol) internal {
        for (uint256 i = 0; i < supportedSymbols.length; i++) {
            if (supportedSymbols[i] == symbol) {
                supportedSymbols[i] = supportedSymbols[supportedSymbols.length - 1];
                supportedSymbols.pop();
                break;
            }
        }

        delete priceFeeds[symbol];
        emit SymbolRemoved(symbol);
    }
}