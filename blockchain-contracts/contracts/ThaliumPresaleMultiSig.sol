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
 * @title ThaliumPresaleMultiSig
 * @dev Presale contract with multi-signature security and timelock support
 *
 * Security Features:
 * - Multi-sig requirement for critical admin functions (M-of-N)
 * - Time-delayed execution (configurable delay)
 * - Role-based access as fallback
 *
 * Critical operations requiring multi-sig:
 * - pause() / unpause()
 * - withdrawUsdt()
 * - withdrawUnsoldTokens()
 * - setVestingContract()
 *
 * @author Thalium Development Team
 */
contract ThaliumPresaleMultiSig is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========================================
    // ROLES
    // ========================================

    bytes32 public constant PRESALE_MANAGER_ROLE = keccak256("PRESALE_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");
    
    // Role hash for critical operations requiring multi-sig
    bytes32 public constant CRITICAL_ADMIN_ROLE = keccak256("CRITICAL_ADMIN_ROLE");

    // ========================================
    // IMMUTABLES
    // ========================================

    uint256 public immutable REQUIRED_SIGNATURES;
    uint256 public immutable TIMELOCK_DELAY;

    // ========================================
    // STATE VARIABLES
    // ========================================

    IERC20 public immutable USDT_TOKEN;
    IERC20 public immutable THAL_TOKEN;

    uint256 public presaleStartTime;
    uint256 public presaleEndTime;

    uint256 public totalTokensSold;
    uint256 public totalUsdtRaised;

    // Purchase tracking
    mapping(address => uint256) public userPurchases;
    mapping(address => uint256) public userAllocations;

    // Vesting integration
    address public vestingContract;

    // Multi-sig tracking: txHash => owner => approved
    mapping(bytes32 => mapping(address => bool)) public hasApproved;
    // txHash => approval count
    mapping(bytes32 => uint256) public approvalCount;
    // txHash => proposal timestamp
    mapping(bytes32 => uint256) public proposalTimestamps;
    // txHash => executed flag
    mapping(bytes32 => bool) public executedProposals;

    // Fallback mode - if true, allows single-signature operations (for emergency)
    bool public fallbackMode;
    // Who can activate/deactivate fallback mode (usually governance)
    address public governanceGuardian;

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
    event EmergencyPaused(address indexed pauser, bytes32 indexed txHash);
    event EmergencyUnpaused(address indexed unpauser, bytes32 indexed txHash);
    event USDTWithdrawn(address indexed recipient, uint256 amount, bytes32 indexed txHash);
    event UnsoldTokensWithdrawn(address indexed recipient, uint256 amount, bytes32 indexed txHash);
    event VestingContractSet(address indexed vestingContract, bytes32 indexed txHash);
    event ApprovalSubmitted(address indexed approver, bytes32 indexed txHash);
    event ProposalExecuted(bytes32 indexed txHash, uint256 executionTime);
    event FallbackModeActivated(address indexed activator);
    event FallbackModeDeactivated(address indexed deactivator);

    // ========================================
    // ERRORS
    // ========================================

    error InvalidUsdtAddress();
    error InvalidThalAddress();
    error InvalidDefaultAdmin();
    error InvalidPresaleManager();
    error InvalidComplianceOfficer();
    error InvalidSignaturesRequirement();
    error InvalidTimelockDelay();
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
    error AlreadyApproved();
    error InsufficientApprovals();
    error TimelockNotElapsed();
    error ProposalAlreadyExecuted();
    error ProposalNotFound();
    error InvalidGuardian();
    error ZeroAddressNotAllowed();
    error AccessDenied();
    error NotEnoughSignatures();
    error TimelockStillActive();

    // ========================================
    // MODIFIERS
    // ========================================

    /**
     * @dev Modifier requiring multi-sig approval for critical operations
     * In fallback mode, this allows single-signature execution
     */
    modifier requireMultiSig(bytes32 txHash) {
        if (fallbackMode) {
            // Fallback mode - skip multi-sig check
            _;
            return;
        }

        // Record timestamp on first approval request
        if (proposalTimestamps[txHash] == 0 && !executedProposals[txHash]) {
            proposalTimestamps[txHash] = block.timestamp;
        }

        // Check if caller has already approved
        if (!hasApproved[txHash][msg.sender]) {
            hasApproved[txHash][msg.sender] = true;
            approvalCount[txHash]++;
            emit ApprovalSubmitted(msg.sender, txHash);
        }

        // Verify we have enough approvals
        if (approvalCount[txHash] < REQUIRED_SIGNATURES) {
            revert InsufficientApprovals();
        }

        // Verify timelock has elapsed
        if (block.timestamp < proposalTimestamps[txHash] + TIMELOCK_DELAY) {
            revert TimelockNotElapsed();
        }

        // Mark as executed
        if (!executedProposals[txHash]) {
            executedProposals[txHash] = true;
            emit ProposalExecuted(txHash, block.timestamp);
        }

        _;
    }

    /**
     * @dev Modifier that checks for multi-sig OR fallback mode
     */
    modifier withMultiSigCheck(bytes32 txHash) {
        if (fallbackMode) {
            // Fallback mode - allow immediate execution with single signature
            _;
            return;
        }

        // Record proposal timestamp on first call
        if (proposalTimestamps[txHash] == 0 && !executedProposals[txHash]) {
            proposalTimestamps[txHash] = block.timestamp;
        }

        // Record approval
        if (!hasApproved[txHash][msg.sender]) {
            hasApproved[txHash][msg.sender] = true;
            approvalCount[txHash]++;
            emit ApprovalSubmitted(msg.sender, txHash);
        }

        // Check approvals
        if (approvalCount[txHash] < REQUIRED_SIGNATURES) {
            revert InsufficientApprovals();
        }

        // Check timelock
        if (block.timestamp < proposalTimestamps[txHash] + TIMELOCK_DELAY) {
            revert TimelockNotElapsed();
        }

        // Mark executed
        if (!executedProposals[txHash]) {
            executedProposals[txHash] = true;
            emit ProposalExecuted(txHash, block.timestamp);
        }

        _;
    }

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize presale contract with multi-sig support
     * @param usdtTokenAddress USDT token contract address
     * @param thalTokenAddress THAL token contract address
     * @param defaultAdmin Default admin address
     * @param presaleManager Presale manager address
     * @param complianceOfficer Compliance officer address
     * @param multiSigOwners Array of multi-sig owner addresses
     * @param requiredSignatures Number of signatures required (M)
     * @param timelockDelay Delay before execution (seconds, minimum 1 day)
     * @param guardian Governance guardian address for fallback mode control
     */
    constructor(
        address usdtTokenAddress,
        address thalTokenAddress,
        address defaultAdmin,
        address presaleManager,
        address complianceOfficer,
        address[] memory multiSigOwners,
        uint256 requiredSignatures,
        uint256 timelockDelay,
        address guardian
    ) {
        if (usdtTokenAddress == address(0)) revert InvalidUsdtAddress();
        if (thalTokenAddress == address(0)) revert InvalidThalAddress();
        if (defaultAdmin == address(0)) revert InvalidDefaultAdmin();
        if (presaleManager == address(0)) revert InvalidPresaleManager();
        if (complianceOfficer == address(0)) revert InvalidComplianceOfficer();
        if (guardian == address(0)) revert InvalidGuardian();
        if (requiredSignatures == 0 || requiredSignatures > multiSigOwners.length) {
            revert InvalidSignaturesRequirement();
        }
        if (timelockDelay < 1 days) revert InvalidTimelockDelay();

        USDT_TOKEN = IERC20(usdtTokenAddress);
        THAL_TOKEN = IERC20(thalTokenAddress);

        REQUIRED_SIGNATURES = requiredSignatures;
        TIMELOCK_DELAY = timelockDelay;
        governanceGuardian = guardian;

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PRESALE_MANAGER_ROLE, presaleManager);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
        _grantRole(CRITICAL_ADMIN_ROLE, defaultAdmin);

        // Grant MULTISIG_ROLE to all owners
        for (uint256 i = 0; i < multiSigOwners.length; i++) {
            if (multiSigOwners[i] == address(0)) revert ZeroAddressNotAllowed();
            _grantRole(MULTISIG_ROLE, multiSigOwners[i]);
            _grantRole(CRITICAL_ADMIN_ROLE, multiSigOwners[i]);
        }
    }

    // ========================================
    // EXTERNAL FUNCTIONS - PRESALE MANAGEMENT
    // ========================================

    /**
     * @dev Start presale (requires PRESALE_MANAGER_ROLE)
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
        presaleEndTime = actualStartTime + 90 days;

        emit PresaleStarted(presaleStartTime, presaleEndTime);
    }

    /**
     * @dev Purchase tokens with USDT
     * @param usdtAmount Amount of USDT to spend
     */
    function purchaseTokens(uint256 usdtAmount)
        external
        whenNotPaused
        nonReentrant
    {
        if (presaleStartTime == 0) revert PresaleNotStarted();
        if (block.timestamp < presaleStartTime) revert PresaleNotActive();
        if (block.timestamp > presaleEndTime) revert PresaleClosed();
        if (usdtAmount < 100 * 10**6) revert AmountTooSmall(); // 100 USDT min
        if (usdtAmount > 10000 * 10**6) revert AmountTooLarge(); // 10,000 USDT max

        if (userPurchases[msg.sender] + usdtAmount > 10000 * 10**6) {
            revert UserLimitExceeded();
        }

        uint256 thalAmount = (usdtAmount * 100 * 10**12);

        if (THAL_TOKEN.balanceOf(address(this)) < thalAmount) {
            revert InsufficientThalBalance();
        }

        USDT_TOKEN.safeTransferFrom(msg.sender, address(this), usdtAmount);

        userPurchases[msg.sender] += usdtAmount;
        userAllocations[msg.sender] += thalAmount;
        totalUsdtRaised += usdtAmount;
        totalTokensSold += thalAmount;

        bytes32 vestingScheduleId = bytes32(0);
        if (vestingContract != address(0)) {
            vestingScheduleId = _createVestingSchedule(msg.sender, thalAmount);
        } else {
            THAL_TOKEN.safeTransfer(msg.sender, thalAmount);
        }

        emit TokensPurchased(msg.sender, usdtAmount, thalAmount, vestingScheduleId);
    }

    // ========================================
    // MULTI-SIG CRITICAL OPERATIONS
    // ========================================

    /**
     * @dev Set vesting contract address (requires multi-sig approval + timelock)
     * @param vestingAddr Vesting contract address
     */
    function setVestingContract(address vestingAddr)
        external
        withMultiSigCheck(keccak256(abi.encodePacked("setVestingContract", vestingAddr)))
    {
        if (vestingAddr == address(0)) revert InvalidVestingAddress();
        vestingContract = vestingAddr;
        emit VestingContractSet(vestingAddr, keccak256(abi.encodePacked("setVestingContract", vestingAddr)));
    }

    /**
     * @dev Withdraw collected USDT (requires multi-sig approval + timelock)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUsdt(uint256 amount, address recipient)
        external
        withMultiSigCheck(keccak256(abi.encodePacked("withdrawUsdt", amount, recipient)))
        nonReentrant
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert AmountMustBePositive();
        if (USDT_TOKEN.balanceOf(address(this)) < amount) revert InsufficientUsdtBalance();

        USDT_TOKEN.safeTransfer(recipient, amount);
        emit USDTWithdrawn(recipient, amount, keccak256(abi.encodePacked("withdrawUsdt", amount, recipient)));
    }

    /**
     * @dev Withdraw unsold THAL tokens (requires multi-sig approval + timelock)
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawUnsoldTokens(uint256 amount, address recipient)
        external
        withMultiSigCheck(keccak256(abi.encodePacked("withdrawUnsoldTokens", amount, recipient)))
        nonReentrant
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert AmountMustBePositive();
        if (THAL_TOKEN.balanceOf(address(this)) < amount) revert InsufficientTokenBalance();

        THAL_TOKEN.safeTransfer(recipient, amount);
        emit UnsoldTokensWithdrawn(recipient, amount, keccak256(abi.encodePacked("withdrawUnsoldTokens", amount, recipient)));
    }

    /**
     * @dev Emergency pause (requires multi-sig approval + timelock)
     */
    function pause()
        external
        withMultiSigCheck(keccak256(abi.encodePacked("pause")))
    {
        _pause();
        emit EmergencyPaused(msg.sender, keccak256(abi.encodePacked("pause")));
    }

    /**
     * @dev Emergency unpause (requires multi-sig approval + timelock)
     */
    function unpause()
        external
        withMultiSigCheck(keccak256(abi.encodePacked("unpause")))
    {
        _unpause();
        emit EmergencyUnpaused(msg.sender, keccak256(abi.encodePacked("unpause")));
    }

    // ========================================
    // MULTI-SIG APPROVAL MANAGEMENT
    // ========================================

    /**
     * @dev Submit approval for a pending transaction (called by multi-sig owners)
     * @param txHash Transaction hash to approve
     */
    function approveTransaction(bytes32 txHash) external onlyRole(MULTISIG_ROLE) {
        if (hasApproved[txHash][msg.sender]) revert AlreadyApproved();

        hasApproved[txHash][msg.sender] = true;
        approvalCount[txHash]++;

        // Record timestamp on first approval
        if (proposalTimestamps[txHash] == 0) {
            proposalTimestamps[txHash] = block.timestamp;
        }

        emit ApprovalSubmitted(msg.sender, txHash);
    }

    /**
     * @dev Check if enough approvals exist for a transaction
     * @param txHash Transaction hash to check
     * @return bool True if enough approvals
     */
    function hasEnoughApprovals(bytes32 txHash) external view returns (bool) {
        return approvalCount[txHash] >= REQUIRED_SIGNATURES;
    }

    /**
     * @dev Get approval count for a transaction
     * @param txHash Transaction hash
     * @return uint256 Number of approvals
     */
    function getApprovalCount(bytes32 txHash) external view returns (uint256) {
        return approvalCount[txHash];
    }

    /**
     * @dev Check if an address has approved a transaction
     * @param txHash Transaction hash
     * @param owner Address to check
     * @return bool True if approved
     */
    function isApproved(bytes32 txHash, address owner) external view returns (bool) {
        return hasApproved[txHash][owner];
    }

    /**
     * @dev Check if timelock has elapsed for a proposal
     * @param txHash Transaction hash
     * @return bool True if timelock elapsed
     */
    function isTimelockElapsed(bytes32 txHash) external view returns (bool) {
        return proposalTimestamps[txHash] > 0 && 
               block.timestamp >= proposalTimestamps[txHash] + TIMELOCK_DELAY;
    }

    /**
     * @dev Get remaining time until timelock expires
     * @param txHash Transaction hash
     * @return uint256 Seconds remaining
     */
    function getTimelockRemaining(bytes32 txHash) external view returns (uint256) {
        if (proposalTimestamps[txHash] == 0) return 0;
        uint256 unlockTime = proposalTimestamps[txHash] + TIMELOCK_DELAY;
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }

    // ========================================
    // FALLBACK MODE MANAGEMENT
    // ========================================

    /**
     * @dev Activate fallback mode (single-signature allowed)
     * Only callable by governance guardian
     * WARNING: This should only be used in emergencies
     */
    function activateFallbackMode() external {
        if (msg.sender != governanceGuardian) revert AccessDenied();
        
        fallbackMode = true;
        emit FallbackModeActivated(msg.sender);
    }

    /**
     * @dev Deactivate fallback mode (restore multi-sig requirement)
     * Only callable by governance guardian
     */
    function deactivateFallbackMode() external {
        if (msg.sender != governanceGuardian) revert AccessDenied();
        
        fallbackMode = false;
        emit FallbackModeDeactivated(msg.sender);
    }

    /**
     * @dev Update governance guardian
     * @param newGuardian New guardian address
     */
    function updateGuardian(address newGuardian) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newGuardian == address(0)) revert InvalidGuardian();
        governanceGuardian = newGuardian;
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
        uint256 remaining = purchased >= 10000 * 10**6 ? 0 : 10000 * 10**6 - purchased;

        return (purchased, userAllocations[user], remaining);
    }

    /**
     * @dev Calculate THAL amount for USDT input
     * @param usdtAmount USDT amount in smallest units (6 decimals)
     * @return THAL amount in smallest units (18 decimals)
     */
    function calculateThalAmount(uint256 usdtAmount) external pure returns (uint256) {
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

        IThaliumVesting vesting = IThaliumVesting(vestingContract);

        bytes32 scheduleId = vesting.createVestingSchedule(
            beneficiary,
            amount,
            block.timestamp,
            30 days,
            90 days,
            false,
            "presale"
        );

        return scheduleId;
    }
}
