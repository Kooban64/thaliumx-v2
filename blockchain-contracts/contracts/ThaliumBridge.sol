// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ThaliumBridge is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct TransferRequest {
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChainId;
        uint256 targetChainId;
        uint256 nonce;
        uint256 timestamp;
        uint256 deadline;
        bytes32 transferId;
        bool executed;
    }

    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant TRANSFER_TYPEHASH = keccak256(
        "BridgeTransfer(bytes32 transferId,address sender,address recipient,uint256 amount,uint256 sourceChainId,uint256 targetChainId,uint256 nonce,uint256 deadline)"
    );

    uint256 public constant MIN_VALIDATORS = 3;
    uint256 public constant MAX_VALIDATORS = 10;
    uint256 public constant TRANSFER_EXPIRY = 24 hours;
    uint256 public constant MAX_BRIDGE_FEE = 1_000 * 10 ** 18;

    IERC20 public immutable THAL_TOKEN;

    mapping(bytes32 => TransferRequest) public transferRequests;
    mapping(uint256 => bool) public supportedChains;
    mapping(address => uint256) public userNonces;
    mapping(bytes32 => bool) public completedTransferDigests;

    uint256 public bridgeFee;
    uint256 public totalTransferred;
    uint256 public totalFeesCollected;
    uint256 public requiredValidators;

    address[] private validatorList;
    uint256[] private supportedChainList;

    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 nonce,
        uint256 deadline
    );
    event TransferCompleted(bytes32 indexed transferId, address indexed recipient, uint256 amount, uint256 sourceChainId);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ChainSupportUpdated(uint256 indexed chainId, bool supported);
    event BridgeFeeUpdated(uint256 newFee);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedChain();
    error SameChainTransfer();
    error TransferNotFound();
    error TransferAlreadyExecuted();
    error TransferExpired();
    error InvalidSignatureCount();
    error DuplicateValidator();
    error SignerNotValidator();
    error InvalidTransferData();
    error InvalidBridgeFee();
    error TooManyValidators();
    error ValidatorAlreadyExists();
    error ValidatorDoesNotExist();
    error MinimumValidatorThresholdBreach();
    error TransferAlreadyExists();

    constructor(address thalTokenAddress, address defaultAdmin, address bridgeAdmin, address[] memory initialValidators) {
        if (thalTokenAddress == address(0) || defaultAdmin == address(0) || bridgeAdmin == address(0)) {
            revert InvalidAddress();
        }
        if (initialValidators.length < MIN_VALIDATORS || initialValidators.length > MAX_VALIDATORS) {
            revert InvalidSignatureCount();
        }

        THAL_TOKEN = IERC20(thalTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(BRIDGE_ADMIN_ROLE, bridgeAdmin);

        for (uint256 i = 0; i < initialValidators.length; i++) {
            _addValidator(initialValidators[i]);
        }

        requiredValidators = _calculateRequiredValidators(initialValidators.length);
        _setChainSupport(1, true);
        _setChainSupport(56, true);
        _setChainSupport(137, true);
        _setChainSupport(43114, true);
        bridgeFee = 10 * 10 ** 18;
    }

    function initiateTransfer(address recipient, uint256 amount, uint256 targetChainId)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 transferId)
    {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (!supportedChains[targetChainId]) {
            revert UnsupportedChain();
        }
        if (targetChainId == block.chainid) {
            revert SameChainTransfer();
        }

        uint256 totalAmount = amount + bridgeFee;
        uint256 nonce = userNonces[msg.sender];
        uint256 deadline = block.timestamp + TRANSFER_EXPIRY;

        transferId = keccak256(
            abi.encodePacked(msg.sender, recipient, amount, block.chainid, targetChainId, nonce, deadline)
        );

        if (transferRequests[transferId].timestamp != 0) {
            revert TransferAlreadyExists();
        }

        transferRequests[transferId] = TransferRequest({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            sourceChainId: block.chainid,
            targetChainId: targetChainId,
            nonce: nonce,
            timestamp: block.timestamp,
            deadline: deadline,
            transferId: transferId,
            executed: false
        });

        userNonces[msg.sender] = nonce + 1;
        THAL_TOKEN.safeTransferFrom(msg.sender, address(this), totalAmount);
        totalTransferred += amount;
        totalFeesCollected += bridgeFee;

        emit TransferInitiated(transferId, msg.sender, recipient, amount, block.chainid, targetChainId, nonce, deadline);
    }

    function completeTransfer(
        bytes32 transferId,
        address sender,
        address recipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 nonce,
        uint256 deadline,
        bytes[] calldata signatures
    ) external whenNotPaused nonReentrant {
        TransferRequest storage request = transferRequests[transferId];
        if (request.timestamp == 0) {
            revert TransferNotFound();
        }
        if (request.executed) {
            revert TransferAlreadyExecuted();
        }
        if (block.timestamp > deadline || block.timestamp > request.deadline) {
            revert TransferExpired();
        }
        if (
            request.sender != sender ||
            request.recipient != recipient ||
            request.amount != amount ||
            request.sourceChainId != sourceChainId ||
            request.targetChainId != targetChainId ||
            request.nonce != nonce ||
            request.deadline != deadline
        ) {
            revert InvalidTransferData();
        }
        if (targetChainId != block.chainid) {
            revert SameChainTransfer();
        }
        if (signatures.length < requiredValidators) {
            revert InvalidSignatureCount();
        }

        bytes32 digest = _buildTransferDigest(transferId, sender, recipient, amount, sourceChainId, targetChainId, nonce, deadline);
        if (completedTransferDigests[digest]) {
            revert TransferAlreadyExecuted();
        }

        address previousSigner = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(digest, signatures[i]);
            if (!hasRole(VALIDATOR_ROLE, signer)) {
                revert SignerNotValidator();
            }
            if (signer <= previousSigner) {
                revert DuplicateValidator();
            }
            previousSigner = signer;
        }

        completedTransferDigests[digest] = true;
        request.executed = true;
        THAL_TOKEN.safeTransfer(recipient, amount);

        emit TransferCompleted(transferId, recipient, amount, sourceChainId);
    }

    function addValidator(address validator) external onlyRole(BRIDGE_ADMIN_ROLE) {
        if (validatorList.length >= MAX_VALIDATORS) {
            revert TooManyValidators();
        }
        _addValidator(validator);
        requiredValidators = _calculateRequiredValidators(validatorList.length);
    }

    function removeValidator(address validator) external onlyRole(BRIDGE_ADMIN_ROLE) {
        if (!hasRole(VALIDATOR_ROLE, validator)) {
            revert ValidatorDoesNotExist();
        }
        if (validatorList.length <= MIN_VALIDATORS) {
            revert MinimumValidatorThresholdBreach();
        }

        _revokeRole(VALIDATOR_ROLE, validator);
        uint256 lastIndex = validatorList.length - 1;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validatorList[i] == validator) {
                validatorList[i] = validatorList[lastIndex];
                validatorList.pop();
                break;
            }
        }

        requiredValidators = _calculateRequiredValidators(validatorList.length);
        emit ValidatorRemoved(validator);
    }

    function updateChainSupport(uint256 chainId, bool supported) external onlyRole(BRIDGE_ADMIN_ROLE) {
        _setChainSupport(chainId, supported);
    }

    function updateBridgeFee(uint256 newFee) external onlyRole(BRIDGE_ADMIN_ROLE) {
        if (newFee > MAX_BRIDGE_FEE) {
            revert InvalidBridgeFee();
        }
        bridgeFee = newFee;
        emit BridgeFeeUpdated(newFee);
    }

    function withdrawFees(uint256 amount, address recipient) external onlyRole(BRIDGE_ADMIN_ROLE) nonReentrant {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0 || amount > totalFeesCollected) {
            revert InvalidAmount();
        }

        totalFeesCollected -= amount;
        THAL_TOKEN.safeTransfer(recipient, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    function getSupportedChains() external view returns (uint256[] memory) {
        return supportedChainList;
    }

    function getValidators() external view returns (address[] memory) {
        return validatorList;
    }

    function getTransferRequest(bytes32 transferId) external view returns (TransferRequest memory) {
        TransferRequest storage request = transferRequests[transferId];
        if (request.timestamp == 0) {
            revert TransferNotFound();
        }
        return request;
    }

    function isChainSupported(uint256 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }

    function getBridgeStats()
        external
        view
        returns (uint256 totalTransferred_, uint256 totalFeesCollected_, uint256 bridgeFee_, uint256 validatorCount, uint256 requiredValidators_)
    {
        return (totalTransferred, totalFeesCollected, bridgeFee, validatorList.length, requiredValidators);
    }

    function getTransferDigest(
        bytes32 transferId,
        address sender,
        address recipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _buildTransferDigest(transferId, sender, recipient, amount, sourceChainId, targetChainId, nonce, deadline);
    }

    function _addValidator(address validator) internal {
        if (validator == address(0)) {
            revert InvalidAddress();
        }
        if (hasRole(VALIDATOR_ROLE, validator)) {
            revert ValidatorAlreadyExists();
        }

        _grantRole(VALIDATOR_ROLE, validator);
        validatorList.push(validator);
        emit ValidatorAdded(validator);
    }

    function _setChainSupport(uint256 chainId, bool supported) internal {
        bool exists = supportedChains[chainId];
        supportedChains[chainId] = supported;

        if (supported && !exists) {
            supportedChainList.push(chainId);
        }

        if (!supported && exists) {
            uint256 lastIndex = supportedChainList.length - 1;
            for (uint256 i = 0; i < supportedChainList.length; i++) {
                if (supportedChainList[i] == chainId) {
                    supportedChainList[i] = supportedChainList[lastIndex];
                    supportedChainList.pop();
                    break;
                }
            }
        }

        emit ChainSupportUpdated(chainId, supported);
    }

    function _buildTransferDigest(
        bytes32 transferId,
        address sender,
        address recipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_TYPEHASH, transferId, sender, recipient, amount, sourceChainId, targetChainId, nonce, deadline)
        );
        return MessageHashUtils.toEthSignedMessageHash(keccak256(abi.encode(block.chainid, address(this), structHash)));
    }

    function _calculateRequiredValidators(uint256 validatorCount) internal pure returns (uint256) {
        return (validatorCount * 2) / 3 + 1;
    }
}
