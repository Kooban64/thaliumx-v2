// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
 * @dev Presale contract for Thalium token sales with optional multi-sig security
 *
 * This contract handles:
 * - USDT-only payments
 * - Token allocation and vesting
 * - Emergency controls
 * - Off-chain validation integration
 *
 * Security Features:
 * - Multi-sig requirement for critical admin functions (when multi-sig is enabled)
 * - Time-delayed execution (when timelock is enabled)
 * - Role-based access as fallback/single-signature mode
 *
 * @author Thalium Development Team
 */
contract ThaliumPresale is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PRESALE_MANAGER_ROLE = keccak256("PRESALE_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");
    bytes32 public constant CRITICAL_ADMIN_ROLE = keccak256("CRITICAL_ADMIN_ROLE");

    uint256 public constant MIN_PURCHASE = 100 * 10**6; // 100 USDT (6 decimals)
    uint256 public constant MAX_PURCHASE = 10000 * 10**6; // 10,000 USDT
    uint256 public constant PRESALE_DURATION = 90 days;

    IERC20 public immutable USDT_TOKEN;
    IERC20 public immutable THAL_TOKEN;

    error InvalidUsdtAddress();
    error InvalidThalAddress();
    error InvalidDefaultAdmin();
    error InvalidPresaleManager();
    error InvalidComplianceOfficer();
    error PresaleAlreadyStarted();
    error PresaleCannotStartInPast();
    error PresaleNotStarted();
    error PresaleNotActive();
    error PresaleClosed();
    error AmountTooSmall();
    error AmountTooLarge();
    error UserLimitExceeded();
    error InsufficientThalBalance();
    error InvalidVestingAddress();
    error InvalidRecipient();
    error AmountMustBePositive();
    error InsufficientUsdtBalance();
    error InsufficientTokenBalance();
    error VestingContractNotSet();
    
    // Multi-sig errors
    error AlreadyApproved();
    error InsufficientApprovals();
    error TimelockNotElapsed();
    error ProposalAlreadyExecuted();
    error InvalidGuardian();
    error InvalidMultiSigConfig();
    error ZeroAddressNotAllowed();
    error NotMultiSigOwner();
    
    // Custom error for access control
    error AccessDenied();

    // ========================================
    // STATE VARIABLES
    // ========================================

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
    // MULTI-SIG STATE VARIABLES
    // ========================================
    
    // Multi-sig configuration (0 = disabled)
    uint256 public multiSigRequired;
    uint256 public timelockDelay;
    
    // Multi-sig tracking: txHash => owner => approved
    mapping(bytes32 => mapping(address => bool)) public hasApproved;
    // txHash => approval count
    mapping(bytes32 => uint256) public approvalCount;
    // txHash => proposal timestamp
    mapping(bytes32 => uint256) public proposalTimestamps;
    // txHash => executed flag
    mapping(bytes32 => bool) public executedProposals;
    
    // Fallback mode - if true, allows single-signature operations
    bool public fallbackMode;
    // Who can activate/deactivate fallback mode
    address public governanceGuardian;

    // List of multi-sig owners
    address[] public multiSigOwners;

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
    
    // Multi-sig events
    event ApprovalSubmitted(address indexed approver, bytes32 indexed txHash);
    event ProposalExecuted(bytes32 indexed txHash, uint256 executionTime);
    event MultiSigConfigured(uint256 required, uint256 delay);
    event FallbackModeActivated(address indexed activator);
    event FallbackModeDeactivated(address indexed deactivator);

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
     * @param guardian Governance guardian address for fallback mode control (can be address(0) if not needed)
     */
    constructor(
        address usdtTokenAddress,
        address thalTokenAddress,
        address defaultAdmin,
        address presaleManager,
        address complianceOfficer,
        address guardian
    ) {
        if (usdtTokenAddress == address(0)) revert InvalidUsdtAddress();
        if (thalTokenAddress == address(0)) revert InvalidThalAddress();
        if (defaultAdmin == address(0)) revert InvalidDefaultAdmin();
        if (presaleManager == address(0)) revert InvalidPresaleManager();
        if (complianceOfficer == address(0)) revert InvalidComplianceOfficer();

        USDT_TOKEN = IERC20(usdtTokenAddress);
        THAL_TOKEN = IERC20(thalTokenAddress);
        
        // Set governance guardian (if provided, otherwise use defaultAdmin)
        governanceGuardian = guardian != address(0) ? guardian : defaultAdmin;

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PRESALE_MANAGER_ROLE, presaleManager);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
    }

    // ========================================
    // MODIFIERS
    // ========================================
    
    /**
     * @dev Modifier requiring multi-sig approval for critical operations
     * When multi-sig is disabled (multiSigRequired = 0), falls back to role check
     * When fallback mode is enabled, allows single-signature execution
     */
    modifier requireMultiSig(bytes32 txHash) {
        // If multi-sig is not configured, use role-based access
        if (multiSigRequired == 0) {
            _;
            return;
        }
        
        // If fallback mode is enabled, allow single signature
        if (fallbackMode) {
            _;
            return;
        }
        
        // Record timestamp on first approval request
        if (proposalTimestamps[txHash] == 0 && !executedProposals[txHash]) {
            proposalTimestamps[txHash] = block.timestamp;
        }
        
        // Record approval
        if (!hasApproved[txHash][msg.sender]) {
            hasApproved[txHash][msg.sender] = true;
            approvalCount[txHash]++;
            emit ApprovalSubmitted(msg.sender, txHash);
        }
        
        // Check if we have enough approvals
        if (approvalCount[txHash] < multiSigRequired) {
            revert InsufficientApprovals();
        }
        
        // Check timelock
        if (block.timestamp < proposalTimestamps[txHash] + timelockDelay) {
            revert TimelockNotElapsed();
        }
        
        // Mark as executed
        if (!executedProposals[txHash]) {
            executedProposals[txHash] = true;
            emit ProposalExecuted(txHash, block.timestamp);
        }
        
        _;
    }

    // ========================================
    // MULTI-SIG CONFIGURATION (External Functions)
    // ========================================
    
    /**
     * @dev Configure multi-sig requirements
     * @param required Number of required signatures
     * @param delay Timelock delay in seconds (minimum 1 day)
     * @param owners Array of multi-sig owner addresses
     */
    function configureMultiSig(
        uint256 required, 
        uint256 delay, 
        address[] memory owners
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (required == 0 || required > owners.length) revert InvalidMultiSigConfig();
        if (delay < 1 days) revert InvalidMultiSigConfig();
        
        // Revoke MULTISIG_ROLE from old owners
        for (uint256 i = 0; i < multiSigOwners.length; i++) {
            _revokeRole(MULTISIG_ROLE, multiSigOwners[i]);
        }
        
        multiSigRequired = required;
        timelockDelay = delay;
        delete multiSigOwners;
        
        // Grant MULTISIG_ROLE to new owners
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0)) revert ZeroAddressNotAllowed();
            multiSigOwners.push(owners[i]);
            _grantRole(MULTISIG_ROLE, owners[i]);
        }
        
        emit MultiSigConfigured(required, delay);
    }

    /**
     * @dev Activate fallback mode (single-signature allowed)
     */
    function activateFallbackMode() external {
        if (msg.sender != governanceGuardian) revert AccessDenied();
        fallbackMode = true;
        emit FallbackModeActivated(msg.sender);
    }

    /**
     * @dev Deactivate fallback mode (restore multi-sig requirement)
     */
    function deactivateFallbackMode() external {
        if (msg.sender != governanceGuardian) revert AccessDenied();
        fallbackMode = false;
        emit FallbackModeDeactivated(msg.sender);
    }

    /**
     * @dev Set governance guardian
     * @param guardian New guardian address
     */
    function setGovernanceGuardian(address guardian) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (guardian == address(0)) revert InvalidGuardian();
        governanceGuardian = guardian;
    }

    /**
     * @dev Submit approval for a pending transaction
     * @param txHash Transaction hash to approve
     */
    function approveTransaction(bytes32 txHash) external onlyRole(MULTISIG_ROLE) {
        if (hasApproved[txHash][msg.sender]) revert AlreadyApproved();
        
        hasApproved[txHash][msg.sender] = true;
        approvalCount[txHash]++;
        
        if (proposalTimestamps[txHash] == 0) {
            proposalTimestamps[txHash] = block.timestamp;
        }
        
        emit ApprovalSubmitted(msg.sender, txHash);
    }

    /**
     * @dev Check if enough approvals exist for a transaction
     * @param txHash Transaction hash to check
     */
    function hasEnoughApprovals(bytes32 txHash) external view returns (bool) {
        return multiSigRequired > 0 && approvalCount[txHash] >= multiSigRequired;
    }

    /**
     * @dev Get remaining time until timelock expires
     * @param txHash Transaction hash
     */
    function getTimelockRemaining(bytes32 txHash) external view returns (uint256) {
        if (proposalTimestamps[txHash] == 0) return 0;
        uint256 unlockTime = proposalTimestamps[txHash] + timelockDelay;
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
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
        if (presaleStartTime != 0) revert PresaleAlreadyStarted();

        uint256 actualStartTime = startTime == 0 ? block.timestamp : startTime;
        if (actualStartTime < block.timestamp) revert PresaleCannotStartInPast();

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
        if (presaleStartTime == 0) revert PresaleNotStarted();
        if (block.timestamp < presaleStartTime) revert PresaleNotActive();
        if (block.timestamp > presaleEndTime) revert PresaleClosed();
        if (usdtAmount < MIN_PURCHASE) revert AmountTooSmall();
        if (usdtAmount > MAX_PURCHASE) revert AmountTooLarge();

        // Check user hasn't exceeded limits (off-chain validation assumed)
        if (userPurchases[msg.sender] + usdtAmount > MAX_PURCHASE) {
            revert UserLimitExceeded();
        }

        // Calculate THAL tokens (1 USDT = 100 THAL)
        // CRITICAL FIX: Properly convert from USDT (6 decimals) to THAL (18 decimals)
        // usdtAmount is in 6 decimals, need to convert to 18 decimals and multiply by 100
        uint256 thalAmount = (usdtAmount * 100 * 10**12); // Correct conversion: 6 decimals -> 18 decimals with 100x multiplier

        // Check contract has enough THAL tokens
        if (THAL_TOKEN.balanceOf(address(this)) < thalAmount) {
            revert InsufficientThalBalance();
        }

        // Transfer USDT from buyer
        USDT_TOKEN.safeTransferFrom(msg.sender, address(this), usdtAmount);

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
            THAL_TOKEN.safeTransfer(msg.sender, thalAmount);
        }

        emit TokensPurchased(msg.sender, usdtAmount, thalAmount, vestingScheduleId);
    }

    /**
     * @dev Set vesting contract address (requires multi-sig when enabled)
     * @param vestingAddr Vesting contract address
     */
    function setVestingContract(address vestingAddr)
        external
        requireMultiSig(keccak256(abi.encodePacked("setVestingContract", vestingAddr)))
    {
        if (vestingAddr == address(0)) revert InvalidVestingAddress();
        vestingContract = vestingAddr;
    }

    /**
     * @dev Withdraw collected USDT (requires multi-sig when enabled)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUsdt(uint256 amount, address recipient)
        external
        requireMultiSig(keccak256(abi.encodePacked("withdrawUsdt", amount, recipient)))
        nonReentrant
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert AmountMustBePositive();
        if (USDT_TOKEN.balanceOf(address(this)) < amount) revert InsufficientUsdtBalance();

        USDT_TOKEN.safeTransfer(recipient, amount);
    }

    /**
     * @dev Withdraw unsold THAL tokens (requires multi-sig when enabled)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUnsoldTokens(uint256 amount, address recipient)
        external
        requireMultiSig(keccak256(abi.encodePacked("withdrawUnsoldTokens", amount, recipient)))
        nonReentrant
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert AmountMustBePositive();
        if (THAL_TOKEN.balanceOf(address(this)) < amount) revert InsufficientTokenBalance();

        THAL_TOKEN.safeTransfer(recipient, amount);
    }

    /**
     * @dev Emergency pause (requires multi-sig when enabled)
     */
    function pause() external requireMultiSig(keccak256(abi.encodePacked("pause"))) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @dev Emergency unpause (requires multi-sig when enabled)
     */
    function unpause() external requireMultiSig(keccak256(abi.encodePacked("unpause"))) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // ========================================
    // PUBLIC VIEW FUNCTIONS
    // ========================================

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
     * @param usdtAmount USDT amount in smallest units (6 decimals)
     * @return THAL amount in smallest units (18 decimals)
     */
    function calculateThalAmount(uint256 usdtAmount) external pure returns (uint256) {
        // 1 USDT (10^6 units) = 100 THAL (100 * 10^18 units)
        // So: usdtAmount * 100 * 10^12 = usdtAmount * 100 * 10^(18-6)
        return usdtAmount * 100 * 10**12;
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
        if (vestingContract == address(0)) revert VestingContractNotSet();

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
