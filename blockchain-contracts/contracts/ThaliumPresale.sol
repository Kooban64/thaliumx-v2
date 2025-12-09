// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IThaliumVesting
 * @dev Interface for ThaliumVesting contract integration
 */
interface IThaliumVesting {
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable,
        bytes32 category
    ) external returns (bytes32);
}

/**
 * @title ThaliumPresale
 * @dev Presale contract for Thalium token sales
 *
 * This contract handles:
 * - USDT-only payments
 * - Token allocation and vesting
 * - Emergency controls
 * - Off-chain validation integration
 *
 * Security Model:
 * - On-chain: Payment processing and token allocation
 * - Off-chain: KYC verification, purchase limits, eligibility checks
 *
 * @author Thalium Development Team
 */
contract ThaliumPresale is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant PRESALE_MANAGER_ROLE = keccak256("PRESALE_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    uint256 public constant MIN_PURCHASE = 100 * 10**6; // 100 USDT (6 decimals)
    uint256 public constant MAX_PURCHASE = 10000 * 10**6; // 10,000 USDT
    uint256 public constant PRESALE_DURATION = 90 days;

    // ========================================
    // STATE VARIABLES
    // ========================================

    IERC20 public immutable usdtToken;
    IERC20 public immutable thalToken;

    uint256 public presaleStartTime;
    uint256 public presaleEndTime;

    uint256 public totalTokensSold;
    uint256 public totalUsdtRaised;

    // Purchase tracking
    mapping(address => uint256) public userPurchases; // USDT amount purchased
    mapping(address => uint256) public userAllocations; // THAL tokens allocated

    // Vesting integration
    address public vestingContract;

    // ========================================
    // EVENTS
    // ========================================

    event PresaleStarted(uint256 startTime, uint256 endTime);
    event TokensPurchased(
        address indexed buyer,
        uint256 usdtAmount,
        uint256 thalAmount,
        bytes32 vestingScheduleId
    );
    event PresaleEnded(uint256 totalTokensSold, uint256 totalUsdtRaised);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize presale contract
     * @param usdtTokenAddress USDT token contract address
     * @param thalTokenAddress THAL token contract address
     * @param defaultAdmin Default admin address
     * @param presaleManager Presale manager address
     * @param complianceOfficer Compliance officer address
     */
    constructor(
        address usdtTokenAddress,
        address thalTokenAddress,
        address defaultAdmin,
        address presaleManager,
        address complianceOfficer
    ) {
        require(usdtTokenAddress != address(0), "ThaliumPresale: Invalid USDT address");
        require(thalTokenAddress != address(0), "ThaliumPresale: Invalid THAL address");
        require(defaultAdmin != address(0), "ThaliumPresale: Invalid default admin");
        require(presaleManager != address(0), "ThaliumPresale: Invalid presale manager");
        require(complianceOfficer != address(0), "ThaliumPresale: Invalid compliance officer");

        usdtToken = IERC20(usdtTokenAddress);
        thalToken = IERC20(thalTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PRESALE_MANAGER_ROLE, presaleManager);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Start presale
     * @param startTime Presale start timestamp (0 = now)
     */
    function startPresale(uint256 startTime)
        external
        onlyRole(PRESALE_MANAGER_ROLE)
    {
        require(presaleStartTime == 0, "ThaliumPresale: Presale already started");

        uint256 actualStartTime = startTime == 0 ? block.timestamp : startTime;
        require(actualStartTime >= block.timestamp, "ThaliumPresale: Cannot start in past");

        presaleStartTime = actualStartTime;
        presaleEndTime = actualStartTime + PRESALE_DURATION;

        emit PresaleStarted(presaleStartTime, presaleEndTime);
    }

    /**
     * @dev Purchase tokens with USDT
     * @param usdtAmount Amount of USDT to spend
     *
     * Note: This function assumes off-chain validation has occurred
     * for KYC, purchase limits, and eligibility
     */
    function purchaseTokens(uint256 usdtAmount)
        external
        whenNotPaused
        nonReentrant
    {
        // Basic validation
        require(presaleStartTime > 0, "ThaliumPresale: Presale not started");
        require(block.timestamp >= presaleStartTime, "ThaliumPresale: Presale not active");
        require(block.timestamp <= presaleEndTime, "ThaliumPresale: Presale ended");
        require(usdtAmount >= MIN_PURCHASE, "ThaliumPresale: Amount too small");
        require(usdtAmount <= MAX_PURCHASE, "ThaliumPresale: Amount too large");

        // Check user hasn't exceeded limits (off-chain validation assumed)
        require(
            userPurchases[msg.sender] + usdtAmount <= MAX_PURCHASE,
            "ThaliumPresale: Would exceed user limit"
        );

        // Calculate THAL tokens (1 USDT = 100 THAL)
        // CRITICAL FIX: Properly convert from USDT (6 decimals) to THAL (18 decimals)
        // usdtAmount is in 6 decimals, need to convert to 18 decimals and multiply by 100
        uint256 thalAmount = (usdtAmount * 100 * 10**12); // Correct conversion: 6 decimals -> 18 decimals with 100x multiplier

        // Check contract has enough THAL tokens
        require(
            thalToken.balanceOf(address(this)) >= thalAmount,
            "ThaliumPresale: Insufficient THAL balance"
        );

        // Transfer USDT from buyer
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);

        // Update tracking
        userPurchases[msg.sender] += usdtAmount;
        userAllocations[msg.sender] += thalAmount;
        totalUsdtRaised += usdtAmount;
        totalTokensSold += thalAmount;

        // Create vesting schedule if vesting contract is set
        bytes32 vestingScheduleId = bytes32(0);
        if (vestingContract != address(0)) {
            vestingScheduleId = _createVestingSchedule(msg.sender, thalAmount);
        } else {
            // Direct transfer if no vesting
            thalToken.safeTransfer(msg.sender, thalAmount);
        }

        emit TokensPurchased(msg.sender, usdtAmount, thalAmount, vestingScheduleId);
    }

    /**
     * @dev Set vesting contract address
     * @param vestingAddr Vesting contract address
     */
    function setVestingContract(address vestingAddr)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(vestingAddr != address(0), "ThaliumPresale: Invalid vesting address");
        vestingContract = vestingAddr;
    }

    /**
     * @dev Withdraw collected USDT (only admin)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUsdt(uint256 amount, address recipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        require(recipient != address(0), "ThaliumPresale: Invalid recipient");
        require(amount > 0, "ThaliumPresale: Amount must be positive");
        require(usdtToken.balanceOf(address(this)) >= amount, "ThaliumPresale: Insufficient balance");

        usdtToken.safeTransfer(recipient, amount);
    }

    /**
     * @dev Withdraw unsold THAL tokens (only admin)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUnsoldTokens(uint256 amount, address recipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        require(recipient != address(0), "ThaliumPresale: Invalid recipient");
        require(amount > 0, "ThaliumPresale: Amount must be positive");
        require(thalToken.balanceOf(address(this)) >= amount, "ThaliumPresale: Insufficient balance");

        thalToken.safeTransfer(recipient, amount);
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
     * @dev Check if presale is active
     */
    function isPresaleActive() external view returns (bool) {
        return presaleStartTime > 0 &&
               block.timestamp >= presaleStartTime &&
               block.timestamp <= presaleEndTime;
    }

    /**
     * @dev Get presale status
     */
    function getPresaleStatus() external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 tokensSold,
        uint256 usdtRaised,
        bool isActive
    ) {
        return (
            presaleStartTime,
            presaleEndTime,
            totalTokensSold,
            totalUsdtRaised,
            this.isPresaleActive()
        );
    }

    /**
     * @dev Get user purchase info
     * @param user User address
     */
    function getUserPurchaseInfo(address user) external view returns (
        uint256 usdtPurchased,
        uint256 thalAllocated,
        uint256 remainingLimit
    ) {
        uint256 purchased = userPurchases[user];
        uint256 remaining = purchased >= MAX_PURCHASE ? 0 : MAX_PURCHASE - purchased;

        return (purchased, userAllocations[user], remaining);
    }

    /**
     * @dev Calculate THAL amount for USDT input
     * @param usdtAmount USDT amount in smallest units
     */
    function calculateThalAmount(uint256 usdtAmount) external pure returns (uint256) {
        return usdtAmount * 100 / 10**6; // 1 USDT = 100 THAL
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Create vesting schedule for purchased tokens
     * @param beneficiary Token recipient
     * @param amount THAL token amount
     * @return scheduleId Vesting schedule identifier
     */
    function _createVestingSchedule(address beneficiary, uint256 amount)
        internal
        returns (bytes32)
    {
        require(vestingContract != address(0), "ThaliumPresale: Vesting contract not set");

        // Call actual ThaliumVesting contract
        IThaliumVesting vesting = IThaliumVesting(vestingContract);

        // Create 90-day linear vesting with 30-day cliff
        // This matches the presale terms: tokens vest over 3 months
        bytes32 scheduleId = vesting.createVestingSchedule(
            beneficiary,           // Who receives the tokens
            amount,                // Total THAL amount
            block.timestamp,       // Start vesting immediately
            30 days,               // 30-day cliff period
            90 days,               // 90-day total vesting duration
            false,                 // Not revocable (presale purchases are final)
            "presale"              // Category identifier
        );

        return scheduleId;
    }
}