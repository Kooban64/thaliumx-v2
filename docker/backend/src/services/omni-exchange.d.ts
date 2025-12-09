/**
 * Omni Exchange Aggregator Service
 *
 * CRITICAL ARCHITECTURE: Single platform account per exchange
 * - Each exchange sees only ONE account from ThaliumX platform
 * - All fund segregation happens at platform level (broker/customer)
 * - Exchange orders are placed on behalf of internal users
 * - Internal ledger tracks all broker/customer allocations
 *
 * Features:
 * - Multi-exchange aggregation (KuCoin, Bybit, OKX, Kraken, VALR, Bitstamp, Crypto.com)
 * - Platform-level fund segregation (broker/customer separation)
 * - Internal order management and allocation
 * - Risk management with QuantLib integration
 * - Compliance monitoring and audit trails
 * - Real-time balance tracking per broker/customer
 */
import { Pool } from 'pg';
export interface ExchangeConfig {
    id: string;
    name: string;
    type: 'native' | 'public';
    status: 'active' | 'degraded' | 'inactive';
    enabled: boolean;
    priority: number;
    baseURL: string;
    credentials: {
        apiKey: string;
        apiSecret: string;
        passphrase?: string;
        sandbox?: boolean;
    };
    limits: {
        rateLimit: number;
        orderLimit: number;
        withdrawalLimit: number;
    };
    capabilities: string[];
    health: ExchangeHealth;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
export interface ExchangeHealth {
    status: 'healthy' | 'degraded' | 'down';
    lastCheck: Date;
    responseTime: number;
    errorRate: number;
    uptime: number;
    activeConnections: number;
}
export interface ExchangeOrder {
    id: string;
    tenantId: string;
    brokerId: string;
    userId: string;
    exchangeId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    amount: string;
    price?: string;
    stopPrice?: string;
    status: 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
    filledAmount: string;
    averagePrice: string;
    fees: string;
    externalOrderId?: string;
    fundSegregation: {
        platformAccount: string;
        brokerAllocation: string;
        customerAllocation: string;
        orderPool: string;
        feePool: string;
        settlementPool: string;
    };
    riskMetrics: {
        exposure: number;
        maxDrawdown: number;
        volatility: number;
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
export interface PlatformFundAllocation {
    id: string;
    exchangeId: string;
    asset: string;
    totalPlatformBalance: string;
    brokerAllocations: Map<string, string>;
    customerAllocations: Map<string, Map<string, string>>;
    availableForAllocation: string;
    lastUpdated: Date;
}
export interface InternalOrder {
    id: string;
    tenantId: string;
    brokerId: string;
    userId: string;
    exchangeId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    amount: string;
    price?: string;
    status: 'pending' | 'allocated' | 'submitted' | 'filled' | 'cancelled' | 'rejected';
    allocatedAmount: string;
    filledAmount: string;
    averagePrice: string;
    fees: string;
    externalOrderId?: string;
    fundAllocation: {
        allocatedFrom: string;
        allocatedAmount: string;
        feeAllocation: string;
    };
    compliance: {
        travelRule: TravelRuleData;
        carfReporting: CARFReportingData;
        riskAssessment: RiskAssessmentData;
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
export interface TravelRuleData {
    originator: {
        name: string;
        accountNumber: string;
        address: string;
        dateOfBirth?: string;
        nationalId?: string;
        country: string;
        brokerId: string;
        customerId: string;
    };
    beneficiary: {
        name: string;
        accountNumber: string;
        address: string;
        dateOfBirth?: string;
        nationalId?: string;
        country: string;
        brokerId?: string;
        customerId?: string;
    };
    transaction: {
        amount: string;
        currency: string;
        transactionId: string;
        timestamp: Date;
        purpose: string;
        reference?: string;
    };
    vasp: {
        originatorVasp: {
            name: string;
            country: string;
            registrationNumber: string;
            address: string;
        };
        beneficiaryVasp?: {
            name: string;
            country: string;
            registrationNumber: string;
            address: string;
        };
    };
    status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
    messageId: string;
    timestamp: Date;
}
export interface CARFReportingData {
    reportingEntity: {
        name: string;
        country: string;
        registrationNumber: string;
        address: string;
    };
    reportablePerson: {
        name: string;
        address: string;
        dateOfBirth?: string;
        nationalId?: string;
        country: string;
        taxId?: string;
    };
    cryptoAsset: {
        type: string;
        amount: string;
        value: string;
        currency: string;
    };
    transaction: {
        type: 'exchange' | 'transfer' | 'disposal' | 'acquisition';
        date: Date;
        counterparty?: string;
        platform?: string;
        fees: string;
    };
    reportingPeriod: {
        startDate: Date;
        endDate: Date;
    };
    status: 'pending' | 'submitted' | 'acknowledged' | 'rejected';
    reportId: string;
    submissionDate?: Date;
}
export interface RiskAssessmentData {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: {
        amount: number;
        frequency: number;
        geography: number;
        counterparty: number;
        pattern: number;
    };
    flags: string[];
    recommendations: string[];
    assessmentDate: Date;
    assessor: string;
}
export interface ExchangeBalance {
    id: string;
    tenantId: string;
    brokerId: string;
    exchangeId: string;
    asset: string;
    available: string;
    locked: string;
    total: string;
    lastUpdated: Date;
}
export interface ExchangeRoutingDecision {
    exchangeId: string;
    exchangeName: string;
    priority: number;
    reason: string;
    metrics: {
        price: number;
        liquidity: number;
        fees: number;
        responseTime: number;
        reliability: number;
    };
}
export declare class OmniExchangeService {
    private db;
    private exchanges;
    private adapters;
    private eventStreamingService;
    private quantlibService;
    private blnkfinanceService;
    private healthMonitoringInterval;
    private reconciliationInterval;
    private platformAllocations;
    private internalOrders;
    private travelRuleMessages;
    private carfReports;
    constructor(db: Pool);
    /**
     * Initialize the Omni Exchange service
     */
    initialize(): Promise<void>;
    /**
     * Load exchange configurations from database
     */
    private loadExchangeConfigurations;
    /**
     * Initialize exchange adapters
     */
    private initializeAdapters;
    /**
     * Initialize platform fund allocations for each exchange
     */
    private initializePlatformAllocations;
    /**
     * Allocate funds to broker/customer from platform balance
     */
    allocateFunds(exchangeId: string, asset: string, brokerId: string, customerId: string, amount: string): Promise<boolean>;
    /**
     * Deallocate funds from broker/customer back to platform
     */
    deallocateFunds(exchangeId: string, asset: string, brokerId: string, customerId: string, amount: string): Promise<boolean>;
    /**
     * Get available balance for broker/customer
     */
    getAvailableBalance(exchangeId: string, asset: string, brokerId: string, customerId: string): string;
    /**
     * Start health monitoring for all exchanges
     */
    private startHealthMonitoring;
    /**
     * Start periodic reconciliation job
     */
    private startReconciliationJob;
    private startOpenOrderReconciliation;
    /**
     * Determine the best exchange for an order
     */
    determineBestExchange(symbol: string, side: 'buy' | 'sell', amount: string): Promise<ExchangeRoutingDecision>;
    /**
     * Place order with platform-level fund segregation
     */
    placeOrder(tenantId: string, brokerId: string, userId: string, params: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit';
        amount: string;
        price?: string;
    }): Promise<InternalOrder>;
    private generateIdempotencyKey;
    /**
     * Get order status
     */
    getOrderStatus(orderId: string, exchangeId: string): Promise<ExchangeOrder>;
    /**
     * Cancel order
     */
    cancelOrder(orderId: string, exchangeId: string): Promise<void>;
    /**
     * Get balance from exchange
     */
    getBalance(exchangeId: string, asset: string): Promise<ExchangeBalance>;
    /**
     * Get all exchange configurations
     */
    getAvailableExchanges(): ExchangeConfig[];
    /**
     * Get exchange health
     */
    getExchangeHealth(exchangeId: string): ExchangeHealth | null;
    /**
     * Get platform fund allocations
     */
    getPlatformAllocations(): PlatformFundAllocation[];
    /**
     * Get platform allocation for specific exchange/asset
     */
    getPlatformAllocation(exchangeId: string, asset: string): PlatformFundAllocation | null;
    /**
     * Get internal order by ID
     */
    getInternalOrder(orderId: string): InternalOrder | null;
    /**
     * Get all internal orders for broker/customer
     */
    getInternalOrders(brokerId: string, customerId?: string): InternalOrder[];
    /**
     * Generate Travel Rule data for transaction
     */
    generateTravelRuleData(order: InternalOrder, originatorData: any, beneficiaryData?: any): Promise<TravelRuleData>;
    /**
     * Run internal compliance self-test without external exchange calls.
     * Generates Travel Rule, CARF report, and Risk Assessment for a mock order.
     */
    runComplianceSelfTest(brokerId: string, userId: string): Promise<{
        travelRule: TravelRuleData;
        carf: CARFReportingData;
        risk: RiskAssessmentData;
        order: InternalOrder;
    }>;
    /**
     * Generate CARF reporting data
     */
    generateCARFReport(order: InternalOrder, customerData: any): Promise<CARFReportingData>;
    /**
     * Perform risk assessment for transaction
     */
    performRiskAssessment(order: InternalOrder, customerData: any): Promise<RiskAssessmentData>;
    /**
     * Submit Travel Rule message
     */
    submitTravelRuleMessage(messageId: string): Promise<boolean>;
    /**
     * Submit CARF report
     */
    submitCARFReport(reportId: string): Promise<boolean>;
    /**
     * Get Travel Rule messages
     */
    getTravelRuleMessages(): TravelRuleData[];
    /**
     * Get CARF reports
     */
    getCARFReports(): CARFReportingData[];
    /**
     * Get user's asset distribution across all exchanges
     */
    getUserAssetDistribution(userId: string, brokerId: string): Promise<{
        userId: string;
        brokerId: string;
        totalAssets: Map<string, string>;
        exchangeBreakdown: Map<string, Map<string, string>>;
        lastUpdated: Date;
    }>;
    /**
     * Get broker's total assets across all exchanges
     */
    getBrokerAssetDistribution(brokerId: string): Promise<{
        brokerId: string;
        totalAssets: Map<string, string>;
        exchangeBreakdown: Map<string, Map<string, string>>;
        customerCount: number;
        lastUpdated: Date;
    }>;
    /**
     * Get platform-level asset reconciliation across all exchanges
     */
    getPlatformAssetReconciliation(): Promise<{
        platformTotals: Map<string, string>;
        exchangeBalances: Map<string, Map<string, string>>;
        internalAllocations: Map<string, Map<string, string>>;
        reconciliation: Map<string, {
            exchangeId: string;
            asset: string;
            actualBalance: string;
            allocatedAmount: string;
            difference: string;
            status: 'balanced' | 'over_allocated' | 'under_allocated';
        }>;
        lastUpdated: Date;
    }>;
    /**
     * Get detailed asset breakdown for specific user
     */
    getUserDetailedAssets(userId: string, brokerId: string): Promise<{
        userId: string;
        brokerId: string;
        assets: Array<{
            asset: string;
            totalAmount: string;
            exchanges: Array<{
                exchangeId: string;
                exchangeName: string;
                amount: string;
                status: 'healthy' | 'degraded' | 'down';
            }>;
        }>;
        lastUpdated: Date;
    }>;
    /**
     * Run comprehensive compliance test suite
     */
    runComplianceTestSuite(): Promise<any>;
    /**
     * Create mock order for testing
     */
    private createMockOrder;
    /**
     * Create mock customer for testing
     */
    private createMockCustomer;
    /**
     * Get compliance dashboard data
     */
    getComplianceDashboard(): any;
    /**
     * Calculate compliance health score
     */
    private calculateComplianceHealthScore;
    /**
     * Get compliance status
     */
    private getComplianceStatus;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=omni-exchange.d.ts.map