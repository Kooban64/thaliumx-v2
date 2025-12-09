/**
 * Smart Contract Integration Service
 *
 * Comprehensive blockchain integration with 11 smart contracts:
 * - THAL Token Contract (ERC-20 with advanced features)
 * - Presale Contract (Token presale and vesting)
 * - Staking Contract (Token staking and rewards)
 * - Governance Contract (DAO governance and voting)
 * - NFT Contract (ERC-721 NFT marketplace)
 * - DEX Contract (Decentralized exchange)
 * - Lending Contract (DeFi lending protocol)
 * - Insurance Contract (DeFi insurance protocol)
 * - Oracle Contract (Price feeds and data oracles)
 * - MultiSig Contract (Multi-signature wallet)
 * - Factory Contract (Contract deployment factory)
 *
 * Production-ready with comprehensive error handling
 */
import { Contract, Wallet, TransactionReceipt } from 'ethers';
export interface ContractConfig {
    address: string;
    abi: any[];
    bytecode?: string;
    deployedAt?: Date;
    networkId: number;
    gasLimit?: number;
    gasPrice?: string;
}
export interface ContractDeployment {
    contractName: string;
    address: string;
    transactionHash: string;
    blockNumber: number;
    gasUsed: number;
    deployedAt: Date;
    networkId: number;
    constructorArgs: any[];
}
export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    balance: string;
    allowance: string;
    owner: string;
    paused: boolean;
    mintable: boolean;
    burnable: boolean;
    capped: boolean;
    cap: string;
}
export interface PresaleInfo {
    tokenAddress: string;
    tokenPrice: string;
    tokensForSale: string;
    tokensSold: string;
    startTime: number;
    endTime: number;
    minPurchase: string;
    maxPurchase: string;
    paused: boolean;
    finalized: boolean;
    raised: string;
    beneficiary: string;
}
export interface StakingInfo {
    tokenAddress: string;
    stakingToken: string;
    rewardToken: string;
    totalStaked: string;
    totalRewards: string;
    rewardRate: string;
    periodFinish: number;
    lastUpdateTime: number;
    rewardPerTokenStored: string;
    userStake: string;
    userReward: string;
    userRewardPerTokenPaid: string;
}
export interface GovernanceInfo {
    tokenAddress: string;
    votingDelay: number;
    votingPeriod: number;
    proposalThreshold: string;
    quorumVotes: string;
    proposalCount: number;
    activeProposals: number;
    executedProposals: number;
    cancelledProposals: number;
}
export interface NFTInfo {
    tokenId: string;
    owner: string;
    tokenURI: string;
    name: string;
    description: string;
    image: string;
    attributes: any[];
    price: string;
    forSale: boolean;
    creator: string;
    createdAt: number;
}
export interface DEXInfo {
    tokenA: string;
    tokenB: string;
    reserveA: string;
    reserveB: string;
    totalSupply: string;
    k: string;
    fee: number;
    protocolFee: number;
    liquidity: string;
    price: string;
    volume24h: string;
}
export interface LendingInfo {
    tokenAddress: string;
    totalSupply: string;
    totalBorrow: string;
    utilizationRate: string;
    borrowRate: string;
    supplyRate: string;
    reserveFactor: string;
    collateralFactor: string;
    liquidationThreshold: string;
    userSupply: string;
    userBorrow: string;
    userCollateral: string;
}
export interface InsuranceInfo {
    policyId: string;
    policyholder: string;
    coverageAmount: string;
    premium: string;
    duration: number;
    startTime: number;
    endTime: number;
    status: 'active' | 'expired' | 'claimed' | 'cancelled';
    riskCategory: string;
    payoutAmount: string;
}
export interface OracleInfo {
    feedId: string;
    price: string;
    timestamp: number;
    decimals: number;
    roundId: number;
    aggregator: string;
    heartbeat: number;
    deviationThreshold: string;
    minAnswers: number;
    maxAnswers: number;
}
export interface MultiSigInfo {
    address: string;
    owners: string[];
    required: number;
    transactionCount: number;
    pendingTransactions: number;
    executedTransactions: number;
    cancelledTransactions: number;
}
export interface FactoryInfo {
    templateCount: number;
    deployedContracts: string[];
    deploymentFees: string;
    owner: string;
    paused: boolean;
}
export interface TransactionRequest {
    to: string;
    data: string;
    value?: string;
    gasLimit?: number;
    gasPrice?: string;
    nonce?: number;
}
export interface TransactionResult {
    hash: string;
    receipt: TransactionReceipt | null;
    success: boolean;
    gasUsed: number;
    blockNumber: number;
    timestamp: number;
    error?: string;
    message?: string;
}
export interface ContractCallResult {
    success: boolean;
    data?: any;
    error?: string;
    gasUsed?: number;
}
export declare class SmartContractService {
    /**
     * Resolve contract addresses for a given tenant.
     * Falls back to default addresses when tenant-specific config is not provided.
     */
    static getAddresses(tenantId?: string): {
        THAL_TOKEN: string;
        THALIUM_PRESALE: string;
        THALIUM_VESTING: string;
        THALIUM_DEX?: string;
        THALIUM_MARGIN_VAULT?: string;
        THALIUM_GOVERNANCE?: string;
        THALIUM_NFT?: string;
        THALIUM_ORACLE?: string;
        THALIUM_BRIDGE?: string;
        THALIUM_SECURITY?: string;
        EMERGENCY_CONTROLS?: string;
        USDT_TOKEN?: string;
        USDC_TOKEN?: string;
    };
    private static isInitialized;
    private static provider;
    private static wallet;
    private static contracts;
    private static deployments;
    private static readonly CONTRACT_ABIS;
    /**
     * Initialize Smart Contract Service
     */
    static initialize(): Promise<void>;
    /**
     * Deploy a new contract
     */
    static deployContract(contractName: string, abi: any[], bytecode: string, constructorArgs?: any[], gasLimit?: number): Promise<ContractDeployment>;
    /**
     * Get contract instance
     */
    static getContract(contractName: string, address?: string): Contract | null;
    /**
     * Get token info
     */
    static getTokenInfo(contractAddress: string): Promise<TokenInfo | null>;
    /**
     * Get presale info
     */
    static getPresaleInfo(contractAddress: string): Promise<PresaleInfo | null>;
    /**
     * Get staking info
     */
    static getStakingInfo(contractAddress: string, userAddress?: string): Promise<StakingInfo | null>;
    /**
     * Execute contract transaction
     */
    static executeTransaction(contractAddress: string, abi: any[], method: string, args?: any[], value?: string, gasLimit?: number): Promise<TransactionResult>;
    /**
     * Call contract method (read-only)
     */
    static callContract(contractAddress: string, abi: any[], method: string, args?: any[]): Promise<ContractCallResult>;
    /**
     * Get network ID
     */
    static getNetworkId(): Promise<number>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    /**
     * Approve USDT spending for presale contract
     */
    static approveUSDT(userWallet: Wallet, usdtAmount: bigint, usdtTokenAddress: string): Promise<TransactionResult>;
    /**
     * Purchase presale tokens on-chain
     */
    static purchasePresaleTokens(userWallet: Wallet, usdtAmount: bigint, presaleAddress?: string): Promise<{
        transaction: TransactionResult;
        vestingScheduleId?: string;
        thalAmount: bigint;
    }>;
    /**
     * Get vesting schedule information
     */
    static getVestingSchedule(scheduleId: string, vestingAddress?: string): Promise<{
        beneficiary: string;
        totalAmount: bigint;
        releasedAmount: bigint;
        startTime: number;
        cliffDuration: number;
        vestingDuration: number;
        revocable: boolean;
        revoked: boolean;
        category: string;
        lastClaimTime: number;
    } | null>;
    /**
     * Get releasable amount for vesting schedule
     */
    static getReleasableAmount(scheduleId: string, vestingAddress?: string): Promise<bigint>;
    /**
     * Release vested tokens
     */
    static releaseVestedTokens(userWallet: Wallet, scheduleId: string, vestingAddress?: string): Promise<TransactionResult>;
    /**
     * Get THAL token balance for address
     */
    static getTHALBalance(address: string, tokenAddress?: string): Promise<bigint>;
    private static eventListeners;
    /**
     * Start listening to contract events
     */
    static startEventListeners(): Promise<void>;
    /**
     * Listen to presale contract events
     */
    private static listenToPresaleEvents;
    /**
     * Listen to vesting contract events
     */
    private static listenToVestingEvents;
    /**
     * Stop all event listeners
     */
    static stopEventListeners(): void;
    private static loadDeployedContracts;
}
//# sourceMappingURL=smart-contracts.d.ts.map