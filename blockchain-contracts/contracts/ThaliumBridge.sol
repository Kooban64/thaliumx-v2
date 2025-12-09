// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ThaliumBridge
 * @dev Cross-chain bridge for Thalium token transfers
 *
 * This contract provides secure cross-chain functionality:
 * - Multi-signature validation for transfers
 * - Bridge fee management
 * - Emergency controls
 * - Transfer tracking and verification
 *
 * Security Model:
 * - On-chain: Transfer execution and validation
 * - Off-chain: Multi-sig verification and cross-chain communication
 *
 * @author Thalium Development Team
 */
contract ThaliumBridge is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    uint256 public constant MIN_VALIDATORS = 3;
    uint256 public constant MAX_VALIDATORS = 10;
    uint256 public constant TRANSFER_EXPIRY = 24 hours;

    // ========================================
    // STRUCTS
    // ========================================

    struct TransferRequest {
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChainId;
        uint256 targetChainId;
        uint256 nonce;
        uint256 timestamp;
        bytes32 transferId;
        bool executed;
        uint256 validatorCount;
        mapping(address => bool) validatorApprovals;
    }

    // ========================================
    // STATE VARIABLES
    // ========================================

    IERC20 public immutable thalToken;

    mapping(bytes32 => TransferRequest) public transferRequests;
    mapping(uint256 => bool) public supportedChains;
    mapping(address => uint256) public validatorNonces;

    uint256 public bridgeFee; // Fee in THAL tokens
    uint256 public totalTransferred;
    uint256 public totalFeesCollected;

    address[] public validators;
    uint256 public requiredValidators;

    // ========================================
    // EVENTS
    // ========================================

    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 targetChainId
    );

    event TransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChainId
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ChainSupportUpdated(uint256 chainId, bool supported);
    event BridgeFeeUpdated(uint256 newFee);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize bridge contract
     * @param thalTokenAddress THAL token contract address
     * @param defaultAdmin Default admin address
     * @param bridgeAdmin Bridge admin address
     * @param initialValidators Array of initial validator addresses
     */
    constructor(
        address thalTokenAddress,
        address defaultAdmin,
        address bridgeAdmin,
        address[] memory initialValidators
    ) {
        require(thalTokenAddress != address(0), "ThaliumBridge: Invalid THAL address");
        require(defaultAdmin != address(0), "ThaliumBridge: Invalid default admin");
        require(bridgeAdmin != address(0), "ThaliumBridge: Invalid bridge admin");
        require(
            initialValidators.length >= MIN_VALIDATORS,
            "ThaliumBridge: Insufficient initial validators"
        );

        thalToken = IERC20(thalTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(BRIDGE_ADMIN_ROLE, bridgeAdmin);

        // Set up initial validators
        for (uint256 i = 0; i < initialValidators.length; i++) {
            require(initialValidators[i] != address(0), "ThaliumBridge: Invalid validator");
            _grantRole(VALIDATOR_ROLE, initialValidators[i]);
            validators.push(initialValidators[i]);
        }

        requiredValidators = (initialValidators.length * 2) / 3 + 1; // 2/3 majority

        // Initialize supported chains
        supportedChains[1] = true; // Ethereum
        supportedChains[56] = true; // BSC
        supportedChains[137] = true; // Polygon
        supportedChains[43114] = true; // Avalanche

        bridgeFee = 10 * 10**18; // 10 THAL fee
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Initiate cross-chain transfer
     * @param recipient Recipient address on target chain
     * @param amount Amount to transfer
     * @param targetChainId Target chain ID
     */
    function initiateTransfer(
        address recipient,
        uint256 amount,
        uint256 targetChainId
    )
        external
        whenNotPaused
        nonReentrant
        returns (bytes32)
    {
        require(recipient != address(0), "ThaliumBridge: Invalid recipient");
        require(amount > 0, "ThaliumBridge: Amount must be positive");
        require(supportedChains[targetChainId], "ThaliumBridge: Unsupported chain");
        require(targetChainId != block.chainid, "ThaliumBridge: Cannot transfer to same chain");

        // Check bridge fee
        uint256 totalAmount = amount + bridgeFee;
        require(
            thalToken.balanceOf(msg.sender) >= totalAmount,
            "ThaliumBridge: Insufficient balance"
        );

        // Generate transfer ID
        uint256 nonce = validatorNonces[msg.sender]++;
        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                amount,
                block.chainid,
                targetChainId,
                nonce,
                block.timestamp
            )
        );

        // Create transfer request
        TransferRequest storage request = transferRequests[transferId];
        require(request.timestamp == 0, "ThaliumBridge: Transfer ID collision");

        request.sender = msg.sender;
        request.recipient = recipient;
        request.amount = amount;
        request.sourceChainId = block.chainid;
        request.targetChainId = targetChainId;
        request.nonce = nonce;
        request.timestamp = block.timestamp;
        request.transferId = transferId;
        request.executed = false;
        request.validatorCount = 0;

        // Transfer tokens to bridge
        thalToken.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Update totals
        totalTransferred += amount;
        totalFeesCollected += bridgeFee;

        emit TransferInitiated(transferId, msg.sender, recipient, amount, targetChainId);

        return transferId;
    }

    /**
     * @dev Complete cross-chain transfer (called by validators)
     * @param transferId Transfer ID to complete
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param sourceChainId Source chain ID
     */
    function completeTransfer(
        bytes32 transferId,
        address recipient,
        uint256 amount,
        uint256 sourceChainId
    )
        external
        onlyRole(VALIDATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        TransferRequest storage request = transferRequests[transferId];
        require(request.timestamp > 0, "ThaliumBridge: Transfer not found");
        require(!request.executed, "ThaliumBridge: Already executed");
        require(request.recipient == recipient, "ThaliumBridge: Recipient mismatch");
        require(request.amount == amount, "ThaliumBridge: Amount mismatch");
        require(request.sourceChainId == sourceChainId, "ThaliumBridge: Chain mismatch");
        require(
            block.timestamp <= request.timestamp + TRANSFER_EXPIRY,
            "ThaliumBridge: Transfer expired"
        );

        // Check validator hasn't already approved
        require(
            !request.validatorApprovals[msg.sender],
            "ThaliumBridge: Already approved by validator"
        );

        // Record approval
        request.validatorApprovals[msg.sender] = true;
        request.validatorCount++;

        // Execute transfer if enough validators
        if (request.validatorCount >= requiredValidators) {
            request.executed = true;

            // Transfer tokens to recipient
            thalToken.safeTransfer(recipient, amount);

            emit TransferCompleted(transferId, recipient, amount, sourceChainId);
        }
    }

    /**
     * @dev Add validator
     * @param validator Validator address to add
     */
    function addValidator(address validator)
        external
        onlyRole(BRIDGE_ADMIN_ROLE)
    {
        require(validator != address(0), "ThaliumBridge: Invalid validator");
        require(!hasRole(VALIDATOR_ROLE, validator), "ThaliumBridge: Already validator");
        require(validators.length < MAX_VALIDATORS, "ThaliumBridge: Too many validators");

        _grantRole(VALIDATOR_ROLE, validator);
        validators.push(validator);

        // Recalculate required validators
        requiredValidators = (validators.length * 2) / 3 + 1;

        emit ValidatorAdded(validator);
    }

    /**
     * @dev Remove validator
     * @param validator Validator address to remove
     */
    function removeValidator(address validator)
        external
        onlyRole(BRIDGE_ADMIN_ROLE)
    {
        require(hasRole(VALIDATOR_ROLE, validator), "ThaliumBridge: Not a validator");
        require(validators.length > MIN_VALIDATORS, "ThaliumBridge: Cannot remove last validator");

        _revokeRole(VALIDATOR_ROLE, validator);

        // Remove from array
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }

        // Recalculate required validators
        requiredValidators = (validators.length * 2) / 3 + 1;

        emit ValidatorRemoved(validator);
    }

    /**
     * @dev Update chain support
     * @param chainId Chain ID
     * @param supported Whether chain is supported
     */
    function updateChainSupport(uint256 chainId, bool supported)
        external
        onlyRole(BRIDGE_ADMIN_ROLE)
    {
        supportedChains[chainId] = supported;
        emit ChainSupportUpdated(chainId, supported);
    }

    /**
     * @dev Update bridge fee
     * @param newFee New bridge fee in THAL tokens
     */
    function updateBridgeFee(uint256 newFee)
        external
        onlyRole(BRIDGE_ADMIN_ROLE)
    {
        require(newFee >= 0, "ThaliumBridge: Invalid fee");
        bridgeFee = newFee;
        emit BridgeFeeUpdated(newFee);
    }

    /**
     * @dev Withdraw collected fees
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawFees(uint256 amount, address recipient)
        external
        onlyRole(BRIDGE_ADMIN_ROLE)
        nonReentrant
    {
        require(recipient != address(0), "ThaliumBridge: Invalid recipient");
        require(amount > 0, "ThaliumBridge: Amount must be positive");
        require(totalFeesCollected >= amount, "ThaliumBridge: Insufficient fees");

        totalFeesCollected -= amount;
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
     * @dev Get supported chains
     */
    function getSupportedChains() external view returns (uint256[] memory) {
        uint256[] memory chains = new uint256[](10); // Reasonable max
        uint256 count = 0;

        // Check common chain IDs
        uint256[10] memory commonChains = [uint256(1), 56, 137, 43114, 42161, 10, 8453, 100, 250, 1284];

        for (uint256 i = 0; i < commonChains.length; i++) {
            if (supportedChains[commonChains[i]]) {
                chains[count] = commonChains[i];
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = chains[i];
        }

        return result;
    }

    /**
     * @dev Get validators list
     */
    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    /**
     * @dev Get transfer request details
     */
    function getTransferRequest(bytes32 transferId)
        external
        view
        returns (
            address sender,
            address recipient,
            uint256 amount,
            uint256 sourceChainId,
            uint256 targetChainId,
            uint256 timestamp,
            bool executed,
            uint256 validatorCount
        )
    {
        TransferRequest storage request = transferRequests[transferId];
        return (
            request.sender,
            request.recipient,
            request.amount,
            request.sourceChainId,
            request.targetChainId,
            request.timestamp,
            request.executed,
            request.validatorCount
        );
    }

    /**
     * @dev Check if chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }

    /**
     * @dev Get bridge statistics
     */
    function getBridgeStats() external view returns (
        uint256 totalTransferred_,
        uint256 totalFeesCollected_,
        uint256 bridgeFee_,
        uint256 validatorCount,
        uint256 requiredValidators_
    ) {
        return (
            totalTransferred,
            totalFeesCollected,
            bridgeFee,
            validators.length,
            requiredValidators
        );
    }
}