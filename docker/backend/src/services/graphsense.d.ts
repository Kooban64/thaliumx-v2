/**
 * GraphSense Integration Service
 *
 * Comprehensive blockchain analytics and intelligence service:
 * - Blockchain Data Analysis
 * - Transaction Graph Analysis
 * - Address Clustering & Entity Resolution
 * - Risk Scoring & AML Detection
 * - Flow Analysis & Pattern Detection
 * - Compliance Monitoring
 * - Real-time Alerts & Notifications
 *
 * Production-ready with full integration
 */
export declare enum GraphSenseEntityType {
    ADDRESS = "address",
    TRANSACTION = "transaction",
    BLOCK = "block",
    CONTRACT = "contract",
    TOKEN = "token",
    EXCHANGE = "exchange",
    MIXER = "mixer",
    MINER = "miner",
    UNKNOWN = "unknown"
}
export declare enum GraphSenseRiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum GraphSenseAlertType {
    SUSPICIOUS_TRANSACTION = "suspicious_transaction",
    AML_FLAG = "aml_flag",
    SANCTIONS_MATCH = "sanctions_match",
    PEP_MATCH = "pep_match",
    MIXER_USAGE = "mixer_usage",
    HIGH_VALUE_TRANSFER = "high_value_transfer",
    UNUSUAL_PATTERN = "unusual_pattern",
    CLUSTER_ANOMALY = "cluster_anomaly",
    FLOW_ANOMALY = "flow_anomaly",
    COMPLIANCE_VIOLATION = "compliance_violation"
}
export declare enum GraphSenseAnalysisType {
    ADDRESS_ANALYSIS = "address_analysis",
    TRANSACTION_ANALYSIS = "transaction_analysis",
    CLUSTER_ANALYSIS = "cluster_analysis",
    FLOW_ANALYSIS = "flow_analysis",
    PATTERN_ANALYSIS = "pattern_analysis",
    RISK_ANALYSIS = "risk_analysis",
    COMPLIANCE_ANALYSIS = "compliance_analysis"
}
export interface GraphSenseEntity {
    id: string;
    type: GraphSenseEntityType;
    address?: string;
    transactionHash?: string;
    blockNumber?: number;
    contractAddress?: string;
    tokenAddress?: string;
    metadata: GraphSenseEntityMetadata;
    riskScore: number;
    riskLevel: GraphSenseRiskLevel;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseEntityMetadata {
    name?: string;
    description?: string;
    category?: string;
    subcategory?: string;
    country?: string;
    jurisdiction?: string;
    isExchange?: boolean;
    isMixer?: boolean;
    isContract?: boolean;
    isToken?: boolean;
    firstSeen?: Date;
    lastSeen?: Date;
    transactionCount?: number;
    volume?: number;
    additionalData?: any;
}
export interface GraphSenseTransaction {
    id: string;
    hash: string;
    blockNumber: number;
    timestamp: Date;
    from: string;
    to: string;
    value: string;
    gasUsed: number;
    gasPrice: string;
    status: 'success' | 'failed';
    input: string;
    metadata: GraphSenseTransactionMetadata;
    riskScore: number;
    riskLevel: GraphSenseRiskLevel;
    alerts: GraphSenseAlert[];
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseTransactionMetadata {
    tokenTransfers?: TokenTransfer[];
    contractCalls?: ContractCall[];
    internalTransactions?: InternalTransaction[];
    logs?: TransactionLog[];
    trace?: any;
    additionalData?: any;
}
export interface TokenTransfer {
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    from: string;
    to: string;
    value: string;
    type: 'transfer' | 'mint' | 'burn';
}
export interface ContractCall {
    contractAddress: string;
    method: string;
    parameters: any;
    returnValue?: any;
}
export interface InternalTransaction {
    from: string;
    to: string;
    value: string;
    gasUsed: number;
    type: 'call' | 'delegatecall' | 'staticcall' | 'create' | 'create2';
}
export interface TransactionLog {
    address: string;
    topics: string[];
    data: string;
    logIndex: number;
}
export interface GraphSenseCluster {
    id: string;
    name: string;
    description: string;
    addresses: string[];
    entityType: GraphSenseEntityType;
    riskScore: number;
    riskLevel: GraphSenseRiskLevel;
    metadata: GraphSenseClusterMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseClusterMetadata {
    clusterType: 'exchange' | 'mixer' | 'contract' | 'token' | 'unknown';
    confidence: number;
    firstSeen?: Date;
    lastSeen?: Date;
    transactionCount?: number;
    volume?: number;
    country?: string;
    jurisdiction?: string;
    additionalData?: any;
}
export interface GraphSenseFlow {
    id: string;
    from: string;
    to: string;
    amount: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    transactionCount: number;
    firstTransaction: Date;
    lastTransaction: Date;
    riskScore: number;
    riskLevel: GraphSenseRiskLevel;
    metadata: GraphSenseFlowMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseFlowMetadata {
    flowType: 'direct' | 'indirect' | 'circular' | 'complex';
    intermediaries?: string[];
    hops?: number;
    timeSpan?: number;
    additionalData?: any;
}
export interface GraphSenseAlert {
    id: string;
    type: GraphSenseAlertType;
    severity: GraphSenseRiskLevel;
    title: string;
    description: string;
    entityId: string;
    entityType: GraphSenseEntityType;
    transactionHash?: string;
    metadata: GraphSenseAlertMetadata;
    status: 'active' | 'acknowledged' | 'resolved' | 'false_positive';
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseAlertMetadata {
    ruleId?: string;
    ruleName?: string;
    confidence: number;
    evidence?: any;
    additionalData?: any;
}
export interface GraphSenseAnalysis {
    id: string;
    type: GraphSenseAnalysisType;
    entityId: string;
    entityType: GraphSenseEntityType;
    parameters: any;
    results: GraphSenseAnalysisResults;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
export interface GraphSenseAnalysisResults {
    riskScore: number;
    riskLevel: GraphSenseRiskLevel;
    findings: GraphSenseFinding[];
    recommendations: string[];
    metadata: any;
}
export interface GraphSenseFinding {
    type: string;
    description: string;
    severity: GraphSenseRiskLevel;
    evidence: any;
    confidence: number;
}
export interface GraphSenseConfig {
    enabled: boolean;
    apiEndpoint: string;
    apiKey: string;
    supportedNetworks: string[];
    analysisInterval: number;
    alertThreshold: number;
    riskThresholds: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    enableRealTimeAnalysis: boolean;
    enableHistoricalAnalysis: boolean;
    enableClusterAnalysis: boolean;
    enableFlowAnalysis: boolean;
    enablePatternAnalysis: boolean;
    enableComplianceAnalysis: boolean;
}
export declare class GraphSenseService {
    private static isInitialized;
    private static config;
    private static entities;
    private static transactions;
    private static clusters;
    private static flows;
    private static alerts;
    private static analyses;
    private static readonly GRAPHSENSE_CONFIG;
    /**
     * Initialize GraphSense Service
     */
    static initialize(): Promise<void>;
    /**
     * Get default GraphSense configuration
     */
    private static getDefaultConfig;
    /**
     * Load existing data from storage
     */
    private static loadExistingData;
    /**
     * Initialize GraphSense API client
     */
    private static initializeGraphSenseAPI;
    /**
     * Start monitoring services
     */
    private static startMonitoringServices;
    /**
     * Perform real-time analysis
     */
    private static performRealTimeAnalysis;
    /**
     * Check alerts
     */
    private static checkAlerts;
    /**
     * Update clusters
     */
    private static updateClusters;
    /**
     * Update flows
     */
    private static updateFlows;
    /**
     * Analyze transaction
     */
    static analyzeTransaction(transactionHash: string): Promise<GraphSenseTransaction>;
    /**
     * Analyze entity
     */
    static analyzeEntity(address: string): Promise<GraphSenseEntity>;
    /**
     * Create alert
     */
    static createAlert(alertData: Omit<GraphSenseAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<GraphSenseAlert>;
    /**
     * Get alerts
     */
    static getAlerts(filters?: {
        type?: GraphSenseAlertType;
        severity?: GraphSenseRiskLevel;
        status?: string;
        entityId?: string;
        limit?: number;
    }): Promise<GraphSenseAlert[]>;
    /**
     * Get entities
     */
    static getEntities(filters?: {
        type?: GraphSenseEntityType;
        riskLevel?: GraphSenseRiskLevel;
        limit?: number;
    }): Promise<GraphSenseEntity[]>;
    /**
     * Get transactions
     */
    static getTransactions(filters?: {
        riskLevel?: GraphSenseRiskLevel;
        limit?: number;
    }): Promise<GraphSenseTransaction[]>;
    /**
     * Get clusters
     */
    static getClusters(filters?: {
        riskLevel?: GraphSenseRiskLevel;
        limit?: number;
    }): Promise<GraphSenseCluster[]>;
    /**
     * Get flows
     */
    static getFlows(filters?: {
        riskLevel?: GraphSenseRiskLevel;
        limit?: number;
    }): Promise<GraphSenseFlow[]>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=graphsense.d.ts.map