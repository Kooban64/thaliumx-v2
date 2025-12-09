// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ThaliumSecurity
 * @dev Security contract for Thalium ecosystem
 *
 * This contract provides minimal on-chain security controls:
 * - Emergency pause functionality
 * - Basic access controls
 * - Security event logging
 *
 * Security Model:
 * - On-chain: Emergency controls and basic validation
 * - Off-chain: KYC verification, risk assessment, transaction monitoring
 *
 * @author Thalium Development Team
 */
contract ThaliumSecurity is AccessControl, Pausable, ReentrancyGuard {
    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant SECURITY_ADMIN_ROLE = keccak256("SECURITY_ADMIN_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // ========================================
    // STATE VARIABLES
    // ========================================

    bool public emergencyMode;
    uint256 public emergencyActivatedAt;

    // Security event log
    struct SecurityEvent {
        address actor;
        uint256 timestamp;
        bytes32 eventType;
        string details;
        uint256 severity; // 1=Low, 2=Medium, 3=High, 4=Critical
    }

    SecurityEvent[] public securityEvents;
    uint256 public nextEventId;

    // ========================================
    // EVENTS
    // ========================================

    event EmergencyModeActivated(address indexed activator, string reason);
    event EmergencyModeDeactivated(address indexed deactivator);
    event SecurityEventLogged(
        uint256 indexed eventId,
        address indexed actor,
        bytes32 indexed eventType,
        uint256 severity
    );

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize security contract
     * @param defaultAdmin Default admin address
     * @param securityAdmin Security admin address
     * @param complianceOfficer Compliance officer address
     */
    constructor(
        address defaultAdmin,
        address securityAdmin,
        address complianceOfficer
    ) {
        require(defaultAdmin != address(0), "ThaliumSecurity: Invalid default admin");
        require(securityAdmin != address(0), "ThaliumSecurity: Invalid security admin");
        require(complianceOfficer != address(0), "ThaliumSecurity: Invalid compliance officer");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(SECURITY_ADMIN_ROLE, securityAdmin);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Activate emergency mode
     * @param reason Reason for emergency activation
     */
    function activateEmergencyMode(string memory reason)
        external
        onlyRole(SECURITY_ADMIN_ROLE)
    {
        require(!emergencyMode, "ThaliumSecurity: Already in emergency mode");
        require(bytes(reason).length > 0, "ThaliumSecurity: Reason required");

        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;

        _logSecurityEvent(
            msg.sender,
            keccak256("EMERGENCY_ACTIVATED"),
            reason,
            4 // Critical
        );

        emit EmergencyModeActivated(msg.sender, reason);
    }

    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(emergencyMode, "ThaliumSecurity: Not in emergency mode");

        emergencyMode = false;

        _logSecurityEvent(
            msg.sender,
            keccak256("EMERGENCY_DEACTIVATED"),
            "Emergency mode deactivated",
            2 // Medium
        );

        emit EmergencyModeDeactivated(msg.sender);
    }

    /**
     * @dev Log security event (called by authorized contracts)
     * @param actor Address performing the action
     * @param eventType Type of security event
     * @param details Event details
     * @param severity Event severity (1-4)
     */
    function logSecurityEvent(
        address actor,
        bytes32 eventType,
        string memory details,
        uint256 severity
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(severity >= 1 && severity <= 4, "ThaliumSecurity: Invalid severity");
        require(bytes(details).length > 0, "ThaliumSecurity: Details required");

        _logSecurityEvent(actor, eventType, details, severity);
    }

    /**
     * @dev Check if emergency mode is active
     */
    function isEmergencyActive() external view returns (bool) {
        return emergencyMode;
    }

    /**
     * @dev Get emergency mode details
     */
    function getEmergencyStatus() external view returns (
        bool isActive,
        uint256 activatedAt,
        uint256 duration
    ) {
        return (
            emergencyMode,
            emergencyActivatedAt,
            emergencyMode ? block.timestamp - emergencyActivatedAt : 0
        );
    }

    /**
     * @dev Get security events count
     */
    function getSecurityEventsCount() external view returns (uint256) {
        return securityEvents.length;
    }

    /**
     * @dev Get security event by index
     */
    function getSecurityEvent(uint256 index) external view returns (
        address actor,
        uint256 timestamp,
        bytes32 eventType,
        string memory details,
        uint256 severity
    ) {
        require(index < securityEvents.length, "ThaliumSecurity: Index out of bounds");

        SecurityEvent memory eventData = securityEvents[index];
        return (
            eventData.actor,
            eventData.timestamp,
            eventData.eventType,
            eventData.details,
            eventData.severity
        );
    }

    /**
     * @dev Get paginated security event indices
     */
    function getSecurityEventIndices(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory indices) {
        uint256 totalEvents = securityEvents.length;

        if (offset >= totalEvents) {
            return new uint256[](0);
        }

        uint256 endIndex = offset + limit;
        if (endIndex > totalEvents) {
            endIndex = totalEvents;
        }

        uint256 resultLength = endIndex - offset;
        indices = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            indices[i] = offset + i;
        }

        return indices;
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Log security event internally
     */
    function _logSecurityEvent(
        address actor,
        bytes32 eventType,
        string memory details,
        uint256 severity
    ) internal {
        uint256 eventId = nextEventId++;

        securityEvents.push(SecurityEvent({
            actor: actor,
            timestamp: block.timestamp,
            eventType: eventType,
            details: details,
            severity: severity
        }));

        emit SecurityEventLogged(eventId, actor, eventType, severity);

        // Auto-cleanup old events (keep last 1000)
        if (securityEvents.length > 1000) {
            _cleanupOldEvents();
        }
    }

    /**
     * @dev Clean up old security events
     */
    function _cleanupOldEvents() internal {
        uint256 cutoffTime = block.timestamp - 365 days; // Keep 1 year of events
        uint256 writeIndex = 0;

        for (uint256 i = 0; i < securityEvents.length && gasleft() > 50000; i++) {
            if (securityEvents[i].timestamp >= cutoffTime) {
                if (writeIndex != i) {
                    securityEvents[writeIndex] = securityEvents[i];
                }
                writeIndex++;
            }
        }

        // Truncate array
        while (securityEvents.length > writeIndex) {
            securityEvents.pop();
        }
    }
}