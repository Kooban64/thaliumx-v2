/**
 * Metrics Service (Prometheus)
 *
 * Prometheus metrics collection and export for monitoring and alerting.
 *
 * Features:
 * - System metrics (memory, CPU, load average, uptime)
 * - Application metrics (HTTP requests, database queries, Redis operations)
 * - Business metrics (transactions, trades, orders)
 * - Custom metrics support
 * - Prometheus-compatible endpoint (/metrics)
 *
 * Metrics Types:
 * - Counter: Incrementing values (request counts, error counts)
 * - Histogram: Distribution of values (request duration, query time)
 * - Gauge: Current values (memory usage, active connections)
 *
 * System Metrics:
 * - Node.js memory usage (heap, RSS, external)
 * - CPU usage (user, system)
 * - System load average (1min, 5min, 15min)
 * - Process uptime
 *
 * Application Metrics:
 * - HTTP request counts and duration by method, route, status
 * - Database query counts and duration by operation, table
 * - Redis operation counts and duration
 * - Transaction counts by type and status
 *
 * Integration:
 * - Exposes /metrics endpoint for Prometheus scraping
 * - Integrates with Grafana for visualization
 * - Used for alerting and performance monitoring
 */
export declare class MetricsService {
    private static initialized;
    private static readonly memoryUsage;
    private static readonly cpuUsage;
    private static readonly loadAverage;
    private static readonly uptime;
    private static readonly httpRequestsTotal;
    private static readonly httpRequestDuration;
    private static readonly databaseQueriesTotal;
    private static readonly databaseQueryDuration;
    private static readonly redisOperationsTotal;
    private static readonly kafkaMessagesTotal;
    private static readonly tradesTotal;
    private static readonly tradeVolume;
    private static readonly activeUsers;
    private static readonly walletBalances;
    private static readonly complianceEvents;
    static initialize(): void;
    private static startSystemMetricsCollection;
    private static startBusinessMetricsCollection;
    static recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void;
    static recordDatabaseQuery(operation: string, table: string, duration: number): void;
    static recordRedisOperation(operation: string, status: string): void;
    static recordKafkaMessage(topic: string, status: string): void;
    static recordTrade(exchange: string, symbol: string, side: string, volume: number): void;
    static setActiveUsers(brokerId: string, count: number): void;
    static setWalletBalance(brokerId: string, currency: string, walletType: string, balance: number): void;
    static recordComplianceEvent(eventType: string, status: string): void;
    static getMetrics(): Promise<string>;
    static getMetricsAsJSON(): Promise<any>;
    static clear(): void;
}
//# sourceMappingURL=metrics.d.ts.map