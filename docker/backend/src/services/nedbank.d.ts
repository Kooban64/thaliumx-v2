/**
 * Nedbank Integration Service
 * - Payouts (PayShap / EFT)
 * - Deposit scraping (pool account statements)
 * - Pool account selection (platform or broker-level)
 */
export interface PayoutRequest {
    brokerId?: string;
    poolAccountNumber?: string;
    beneficiary: {
        name: string;
        bankAccountNumber: string;
        bankCode?: string;
        payshapId?: string;
    };
    amount: string;
    currency: string;
    reference: string;
    metadata?: Record<string, any>;
}
export interface PayoutResponse {
    success: boolean;
    payoutId?: string;
    status?: 'pending' | 'processing' | 'settled' | 'failed';
    message?: string;
    fees?: {
        platformFee: string;
        brokerFee: string;
        totalFees: string;
    };
}
export interface DepositScrapeRequest {
    brokerId?: string;
    poolAccountNumber?: string;
    fromDate?: string;
    toDate?: string;
}
export interface DepositRecord {
    id: string;
    amount: string;
    currency: string;
    reference: string;
    bankReference?: string;
    valueDate: string;
    description?: string;
}
export declare class NedbankService {
    private static payoutClient;
    private static depositsClient;
    private static isInit;
    static initialize(): Promise<void>;
    static isHealthy(): boolean;
    /**
     * Initiate payout (PayShap preferred if payshapId present, else EFT)
     */
    static initiatePayout(req: PayoutRequest): Promise<PayoutResponse>;
    /**
     * Scrape deposits for a pool account within a date range
     */
    static scrapeDeposits(req: DepositScrapeRequest): Promise<DepositRecord[]>;
}
//# sourceMappingURL=nedbank.d.ts.map