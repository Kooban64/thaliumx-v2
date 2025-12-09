// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

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
        require(to != address(0), "ThaliumNFT: Invalid recipient");
        require(bytes(uri).length > 0, "ThaliumNFT: Invalid URI");
        require(royaltyFee <= MAX_ROYALTY, "ThaliumNFT: Royalty too high");

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
        require(to != address(0), "ThaliumNFT: Invalid recipient");
        require(uris.length == royaltyFees.length, "ThaliumNFT: Array length mismatch");
        require(uris.length <= MAX_BATCH_SIZE, "ThaliumNFT: Batch size too large");

        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            require(bytes(uris[i]).length > 0, "ThaliumNFT: Invalid URI");
            require(royaltyFees[i] <= MAX_ROYALTY, "ThaliumNFT: Royalty too high");

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
        require(_ownerOf(tokenId) != address(0), "ThaliumNFT: Token does not exist");
        
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
        require(_ownerOf(tokenId) != address(0), "ThaliumNFT: Token does not exist");
        require(recipient != address(0), "ThaliumNFT: Invalid recipient");
        require(fee <= MAX_ROYALTY, "ThaliumNFT: Royalty too high");

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
        require(recipient != address(0), "ThaliumNFT: Invalid recipient");
        require(fee <= MAX_ROYALTY, "ThaliumNFT: Royalty too high");

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
        require(_ownerOf(tokenId) != address(0), "ThaliumNFT: Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "ThaliumNFT: Not token owner");
        require(!stakedTokens[tokenId], "ThaliumNFT: Token already staked");

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
        require(_ownerOf(tokenId) != address(0), "ThaliumNFT: Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "ThaliumNFT: Not token owner");
        require(stakedTokens[tokenId], "ThaliumNFT: Token not staked");

        _unstakeToken(tokenId);
        emit TokenUnstaked(tokenId, msg.sender);
    }

    /**
     * @dev Internal function to unstake token
     * @param tokenId Token ID to unstake
     */
    function _unstakeToken(uint256 tokenId) internal {
        stakedTokens[tokenId] = false;
        totalStakedTokens--;

        // Remove from user's staked tokens array
        uint256[] storage userTokens = userStakedTokens[ownerOf(tokenId)];
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == tokenId) {
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
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
    // OVERRIDE FUNCTIONS
    // ========================================

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

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Royalty, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}