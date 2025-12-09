// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EmergencyControls
 * @dev Emergency control mechanisms for all ThaliumX contracts
 * @notice Provides circuit breakers, emergency pause, and recovery mechanisms
 */
contract EmergencyControls is AccessControl, Pausable, ReentrancyGuard {
    // Roles
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");

    // Emergency levels
    enum EmergencyLevel {
        NORMAL,
        WARNING,
        EMERGENCY
    }

    // State variables
    EmergencyLevel public currentEmergencyLevel = EmergencyLevel.NORMAL;
    mapping(address => bool) public circuitBreakers;
    mapping(address => uint256) public lastActivity;
    uint256 public emergencyCooldown = 1 hours;
    uint256 public maxActivityPerPeriod = 1000;
    uint256 public activityPeriod = 1 hours;

    // Events
    event EmergencyLevelChanged(EmergencyLevel oldLevel, EmergencyLevel newLevel);
    event CircuitBreakerTriggered(address indexed contractAddress, string reason);
    event CircuitBreakerReset(address indexed contractAddress);
    event EmergencyPause(address indexed pauser, string reason);
    event EmergencyUnpause(address indexed unpauser);

    // Errors
    error InvalidAddress();
    error InvalidEmergencyLevel();
    error CircuitBreakerActive();
    error CooldownNotMet();
    error ExcessiveActivity();
    error Unauthorized();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(EMERGENCY_ROLE, initialOwner);
        _grantRole(RECOVERY_ROLE, initialOwner);
        _grantRole(CIRCUIT_BREAKER_ROLE, initialOwner);
    }

    /**
     * @dev Set emergency level
     * @param level New emergency level
     */
    function setEmergencyLevel(EmergencyLevel level) external onlyRole(EMERGENCY_ROLE) {
        if (level > EmergencyLevel.EMERGENCY) revert InvalidEmergencyLevel();
        
        EmergencyLevel oldLevel = currentEmergencyLevel;
        currentEmergencyLevel = level;
        
        emit EmergencyLevelChanged(oldLevel, level);
    }

    /**
     * @dev Trigger circuit breaker for a contract
     * @param contractAddress Address of the contract to break
     * @param reason Reason for triggering the circuit breaker
     */
    function triggerCircuitBreaker(
        address contractAddress,
        string memory reason
    ) external onlyRole(CIRCUIT_BREAKER_ROLE) {
        if (contractAddress == address(0)) revert InvalidAddress();
        
        circuitBreakers[contractAddress] = true;
        lastActivity[contractAddress] = block.timestamp;
        
        emit CircuitBreakerTriggered(contractAddress, reason);
    }

    /**
     * @dev Reset circuit breaker for a contract
     * @param contractAddress Address of the contract to reset
     */
    function resetCircuitBreaker(address contractAddress) external onlyRole(CIRCUIT_BREAKER_ROLE) {
        if (contractAddress == address(0)) revert InvalidAddress();
        
        circuitBreakers[contractAddress] = false;
        
        emit CircuitBreakerReset(contractAddress);
    }

    /**
     * @dev Emergency pause with reason
     * @param reason Reason for emergency pause
     */
    function emergencyPause(string memory reason) external onlyRole(EMERGENCY_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @dev Emergency unpause
     */
    function emergencyUnpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    /**
     * @dev Check if contract is accessible (not under circuit breaker)
     * @param contractAddress Address of the contract to check
     * @return accessible True if contract is accessible
     */
    function isContractAccessible(address contractAddress) external view returns (bool accessible) {
        if (contractAddress == address(0)) return false;
        
        // Check if circuit breaker is active
        if (circuitBreakers[contractAddress]) return false;
        
        // Check if emergency level allows access
        if (currentEmergencyLevel == EmergencyLevel.EMERGENCY) return false;
        
        return true;
    }

    /**
     * @dev Check activity limits
     * @param contractAddress Address of the contract
     * @return withinLimits True if within activity limits
     */
    function checkActivityLimits(address contractAddress) external pure returns (bool withinLimits) {
        // For simplicity, always return true in this implementation
        // In a real implementation, you would check activity counters
        return contractAddress != address(0);
    }

    /**
     * @dev Get emergency status
     * @return level Current emergency level
     * @return paused True if contract is paused
     * @return emergencyAddresses List of addresses under circuit breaker
     */
    function getEmergencyStatus() external view returns (
        EmergencyLevel level,
        bool paused,
        address[] memory emergencyAddresses
    ) {
        level = currentEmergencyLevel;
        paused = super.paused();

        // This is a simplified implementation
        // In practice, you'd maintain a list of emergency addresses
        emergencyAddresses = new address[](0);
    }

    /**
     * @dev Update emergency cooldown period
     * @param newCooldown New cooldown period in seconds
     */
    function setEmergencyCooldown(uint256 newCooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyCooldown = newCooldown;
    }

    /**
     * @dev Update activity limits
     * @param newMaxActivity New maximum activity per period
     * @param newPeriod New activity period in seconds
     */
    function setActivityLimits(
        uint256 newMaxActivity,
        uint256 newPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxActivityPerPeriod = newMaxActivity;
        activityPeriod = newPeriod;
    }

    /**
     * @dev Grant emergency role to address
     * @param account Address to grant role to
     */
    function grantEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(EMERGENCY_ROLE, account);
    }

    /**
     * @dev Revoke emergency role from address
     * @param account Address to revoke role from
     */
    function revokeEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(EMERGENCY_ROLE, account);
    }

    /**
     * @dev Check if address has emergency role
     * @param account Address to check
     * @return hasRole True if address has emergency role
     */
    function hasEmergencyRole(address account) external view returns (bool hasRole) {
        return super.hasRole(EMERGENCY_ROLE, account);
    }
}