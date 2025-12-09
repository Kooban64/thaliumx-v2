// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ThaliumToken
 * @dev ERC20 token for the Thalium DeFi ecosystem
 *
 * This contract implements a secure ERC20 token with:
 * - Governance capabilities through ERC20Votes
 * - Gasless approvals via ERC20Permit
 * - Role-based access control for administrative functions
 * - Emergency pause functionality
 * - Reentrancy protection
 *
 * Security Model:
 * - On-chain: Core token operations and basic security
 * - Off-chain: Complex validation, KYC, and compliance checks
 *
 * @author Thalium Development Team
 */
contract ThaliumToken is ERC20, ERC20Permit, ERC20Votes, AccessControl, Pausable, ReentrancyGuard {
    // ========================================
    // CONSTANTS
    // ========================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    // ========================================
    // STATE VARIABLES
    // ========================================

    // Track total minted for supply control
    uint256 private _totalMinted;

    // ========================================
    // EVENTS
    // ========================================

    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount, address indexed burner);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @dev Initialize the Thalium token
     * @param defaultAdmin Address with DEFAULT_ADMIN_ROLE
     * @param minter Address with MINTER_ROLE
     * @param pauser Address with PAUSER_ROLE
     * @param burner Address with BURNER_ROLE
     * @param initialSupply Initial token supply to mint
     */
    constructor(
        address defaultAdmin,
        address minter,
        address pauser,
        address burner,
        uint256 initialSupply
    ) ERC20("Thalium", "THAL") ERC20Permit("Thalium") {
        require(defaultAdmin != address(0), "ThaliumToken: Invalid default admin");
        require(minter != address(0), "ThaliumToken: Invalid minter");
        require(pauser != address(0), "ThaliumToken: Invalid pauser");
        require(burner != address(0), "ThaliumToken: Invalid burner");

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(BURNER_ROLE, burner);

        // Mint initial supply if specified
        if (initialSupply > 0) {
            require(initialSupply <= MAX_SUPPLY, "ThaliumToken: Initial supply exceeds max");
            _mint(defaultAdmin, initialSupply);
            _totalMinted = initialSupply;
        }
    }

    // ========================================
    // EXTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Mint new tokens (only MINTER_ROLE)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "ThaliumToken: Cannot mint to zero address");
        require(amount > 0, "ThaliumToken: Amount must be positive");
        require(_totalMinted + amount <= MAX_SUPPLY, "ThaliumToken: Would exceed max supply");

        _totalMinted += amount;
        _mint(to, amount);

        emit TokensMinted(to, amount, msg.sender);
    }

    /**
     * @dev Burn tokens (only BURNER_ROLE)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount)
        external
        onlyRole(BURNER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(from != address(0), "ThaliumToken: Cannot burn from zero address");
        require(amount > 0, "ThaliumToken: Amount must be positive");
        require(balanceOf(from) >= amount, "ThaliumToken: Insufficient balance");

        _burn(from, amount);

        emit TokensBurned(from, amount, msg.sender);
    }

    /**
     * @dev Emergency pause (only PAUSER_ROLE)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @dev Emergency unpause (only DEFAULT_ADMIN_ROLE)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // ========================================
    // PUBLIC VIEW FUNCTIONS
    // ========================================

    /**
     * @dev Get total minted tokens
     */
    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }

    /**
     * @dev Get remaining mintable supply
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - _totalMinted;
    }

    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    /**
     * @dev Override transfer with pause check
     */
    function transfer(address to, uint256 amount)
        public
        override
        whenNotPaused
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    /**
     * @dev Override transferFrom with pause check
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        override
        whenNotPaused
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    /**
     * @dev Override _update for ERC20Votes
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    /**
     * @dev Override nonces for ERC20Permit
     */
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

}