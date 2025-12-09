/**
 * Kafka Service
 *
 * Apache Kafka integration for event streaming and message queuing.
 *
 * Features:
 * - Producer for publishing messages to topics
 * - Consumer for subscribing to topics and processing messages
 * - SASL authentication support
 * - SSL/TLS encryption
 * - Automatic reconnection and error handling
 *
 * Topics:
 * - orders: Order events and updates
 * - trades: Trade execution events
 * - events: General system events
 *
 * Configuration:
 * - Broker addresses from config
 * - Client ID for identification
 * - Consumer group for load balancing
 * - SASL credentials for authentication
 *
 * Production Features:
 * - Comprehensive error handling
 * - Connection retry logic
 * - Message acknowledgment
 */
export declare class KafkaService {
    private static kafka;
    private static producer;
    private static consumer;
    private static isInitialized;
    static initialize(): Promise<void>;
    static produce(topic: string, message: any): Promise<void>;
    static close(): Promise<void>;
}
//# sourceMappingURL=kafka.d.ts.map