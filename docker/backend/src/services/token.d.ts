/**
 * Token Management Service
 *
 * Core token operations including:
 * - THAL token management (public sales, broker migration)
 * - P2P transfers between users
 * - Staking and governance mechanisms
 * - Gas fee integration
 * - Trading pair integration
 * - Multi-tenant fund segregation
 *
 * Production-ready for financial operations
 */
export interface TokenWallet {
    id: string;
    userId: string;
    tenantId: string;
    tokenSymbol: string;
    tokenAddress?: string;
    available: number;
    locked: number;
    staked: number;
    total: number;
    status: 'active' | 'suspended' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}
export interface TokenTransaction {
    id: string;
    userId: string;
    tenantId: string;
    walletId: string;
    type: 'transfer' | 'stake' | 'unstake' | 'gas_fee' | 'reward' | 'burn' | 'mint';
    tokenSymbol: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    reference: string;
    toUserId?: string;
    toTenantId?: string;
    toWalletId?: string;
    gasFee?: number;
    gasToken?: string;
    blockchainTxHash?: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}
export interface StakingPool {
    id: string;
    tokenSymbol: string;
    apy: number;
    minStakeAmount: number;
    maxStakeAmount?: number;
    lockPeriod: number;
    status: 'active' | 'inactive' | 'full';
    totalStaked: number;
    totalRewards: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface StakingPosition {
    id: string;
    userId: string;
    tenantId: string;
    poolId: string;
    tokenSymbol: string;
    amount: number;
    apy: number;
    lockPeriod: number;
    startDate: Date;
    endDate: Date;
    status: 'active' | 'completed' | 'cancelled';
    rewardsEarned: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface TokenSale {
    id: string;
    tokenSymbol: string;
    price: number;
    totalSupply: number;
    soldAmount: number;
    status: 'upcoming' | 'active' | 'paused' | 'completed' | 'cancelled';
    startDate: Date;
    endDate?: Date;
    minPurchase: number;
    maxPurchase?: number;
    kycRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface GasFeeConfig {
    tokenSymbol: string;
    baseFee: number;
    priorityFee: number;
    maxFee: number;
    gasLimit: number;
    status: 'active' | 'inactive';
    updatedAt: Date;
}
export declare class TokenService {
    private static wallets;
    private static transactions;
    private static stakingPools;
    private static stakingPositions;
    private static tokenSales;
    private static gasFeeConfigs;
    /**
     * Initialize Token service
     */
    static initialize(): Promise<void>;
    /**
     * Create token wallet for user
     */
    static createWallet(userId: string, tenantId: string, tokenSymbol: string, tokenAddress?: string): Promise<TokenWallet>;
    /**
     * Get user token wallets
     */
    static getUserWallets(userId: string, tenantId: string): Promise<TokenWallet[]>;
    /**
     * Get specific token wallet
     */
    static getWallet(userId: string, tenantId: string, tokenSymbol: string): Promise<TokenWallet | null>;
    /**
     * Transfer tokens between users
     */
    static transfer(fromUserId: string, fromTenantId: string, toUserId: string, toTenantId: string, tokenSymbol: string, amount: number, description?: string): Promise<TokenTransaction>;
    /**
     * Stake tokens
     */
    static stake(userId: string, tenantId: string, tokenSymbol: string, amount: number, poolId: string): Promise<TokenTransaction>;
    /**
     * Unstake tokens
     */
    static unstake(userId: string, tenantId: string, positionId: string): Promise<TokenTransaction>;
    /**
     * Purchase tokens in public sale
     */
    static purchaseTokens(userId: string, tenantId: string, saleId: string, amount: number, paymentMethod: string): Promise<TokenTransaction>;
    /**
     * Get staking pools
     */
    static getStakingPools(): Promise<StakingPool[]>;
    /**
     * Get user staking positions
     */
    static getUserStakingPositions(userId: string, tenantId: string): Promise<StakingPosition[]>;
    /**
     * Get active token sales
     */
    static getActiveTokenSales(): Promise<TokenSale[]>;
    /**
     * Get transaction history
     */
    static getTransactionHistory(userId: string, tenantId: string, tokenSymbol?: string, limit?: number, offset?: number): Promise<TokenTransaction[]>;
    private static isValidToken;
    private static processTransfer;
    private static processStaking;
    private static processUnstaking;
    private static processTokenPurchase;
    private static calculateGasFee;
    private static loadStakingPools;
    private static loadTokenSales;
    private static loadGasFeeConfigs;
    private static startStakingRewardsCalculation;
    private static startTokenSaleMonitoring;
    private static calculateStakingRewards;
    private static monitorTokenSales;
    private static saveWallet;
    private static saveTransaction;
    private static emitTokenEvent;
    private static generateWalletId;
    private static generateTransactionId;
    private static generatePositionId;
    private static generateReference;
}
//# sourceMappingURL=token.d.ts.map