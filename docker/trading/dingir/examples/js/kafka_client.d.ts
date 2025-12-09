export declare class KafkaConsumer {
    verbose: boolean;
    consumer: any;
    messages: Map<string, Array<any>>;
    Init(verbose?: boolean, topics?: string[]): Promise<void>;
    Reset(): void;
    GetAllMessages(): Map<string, Array<any>>;
    Stop(): Promise<void>;
}
//# sourceMappingURL=kafka_client.d.ts.map