/**
 * Event Streaming Service (Kafka)
 *
 * Production-ready event streaming for:
 * - Real-time audit trails (all financial transactions)
 * - Event-driven architecture (service communication)
 * - Compliance monitoring (regulatory reporting)
 * - System monitoring (health checks, alerts)
 * - Data synchronization (cross-service updates)
 *
 * Enterprise-grade with comprehensive error handling
 */
export interface EventMetadata {
    eventId: string;
    eventType: string;
    timestamp: string;
    source: string;
    version: string;
    tenantId?: string;
    userId?: string;
    correlationId?: string;
    traceId?: string;
}
export interface BaseEvent {
    metadata: EventMetadata;
    payload: any;
}
export interface AuditEvent extends BaseEvent {
    metadata: EventMetadata & {
        eventType: string;
        action: string;
        resource: string;
        resourceId: string;
        ipAddress?: string;
        userAgent?: string;
    };
    payload: {
        before?: any;
        after?: any;
        changes?: any;
        reason?: string;
        tags?: string[];
    };
}
export interface TransactionEvent extends BaseEvent {
    metadata: EventMetadata & {
        eventType: string;
        transactionType: 'exchange' | 'fiat' | 'token' | 'margin';
    };
    payload: {
        transactionId: string;
        amount: number;
        currency: string;
        status: string;
        fees?: number;
        metadata?: any;
    };
}
export interface SystemEvent extends BaseEvent {
    metadata: EventMetadata & {
        eventType: string;
        component: string;
        level: 'info' | 'warn' | 'error' | 'critical';
    };
    payload: {
        message: string;
        metrics?: any;
        stack?: string;
        context?: any;
    };
}
export interface ComplianceEvent extends BaseEvent {
    metadata: EventMetadata & {
        eventType: string;
        regulation: string;
        requirement: string;
    };
    payload: {
        data: any;
        status: 'compliant' | 'non-compliant' | 'pending';
        notes?: string;
    };
}
export type ThaliumXEvent = AuditEvent | TransactionEvent | SystemEvent | ComplianceEvent;
export declare class EventStreamingService {
    private static kafka;
    private static producer;
    private static consumers;
    private static isInitialized;
    private static isConnected;
    private static readonly TOPICS;
    private static readonly EVENT_TYPE_MAPPINGS;
    /**
     * Initialize Kafka connection and producer
     */
    static initialize(): Promise<void>;
    /**
     * Emit audit event
     */
    static emitAuditEvent(action: string, resource: string, resourceId: string, payload: any, metadata?: Partial<EventMetadata>): Promise<void>;
    /**
     * Emit transaction event
     */
    static emitTransactionEvent(transactionType: 'exchange' | 'fiat' | 'token' | 'margin', transactionId: string, amount: number, currency: string, status: string, metadata?: Partial<EventMetadata>, additionalPayload?: any): Promise<void>;
    /**
     * Emit system event
     */
    static emitSystemEvent(eventType: string, component: string, level: 'info' | 'warn' | 'error' | 'critical', payload: any, metadata?: Partial<EventMetadata>): Promise<void>;
    /**
     * Emit compliance event
     */
    static emitComplianceEvent(regulation: string, requirement: string, data: any, status: 'compliant' | 'non-compliant' | 'pending', metadata?: Partial<EventMetadata>, notes?: string): Promise<void>;
    /**
     * Subscribe to events
     */
    static subscribeToEvents(topic: string, groupId: string, handler: (event: ThaliumXEvent) => Promise<void>): Promise<void>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static publishEvent;
    private static createTopics;
    private static startSystemMonitoring;
    private static generateEventId;
}
export declare class EventHandlers {
    /**
     * Handle audit events for compliance reporting
     */
    static handleAuditEvent(event: AuditEvent): Promise<void>;
    /**
     * Handle transaction events for real-time monitoring
     */
    static handleTransactionEvent(event: TransactionEvent): Promise<void>;
    /**
     * Handle system events for alerting
     */
    static handleSystemEvent(event: SystemEvent): Promise<void>;
    /**
     * Handle compliance events for regulatory reporting
     */
    static handleComplianceEvent(event: ComplianceEvent): Promise<void>;
}
//# sourceMappingURL=event-streaming.d.ts.map