// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ThaliumNFT
 * @dev NFT marketplace contract with royalty management and staking
 * @notice Minimal on-chain logic, complex operations handled by backend
 */
contract ThaliumNFT is 
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC721Royalty,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant ROYALTY_MANAGER_ROLE = keccak256("ROYALTY_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Constants
    uint256 public constant MAX_ROYALTY = 1000; // 10% max royalty
    uint256 public constant MAX_BATCH_SIZE = 100;

    // State variables
    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint256) public tokenRoyaltyFees;
    mapping(uint256 => bool) public stakedTokens;
    mapping(address => uint256[]) public userStakedTokens;
    uint256 public totalStakedTokens;

    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId, string uri, uint256 royaltyFee);
    event TokenBurned(uint256 indexed tokenId);
    event RoyaltyUpdated(uint256 indexed tokenId, address recipient, uint256 fee);
    event DefaultRoyaltyUpdated(address recipient, uint256 fee);
    event TokenStaked(uint256 indexed tokenId, address indexed owner);
    event TokenUnstaked(uint256 indexed tokenId, address indexed owner);

    // Errors
    error InvalidAddress();
    error InvalidTokenId();
    error TokenNotStaked();
    error TokenAlreadyStaked();
    error RoyaltyTooHigh();
    error BatchSizeTooLarge();
    error Unauthorized();

    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC721(name, symbol) {
        if (admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(ROYALTY_MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ========================================
    // MINTING FUNCTIONS
    // ========================================

    /**
     * @dev Mint NFT to address
     * @param to Address to mint to
     * @param uri Token metadata URI
     * @param royaltyFee Royalty fee (in basis points)
     */
    function mint(
        address to,
        string memory uri,
        uint256 royaltyFee
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        if (to == address(0)) revert InvalidAddress();
        if (bytes(uri).length == 0) revert InvalidTokenId();
        if (royaltyFee > MAX_ROYALTY) revert RoyaltyTooHigh();

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        tokenRoyaltyFees[tokenId] = royaltyFee;

        emit TokenMinted(to, tokenId, uri, royaltyFee);
        return tokenId;
    }

    /**
     * @dev Batch mint NFTs
     * @param to Address to mint to
     * @param uris Array of token metadata URIs
     * @param royaltyFees Array of royalty fees
     */
    function batchMint(
        address to,
        string[] memory uris,
        uint256[] memory royaltyFees
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        if (to == address(0)) revert InvalidAddress();
        if (uris.length != royaltyFees.length) revert InvalidTokenId();
        if (uris.length > MAX_BATCH_SIZE) revert BatchSizeTooLarge();

        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            if (bytes(uris[i]).length == 0) revert InvalidTokenId();
            if (royaltyFees[i] > MAX_ROYALTY) revert RoyaltyTooHigh();

            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenRoyaltyFees[tokenId] = royaltyFees[i];
            tokenIds[i] = tokenId;

            emit TokenMinted(to, tokenId, uris[i], royaltyFees[i]);
        }

        return tokenIds;
    }

    /**
     * @dev Burn NFT
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external onlyRole(BURNER_ROLE) whenNotPaused nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert InvalidTokenId();
        
        // Unstake if staked
        if (stakedTokens[tokenId]) {
            _unstakeToken(tokenId);
        }

        _burn(tokenId);
        delete tokenRoyaltyFees[tokenId];
        
        emit TokenBurned(tokenId);
    }

    // ========================================
    // ROYALTY FUNCTIONS
    // ========================================

    /**
     * @dev Set token royalty
     * @param tokenId Token ID
     * @param recipient Royalty recipient
     * @param fee Royalty fee (in basis points)
     */
    function setTokenRoyalty(
        uint256 tokenId,
        address recipient,
        uint256 fee
    ) external onlyRole(ROYALTY_MANAGER_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert InvalidTokenId();
        if (recipient == address(0)) revert InvalidAddress();
        if (fee > MAX_ROYALTY) revert RoyaltyTooHigh();

        _setTokenRoyalty(tokenId, recipient, uint96(fee));
        tokenRoyaltyFees[tokenId] = fee;

        emit RoyaltyUpdated(tokenId, recipient, fee);
    }

    /**
     * @dev Set default royalty
     * @param recipient Royalty recipient
     * @param fee Royalty fee (in basis points)
     */
    function setDefaultRoyalty(
        address recipient,
        uint256 fee
    ) external onlyRole(ROYALTY_MANAGER_ROLE) {
        if (recipient == address(0)) revert InvalidAddress();
        if (fee > MAX_ROYALTY) revert RoyaltyTooHigh();

        _setDefaultRoyalty(recipient, uint96(fee));
        emit DefaultRoyaltyUpdated(recipient, fee);
    }

    // ========================================
    // STAKING FUNCTIONS
    // ========================================

    /**
     * @dev Stake NFT
     * @param tokenId Token ID to stake
     */
    function stakeToken(uint256 tokenId) external whenNotPaused nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert InvalidTokenId();
        if (ownerOf(tokenId) != msg.sender) revert Unauthorized();
        if (stakedTokens[tokenId]) revert TokenAlreadyStaked();

        stakedTokens[tokenId] = true;
        userStakedTokens[msg.sender].push(tokenId);
        totalStakedTokens++;

        emit TokenStaked(tokenId, msg.sender);
    }

    /**
     * @dev Unstake NFT
     * @param tokenId Token ID to unstake
     */
    function unstakeToken(uint256 tokenId) external whenNotPaused nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert InvalidTokenId();
        if (ownerOf(tokenId) != msg.sender) revert Unauthorized();
        if (!stakedTokens[tokenId]) revert TokenNotStaked();

        _unstakeToken(tokenId);
        emit TokenUnstaked(tokenId, msg.sender);
    }

    // ========================================
    // OVERRIDE FUNCTIONS
    // ========================================

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Royalty, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ========================================
    // VIEW FUNCTIONS
    // ========================================

    /**
     * @dev Get user's staked tokens
     * @param user User address
     * @return Array of staked token IDs
     */
    function getUserStakedTokens(address user) external view returns (uint256[] memory) {
        return userStakedTokens[user];
    }

    /**
     * @dev Check if token is staked
     * @param tokenId Token ID
     * @return True if token is staked
     */
    function isTokenStaked(uint256 tokenId) external view returns (bool) {
        return stakedTokens[tokenId];
    }

    /**
     * @dev Internal function to unstake token
     * @param tokenId Token ID to unstake
     */
    function _unstakeToken(uint256 tokenId) internal {
        stakedTokens[tokenId] = false;
        totalStakedTokens--;

        uint256[] storage userTokens = userStakedTokens[ownerOf(tokenId)];
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == tokenId) {
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
    }

    /**
     * @dev Get token royalty fee
     * @param tokenId Token ID
     * @return Royalty fee in basis points
     */
    function getTokenRoyaltyFee(uint256 tokenId) external view returns (uint256) {
        return tokenRoyaltyFees[tokenId];
    }

    /**
     * @dev Get total staked tokens count
     * @return Total number of staked tokens
     */
    function getTotalStakedTokens() external view returns (uint256) {
        return totalStakedTokens;
    }
}
