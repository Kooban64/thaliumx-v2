"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandlers = exports.EventStreamingService = void 0;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("./logger");
const config_1 = require("./config");
// =============================================================================
// KAFKA EVENT STREAMING SERVICE
// =============================================================================
class EventStreamingService {
    static kafka;
    static producer;
    static consumers = new Map();
    static isInitialized = false;
    static isConnected = false;
    // Topic configurations
    static TOPICS = {
        AUDIT: 'thaliumx.audit',
        TRANSACTIONS: 'thaliumx.transactions',
        SYSTEM: 'thaliumx.system',
        COMPLIANCE: 'thaliumx.compliance',
        ALERTS: 'thaliumx.alerts',
        HEALTH: 'thaliumx.health'
    };
    // Event type mappings
    static EVENT_TYPE_MAPPINGS = {
        'user.login': 'AUDIT',
        'user.logout': 'AUDIT',
        'user.kyc.submitted': 'AUDIT',
        'user.kyc.approved': 'AUDIT',
        'user.kyc.rejected': 'AUDIT',
        'transaction.created': 'TRANSACTIONS',
        'transaction.completed': 'TRANSACTIONS',
        'transaction.failed': 'TRANSACTIONS',
        'exchange.order.created': 'TRANSACTIONS',
        'exchange.order.filled': 'TRANSACTIONS',
        'fiat.deposit.initiated': 'TRANSACTIONS',
        'fiat.withdrawal.completed': 'TRANSACTIONS',
        'token.transfer': 'TRANSACTIONS',
        'token.stake': 'TRANSACTIONS',
        'token.unstake': 'TRANSACTIONS',
        'system.health.check': 'SYSTEM',
        'system.error': 'SYSTEM',
        'system.performance': 'SYSTEM',
        'compliance.kyc.check': 'COMPLIANCE',
        'compliance.ofac.screening': 'COMPLIANCE',
        'compliance.report.generated': 'COMPLIANCE'
    };
    /**
     * Initialize Kafka connection and producer
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Event Streaming Service (Kafka)...');
            const config = config_1.ConfigService.getConfig();
            // Initialize Kafka client
            this.kafka = new kafkajs_1.Kafka({
                clientId: 'thaliumx-backend',
                brokers: config.kafka?.brokers || ['localhost:9092'],
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                },
                connectionTimeout: 3000,
                requestTimeout: 25000,
                ssl: config.kafka?.ssl || false,
                sasl: config.kafka?.sasl ? {
                    mechanism: config.kafka.sasl.mechanism,
                    username: config.kafka.sasl.username,
                    password: config.kafka.sasl.password
                } : undefined
            });
            // Initialize producer
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000,
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                }
            });
            // Connect producer
            await this.producer.connect();
            this.isConnected = true;
            // Create topics if they don't exist
            await this.createTopics();
            // Start system monitoring
            this.startSystemMonitoring();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Event Streaming Service initialized successfully');
            // Emit initialization event
            await this.emitSystemEvent('system.initialized', 'Event Streaming Service', 'info', {
                message: 'Kafka event streaming service initialized',
                brokers: config.kafka?.brokers || ['localhost:9092'],
                topics: Object.values(this.TOPICS)
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Event Streaming Service initialization failed:', error);
            this.isConnected = false;
            throw error;
        }
    }
    /**
     * Emit audit event
     */
    static async emitAuditEvent(action, resource, resourceId, payload, metadata) {
        try {
            const event = {
                metadata: {
                    eventId: this.generateEventId(),
                    eventType: 'audit',
                    timestamp: new Date().toISOString(),
                    source: 'thaliumx-backend',
                    version: '1.0.0',
                    action,
                    resource,
                    resourceId,
                    ...metadata
                },
                payload
            };
            await this.publishEvent(event, this.TOPICS.AUDIT);
            logger_1.LoggerService.info(`Audit event emitted: ${action}`, {
                eventId: event.metadata.eventId,
                action,
                resource,
                resourceId
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to emit audit event:', error);
            throw error;
        }
    }
    /**
     * Emit transaction event
     */
    static async emitTransactionEvent(transactionType, transactionId, amount, currency, status, metadata, additionalPayload) {
        try {
            const event = {
                metadata: {
                    eventId: this.generateEventId(),
                    eventType: 'transaction',
                    timestamp: new Date().toISOString(),
                    source: 'thaliumx-backend',
                    version: '1.0.0',
                    transactionType,
                    ...metadata
                },
                payload: {
                    transactionId,
                    amount,
                    currency,
                    status,
                    ...additionalPayload
                }
            };
            await this.publishEvent(event, this.TOPICS.TRANSACTIONS);
            logger_1.LoggerService.info(`Transaction event emitted: ${transactionType}`, {
                eventId: event.metadata.eventId,
                transactionType,
                transactionId,
                amount,
                currency,
                status
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to emit transaction event:', error);
            throw error;
        }
    }
    /**
     * Emit system event
     */
    static async emitSystemEvent(eventType, component, level, payload, metadata) {
        try {
            const event = {
                metadata: {
                    eventId: this.generateEventId(),
                    eventType: 'system',
                    timestamp: new Date().toISOString(),
                    source: 'thaliumx-backend',
                    version: '1.0.0',
                    component,
                    level,
                    ...metadata
                },
                payload
            };
            await this.publishEvent(event, this.TOPICS.SYSTEM);
            if (level === 'error' || level === 'critical') {
                logger_1.LoggerService.error(`System event emitted: ${eventType}`, {
                    eventId: event.metadata.eventId,
                    component,
                    level,
                    message: payload.message
                });
            }
            else {
                logger_1.LoggerService.info(`System event emitted: ${eventType}`, {
                    eventId: event.metadata.eventId,
                    component,
                    level
                });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to emit system event:', error);
            throw error;
        }
    }
    /**
     * Emit compliance event
     */
    static async emitComplianceEvent(regulation, requirement, data, status, metadata, notes) {
        try {
            const event = {
                metadata: {
                    eventId: this.generateEventId(),
                    eventType: 'compliance',
                    timestamp: new Date().toISOString(),
                    source: 'thaliumx-backend',
                    version: '1.0.0',
                    regulation,
                    requirement,
                    ...metadata
                },
                payload: {
                    data,
                    status,
                    notes
                }
            };
            await this.publishEvent(event, this.TOPICS.COMPLIANCE);
            logger_1.LoggerService.info(`Compliance event emitted: ${regulation}`, {
                eventId: event.metadata.eventId,
                regulation,
                requirement,
                status
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to emit compliance event:', error);
            throw error;
        }
    }
    /**
     * Subscribe to events
     */
    static async subscribeToEvents(topic, groupId, handler) {
        try {
            const consumer = this.kafka.consumer({ groupId });
            await consumer.connect();
            await consumer.subscribe({ topic, fromBeginning: false });
            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const event = JSON.parse(message.value?.toString() || '{}');
                        await handler(event);
                    }
                    catch (error) {
                        logger_1.LoggerService.error('Error processing event:', error);
                    }
                }
            });
            this.consumers.set(`${topic}-${groupId}`, consumer);
            logger_1.LoggerService.info(`Subscribed to events: ${topic}`, { groupId });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to subscribe to events:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized && this.isConnected;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing Event Streaming Service...');
            // Close producer
            if (this.producer) {
                await this.producer.disconnect();
            }
            // Close consumers
            for (const [key, consumer] of this.consumers) {
                await consumer.disconnect();
                logger_1.LoggerService.info(`Consumer disconnected: ${key}`);
            }
            this.consumers.clear();
            this.isConnected = false;
            this.isInitialized = false;
            logger_1.LoggerService.info('✅ Event Streaming Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing Event Streaming Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async publishEvent(event, topic) {
        try {
            if (!this.isConnected) {
                logger_1.LoggerService.warn('Kafka producer not connected, skipping event emission');
                return;
            }
            // Serialize event to JSON
            const eventJson = JSON.stringify(event);
            const messageSize = Buffer.byteLength(eventJson, 'utf8');
            // Validate message size (Kafka default max is 100MB, we use 90MB as safety margin)
            const MAX_MESSAGE_SIZE = 90 * 1024 * 1024; // 90MB
            if (messageSize > MAX_MESSAGE_SIZE) {
                const error = new Error(`Event message too large: ${messageSize} bytes (max: ${MAX_MESSAGE_SIZE} bytes). ` +
                    `Event type: ${event.metadata.eventType}, Event ID: ${event.metadata.eventId}`);
                logger_1.LoggerService.error('Kafka message size validation failed', {
                    eventType: event.metadata.eventType,
                    eventId: event.metadata.eventId,
                    messageSize,
                    maxSize: MAX_MESSAGE_SIZE,
                    topic
                });
                throw error;
            }
            // Log large messages for monitoring (warn if > 1MB)
            if (messageSize > 1024 * 1024) {
                logger_1.LoggerService.warn('Large Kafka message detected', {
                    eventType: event.metadata.eventType,
                    messageSize,
                    topic
                });
            }
            const message = {
                topic,
                messages: [{
                        key: event.metadata.eventId,
                        value: eventJson,
                        timestamp: Date.now().toString(),
                        headers: {
                            eventType: event.metadata.eventType,
                            source: event.metadata.source,
                            version: event.metadata.version,
                            messageSize: messageSize.toString()
                        }
                    }]
            };
            await this.producer.send(message);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to publish event:', error);
            throw error;
        }
    }
    static async createTopics() {
        try {
            const admin = this.kafka.admin();
            await admin.connect();
            const existingTopics = await admin.listTopics();
            const topicsToCreate = Object.values(this.TOPICS).filter(topic => !existingTopics.includes(topic));
            if (topicsToCreate.length > 0) {
                await admin.createTopics({
                    topics: topicsToCreate.map(topic => ({
                        topic,
                        numPartitions: 3,
                        replicationFactor: 1,
                        configEntries: [
                            { name: 'retention.ms', value: '604800000' }, // 7 days
                            { name: 'compression.type', value: 'snappy' }
                        ]
                    }))
                });
                logger_1.LoggerService.info(`Created Kafka topics: ${topicsToCreate.join(', ')}`);
            }
            await admin.disconnect();
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create Kafka topics:', error);
            // Don't throw error - topics might already exist
        }
    }
    static startSystemMonitoring() {
        // Emit health check events every 30 seconds
        setInterval(async () => {
            try {
                await this.emitSystemEvent('system.health.check', 'EventStreamingService', 'info', {
                    message: 'Health check',
                    metrics: {
                        isConnected: this.isConnected,
                        consumersCount: this.consumers.size,
                        topics: Object.values(this.TOPICS)
                    }
                });
            }
            catch (error) {
                logger_1.LoggerService.error('Health check event emission failed:', error);
            }
        }, 30000);
        // Monitor producer connection
        setInterval(async () => {
            try {
                if (!this.isConnected) {
                    await this.emitSystemEvent('system.error', 'EventStreamingService', 'error', {
                        message: 'Kafka producer disconnected',
                        context: { timestamp: new Date().toISOString() }
                    });
                }
            }
            catch (error) {
                logger_1.LoggerService.error('Connection monitoring failed:', error);
            }
        }, 60000);
        logger_1.LoggerService.info('System monitoring started for Event Streaming Service');
    }
    static generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.EventStreamingService = EventStreamingService;
// =============================================================================
// EVENT HANDLERS FOR SPECIFIC BUSINESS LOGIC
// =============================================================================
class EventHandlers {
    /**
     * Handle audit events for compliance reporting
     */
    static async handleAuditEvent(event) {
        try {
            // Store in audit database
            logger_1.LoggerService.info('Processing audit event', {
                eventId: event.metadata.eventId,
                action: event.metadata.action,
                resource: event.metadata.resource
            });
            // Trigger compliance checks if needed
            if (event.metadata.action.includes('kyc') || event.metadata.action.includes('transaction')) {
                await EventStreamingService.emitComplianceEvent('AML', 'transaction_monitoring', event.payload, 'pending', { correlationId: event.metadata.correlationId });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to handle audit event:', error);
        }
    }
    /**
     * Handle transaction events for real-time monitoring
     */
    static async handleTransactionEvent(event) {
        try {
            logger_1.LoggerService.info('Processing transaction event', {
                eventId: event.metadata.eventId,
                transactionType: event.metadata.transactionType,
                transactionId: event.payload.transactionId,
                amount: event.payload.amount
            });
            // Trigger risk assessment
            if (event.payload.amount > 10000) { // High-value transaction
                await EventStreamingService.emitComplianceEvent('AML', 'high_value_transaction', event.payload, 'pending', { correlationId: event.metadata.correlationId }, 'High-value transaction requires additional review');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to handle transaction event:', error);
        }
    }
    /**
     * Handle system events for alerting
     */
    static async handleSystemEvent(event) {
        try {
            logger_1.LoggerService.info('Processing system event', {
                eventId: event.metadata.eventId,
                component: event.metadata.component,
                level: event.metadata.level
            });
            // Send alerts for critical events
            if (event.metadata.level === 'critical') {
                await EventStreamingService.emitSystemEvent('alert.critical', 'AlertSystem', 'critical', {
                    message: `Critical system event: ${event.payload.message}`,
                    originalEvent: event.metadata.eventId,
                    component: event.metadata.component
                });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to handle system event:', error);
        }
    }
    /**
     * Handle compliance events for regulatory reporting
     */
    static async handleComplianceEvent(event) {
        try {
            logger_1.LoggerService.info('Processing compliance event', {
                eventId: event.metadata.eventId,
                regulation: event.metadata.regulation,
                requirement: event.metadata.requirement,
                status: event.payload.status
            });
            // Generate compliance reports
            if (event.payload.status === 'non-compliant') {
                await EventStreamingService.emitSystemEvent('compliance.violation', 'ComplianceSystem', 'error', {
                    message: `Compliance violation detected: ${event.metadata.regulation}`,
                    regulation: event.metadata.regulation,
                    requirement: event.metadata.requirement,
                    data: event.payload.data
                });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to handle compliance event:', error);
        }
    }
}
exports.EventHandlers = EventHandlers;
//# sourceMappingURL=event-streaming.js.map