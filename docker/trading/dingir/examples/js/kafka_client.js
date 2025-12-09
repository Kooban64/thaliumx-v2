"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaConsumer = void 0;
const Kafka = __importStar(require("kafkajs"));
class KafkaConsumer {
    verbose;
    consumer;
    messages;
    async Init(verbose = false, topics = ["balances", "trades", "orders", "unifyevents"]) {
        this.verbose = verbose;
        const brokers = process.env.KAFKA_BROKERS;
        const kafka = new Kafka.Kafka({
            brokers: (brokers || "127.0.0.1:9092").split(","),
            logLevel: Kafka.logLevel.WARN,
        });
        const consumer = kafka.consumer({ groupId: "test-group" });
        this.consumer = consumer;
        await consumer.connect();
        const fromBeginning = false;
        this.messages = new Map();
        for (const topic of topics) {
            this.messages.set(topic, []);
            await consumer.subscribe({ topic, fromBeginning });
        }
        return consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                if (this.verbose) {
                    console.log("New message:", {
                        topic,
                        partition,
                        offset: message.offset,
                        key: message.key.toString(),
                        value: message.value.toString(),
                    });
                }
                this.messages.get(topic).push(message.value.toString());
            },
        });
    }
    Reset() {
        this.messages = new Map();
    }
    GetAllMessages() {
        return this.messages;
    }
    async Stop() {
        await this.consumer.disconnect();
    }
}
exports.KafkaConsumer = KafkaConsumer;
//# sourceMappingURL=kafka_client.js.map