"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaService = void 0;
const kafkajs_1 = require("kafkajs");
const config_1 = require("./config");
const logger_1 = require("./logger");
class KafkaService {
    static kafka;
    static producer;
    static consumer;
    static isInitialized = false;
    static async initialize() {
        try {
            const config = config_1.ConfigService.getConfig().kafka;
            this.kafka = new kafkajs_1.Kafka({
                clientId: 'thaliumx-backend',
                brokers: config.brokers,
                ssl: config.ssl,
                sasl: config.sasl
            });
            this.producer = this.kafka.producer();
            await this.producer.connect();
            this.consumer = this.kafka.consumer({ groupId: 'thaliumx-group' });
            await this.consumer.connect();
            // Subscribe to topics
            await this.consumer.subscribe({ topics: ['orders', 'trades', 'events'], fromBeginning: true });
            // Run consumer
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    logger_1.LoggerService.info(`Kafka message received on ${topic}`, {
                        value: message.value?.toString(),
                        partition
                    });
                    // Handle message based on topic
                }
            });
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Kafka Service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Kafka Service initialization failed:', error);
            throw error;
        }
    }
    static async produce(topic, message) {
        if (!this.isInitialized) {
            throw new Error('Kafka not initialized');
        }
        // Serialize message to JSON
        const messageJson = JSON.stringify(message);
        const messageSize = Buffer.byteLength(messageJson, 'utf8');
        // Validate message size (Kafka default max is 100MB, we use 90MB as safety margin)
        const MAX_MESSAGE_SIZE = 90 * 1024 * 1024; // 90MB
        if (messageSize > MAX_MESSAGE_SIZE) {
            const error = new Error(`Kafka message too large: ${messageSize} bytes (max: ${MAX_MESSAGE_SIZE} bytes). Topic: ${topic}`);
            logger_1.LoggerService.error('Kafka message size validation failed', {
                topic,
                messageSize,
                maxSize: MAX_MESSAGE_SIZE
            });
            throw error;
        }
        // Log large messages for monitoring (warn if > 1MB)
        if (messageSize > 1024 * 1024) {
            logger_1.LoggerService.warn('Large Kafka message detected', {
                topic,
                messageSize
            });
        }
        await this.producer.send({
            topic,
            messages: [{
                    value: messageJson,
                    headers: {
                        messageSize: messageSize.toString()
                    }
                }]
        });
    }
    static async close() {
        if (this.producer)
            await this.producer.disconnect();
        if (this.consumer)
            await this.consumer.disconnect();
        this.isInitialized = false;
        logger_1.LoggerService.info('Kafka connection closed');
    }
}
exports.KafkaService = KafkaService;
//# sourceMappingURL=kafka.js.map