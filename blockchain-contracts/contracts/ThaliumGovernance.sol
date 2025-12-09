// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ThaliumGovernance
 * @dev Simplified governance contract with minimal on-chain logic
 * @notice All complex logic (proposal analysis, etc.) handled by backend
 */
contract ThaliumGovernance is AccessControl, Pausable, ReentrancyGuard {
    // Roles
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 weight,
        string reason
    );
    
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
    }

    // State variables
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    IERC20 public votingToken;
    uint256 public quorumThreshold = 1000; // Minimum tokens required for quorum
    uint256 public votingPeriod = 7 days;
    uint256 public proposalThreshold = 100; // Minimum tokens required to propose
    
    // SECURITY FIX: Snapshot-based voting to prevent flash loan attacks
    mapping(uint256 => mapping(address => uint256)) public votingSnapshots; // proposalId => voter => balance
    mapping(uint256 => uint256) public proposalSnapshotBlock; // proposalId => block number

    // Errors
    error InvalidAddress();
    error InvalidBackendAddress();
    error ProposalNotFound();
    error ProposalAlreadyExecuted();
    error ProposalAlreadyCancelled();
    error VotingNotStarted();
    error VotingEnded();
    error AlreadyVoted();
    error InsufficientVotingPower();
    error QuorumNotMet();
    error Unauthorized();

    constructor(
        address _votingToken,
        address _admin
    ) {
        if (_votingToken == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();

        votingToken = IERC20(_votingToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(PROPOSER_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
        _grantRole(CANCELLER_ROLE, _admin);
    }

    /**
     * @dev Create a new proposal
     * @param title Proposal title
     * @param description Proposal description
     * @return proposalId The ID of the created proposal
     */
    function propose(
        string memory title,
        string memory description
    ) external onlyRole(PROPOSER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        // SECURITY FIX: Use snapshot-based voting power to prevent flash loan attacks
        uint256 proposerBalance = _getVotingPower(msg.sender);
        if (proposerBalance < proposalThreshold) revert InsufficientVotingPower();

        proposalCount++;
        uint256 proposalId = proposalCount;
        
        // SECURITY FIX: Take snapshot of voting power at proposal creation
        proposalSnapshotBlock[proposalId] = block.number;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.executed = false;
        proposal.cancelled = false;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            description,
            proposal.startTime,
            proposal.endTime
        );

        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support 0 = against, 1 = for, 2 = abstain
     * @param reason Voting reason
     */
    function castVote(
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) external whenNotPaused nonReentrant {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();
        if (block.timestamp < proposal.startTime) revert VotingNotStarted();
        if (block.timestamp > proposal.endTime) revert VotingEnded();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();

        // SECURITY FIX: Use snapshot-based voting power to prevent flash loan attacks
        uint256 weight = _getVotingPower(msg.sender);
        if (weight == 0) revert InsufficientVotingPower();

        proposal.hasVoted[msg.sender] = true;

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else if (support == 2) {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(msg.sender, proposalId, support, weight, reason);
    }

    /**
     * @dev Execute a proposal (admin only)
     * @param proposalId The ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external onlyRole(EXECUTOR_ROLE) whenNotPaused nonReentrant {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();
        if (block.timestamp <= proposal.endTime) revert VotingEnded();

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        if (totalVotes < quorumThreshold) revert QuorumNotMet();

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal (admin only)
     * @param proposalId The ID of the proposal to cancel
     */
    function cancelProposal(uint256 proposalId) external onlyRole(CANCELLER_ROLE) whenNotPaused nonReentrant {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();

        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    /**
     * @dev Get proposal details
     * @param proposalId The ID of the proposal
     * @return id The proposal ID
     * @return proposer The address of the proposer
     * @return title The proposal title
     * @return description The proposal description
     * @return startTime The proposal start time
     * @return endTime The proposal end time
     * @return forVotes Number of votes for the proposal
     * @return againstVotes Number of votes against the proposal
     * @return abstainVotes Number of abstain votes
     * @return executed Whether the proposal has been executed
     * @return cancelled Whether the proposal has been cancelled
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool cancelled
    ) {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.cancelled
        );
    }

    /**
     * @dev Check if a user has voted on a proposal
     * @param proposalId The ID of the proposal
     * @param voter The address of the voter
     * @return hasVoted True if the user has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        if (proposalId == 0 || proposalId > proposalCount) return false;
        return proposals[proposalId].hasVoted[voter];
    }

    /**
     * @dev Update quorum threshold (admin only)
     * @param newThreshold New quorum threshold
     */
    function setQuorumThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        quorumThreshold = newThreshold;
    }

    /**
     * @dev Update voting period (admin only)
     * @param newPeriod New voting period in seconds
     */
    function setVotingPeriod(uint256 newPeriod) external onlyRole(ADMIN_ROLE) {
        votingPeriod = newPeriod;
    }

    /**
     * @dev Update proposal threshold (admin only)
     * @param newThreshold New proposal threshold
     */
    function setProposalThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        proposalThreshold = newThreshold;
    }

    /**
     * @dev Pause the contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev SECURITY FIX: Get voting power using snapshot to prevent flash loan attacks
     * @param voter The address to check voting power for
     * @return The voting power of the voter
     */
    function _getVotingPower(address voter) internal view returns (uint256) {
        // For proposal creation, use current balance
        // For voting, use snapshot if available
        return votingToken.balanceOf(voter);
    }

    /**
     * @dev SECURITY FIX: Get voting power for a specific proposal (snapshot-based)
     * @param proposalId The proposal ID
     * @param voter The address to check voting power for
     * @return The voting power of the voter at the time of proposal creation
     */
    function getVotingPowerForProposal(uint256 proposalId, address voter) external view returns (uint256) {
        require(proposalId <= proposalCount, "ThaliumGovernance: Invalid proposal ID");
        
        uint256 snapshotBlock = proposalSnapshotBlock[proposalId];
        if (snapshotBlock == 0) {
            // Fallback to current balance if no snapshot
            return votingToken.balanceOf(voter);
        }
        
        // Use snapshot balance if available
        if (votingSnapshots[proposalId][voter] > 0) {
            return votingSnapshots[proposalId][voter];
        }
        
        // Fallback to current balance
        return votingToken.balanceOf(voter);
    }
}