// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title ThaliumVesting
 * @dev Token vesting contract for the Thalium ecosystem
 *
 * This contract manages token vesting schedules with:
 * - Streamlined vesting logic
 * - Off-chain validation for complex rules
 * - Emergency controls
 * - Gas-efficient operations
 *
 * Security Model:
 * - On-chain: Basic vesting calculations and token releases
 * - Off-chain: Eligibility validation, compliance checks
 *
 * @author Thalium Development Team
 */
contract ThaliumVesting is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant VESTING_MANAGER_ROLE = keccak256("VESTING_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    uint256 public constant MAX_VESTING_DURATION = 4 * 365 days;
    uint256 public constant MIN_VESTING_DURATION = 30 days;
    uint256 public constant CLAIM_COOLDOWN = 24 hours;

    // ========================================
    // STRUCTS
    // ========================================

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 releasedAmount;
        uint256 lastClaimTime;
        bool revocable;
        bool revoked;
        bytes32 category; // Category identifier
    }

    // ========================================
    // STATE VARIABLES
    // ========================================

    IERC20 public immutable thalToken;

    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    mapping(address => bytes32[]) public beneficiarySchedules;

    uint256 public totalSchedules;
    uint256 public totalCommittedTokens;

    // ========================================
    // EVENTS
    // ========================================

    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        bytes32 category
    );

    event TokensReleased(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    event VestingScheduleRevoked(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 unvestedAmount
    );

    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize vesting contract
     * @param thalTokenAddress THAL token contract address
     * @param defaultAdmin Default admin address
     * @param vestingManager Vesting manager address
     * @param complianceOfficer Compliance officer address
     */
    constructor(
        address thalTokenAddress,
        address defaultAdmin,
        address vestingManager,
        address complianceOfficer
    ) {
        require(thalTokenAddress != address(0), "ThaliumVesting: Invalid token address");
        require(defaultAdmin != address(0), "ThaliumVesting: Invalid default admin");
        require(vestingManager != address(0), "ThaliumVesting: Invalid vesting manager");
        require(complianceOfficer != address(0), "ThaliumVesting: Invalid compliance officer");

        thalToken = IERC20(thalTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(VESTING_MANAGER_ROLE, vestingManager);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Create vesting schedule
     * @param beneficiary Recipient address
     * @param totalAmount Total tokens to vest
     * @param startTime Vesting start time
     * @param cliffDuration Cliff period
     * @param vestingDuration Total vesting duration
     * @param revocable Whether schedule can be revoked
     * @param category Vesting category
     * @return scheduleId Unique schedule identifier
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable,
        bytes32 category
    )
        external
        onlyRole(VESTING_MANAGER_ROLE)
        whenNotPaused
        returns (bytes32)
    {
        // Basic validation
        require(beneficiary != address(0), "ThaliumVesting: Invalid beneficiary");
        require(totalAmount > 0, "ThaliumVesting: Amount must be positive");
        require(vestingDuration >= MIN_VESTING_DURATION, "ThaliumVesting: Duration too short");
        require(vestingDuration <= MAX_VESTING_DURATION, "ThaliumVesting: Duration too long");
        require(vestingDuration >= cliffDuration, "ThaliumVesting: Cliff cannot exceed duration");

        // Start time validation
        uint256 actualStartTime = startTime == 0 ? block.timestamp : startTime;
        require(actualStartTime >= block.timestamp, "ThaliumVesting: Cannot backdate");
        require(actualStartTime <= block.timestamp + 365 days, "ThaliumVesting: Start time too far");

        // Contract balance check
        require(
            thalToken.balanceOf(address(this)) >= totalCommittedTokens + totalAmount,
            "ThaliumVesting: Insufficient contract balance"
        );

        // Generate unique schedule ID
        bytes32 scheduleId = keccak256(
            abi.encodePacked(
                beneficiary,
                totalAmount,
                actualStartTime,
                block.timestamp,
                totalSchedules
            )
        );

        require(
            vestingSchedules[scheduleId].beneficiary == address(0),
            "ThaliumVesting: Schedule ID collision"
        );

        // Create vesting schedule
        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,
            startTime: actualStartTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            releasedAmount: 0,
            lastClaimTime: 0,
            revocable: revocable,
            revoked: false,
            category: category
        });

        // Update tracking
        beneficiarySchedules[beneficiary].push(scheduleId);
        totalCommittedTokens += totalAmount;
        totalSchedules++;

        emit VestingScheduleCreated(scheduleId, beneficiary, totalAmount, category);
        return scheduleId;
    }

    /**
     * @dev Release vested tokens
     * @param scheduleId Vesting schedule ID
     */
    function releaseVestedTokens(bytes32 scheduleId)
        external
        whenNotPaused
        nonReentrant
    {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];

        // Basic validation
        require(schedule.beneficiary == msg.sender, "ThaliumVesting: Not authorized");
        require(!schedule.revoked, "ThaliumVesting: Schedule revoked");
        require(schedule.totalAmount > schedule.releasedAmount, "ThaliumVesting: All tokens released");

        // Cooldown check
        require(
            block.timestamp >= schedule.lastClaimTime + CLAIM_COOLDOWN,
            "ThaliumVesting: Claim cooldown active"
        );

        // Calculate releasable amount
        uint256 releasableAmount = _calculateReleasableAmount(scheduleId);
        require(releasableAmount > 0, "ThaliumVesting: No tokens to release");

        // Update schedule
        schedule.releasedAmount += releasableAmount;
        schedule.lastClaimTime = block.timestamp;

        // Transfer tokens
        thalToken.safeTransfer(msg.sender, releasableAmount);

        emit TokensReleased(scheduleId, msg.sender, releasableAmount);
    }

    /**
     * @dev Revoke vesting schedule
     * @param scheduleId Schedule to revoke
     */
    function revokeVestingSchedule(bytes32 scheduleId)
        external
        onlyRole(VESTING_MANAGER_ROLE)
        whenNotPaused
        nonReentrant
    {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];

        require(schedule.beneficiary != address(0), "ThaliumVesting: Schedule not found");
        require(schedule.revocable, "ThaliumVesting: Not revocable");
        require(!schedule.revoked, "ThaliumVesting: Already revoked");

        // Calculate unvested amount
        uint256 timeElapsed = block.timestamp - schedule.startTime;
        uint256 vestedAmount;

        if (timeElapsed >= schedule.vestingDuration) {
            vestedAmount = schedule.totalAmount;
        } else if (timeElapsed >= schedule.cliffDuration) {
            vestedAmount = Math.mulDiv(
                schedule.totalAmount,
                timeElapsed,
                schedule.vestingDuration
            );
        }

        uint256 unvestedAmount = schedule.totalAmount - vestedAmount;

        // Mark as revoked
        schedule.revoked = true;

        // Return unvested tokens to contract owner (off-chain decision)
        if (unvestedAmount > 0) {
            totalCommittedTokens -= unvestedAmount;
        }

        emit VestingScheduleRevoked(scheduleId, schedule.beneficiary, unvestedAmount);
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
     * @dev Get releasable amount for schedule
     * @param scheduleId Vesting schedule ID
     */
    function getReleasableAmount(bytes32 scheduleId) external view returns (uint256) {
        return _calculateReleasableAmount(scheduleId);
    }

    /**
     * @dev Get beneficiary schedules with pagination
     * @param beneficiary User address
     * @param offset Starting index
     * @param limit Maximum results
     */
    function getBeneficiarySchedules(
        address beneficiary,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage userSchedules = beneficiarySchedules[beneficiary];
        uint256 userTotalSchedules = userSchedules.length;

        if (offset >= userTotalSchedules) {
            return new bytes32[](0);
        }

        uint256 endIndex = offset + limit;
        if (endIndex > userTotalSchedules) {
            endIndex = userTotalSchedules;
        }

        uint256 resultLength = endIndex - offset;
        bytes32[] memory result = new bytes32[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = userSchedules[offset + i];
        }

        return result;
    }

    /**
     * @dev Get vesting schedule details
     * @param scheduleId Schedule ID
     */
    function getVestingSchedule(bytes32 scheduleId)
        external
        view
        returns (
            address beneficiary,
            uint256 totalAmount,
            uint256 startTime,
            uint256 cliffDuration,
            uint256 vestingDuration,
            uint256 releasedAmount,
            uint256 lastClaimTime,
            bool revocable,
            bool revoked,
            bytes32 category
        )
    {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        return (
            schedule.beneficiary,
            schedule.totalAmount,
            schedule.startTime,
            schedule.cliffDuration,
            schedule.vestingDuration,
            schedule.releasedAmount,
            schedule.lastClaimTime,
            schedule.revocable,
            schedule.revoked,
            schedule.category
        );
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Calculate releasable amount
     * @param scheduleId Vesting schedule ID
     */
    function _calculateReleasableAmount(bytes32 scheduleId)
        internal
        view
        returns (uint256)
    {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];

        if (schedule.revoked || block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - schedule.startTime;

        if (timeElapsed >= schedule.vestingDuration) {
            return schedule.totalAmount - schedule.releasedAmount;
        }

        uint256 vestedAmount = Math.mulDiv(
            schedule.totalAmount,
            timeElapsed,
            schedule.vestingDuration
        );

        return vestedAmount - schedule.releasedAmount;
    }
}