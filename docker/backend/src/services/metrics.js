"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("./logger");
const os_1 = __importDefault(require("os"));
const process_1 = __importDefault(require("process"));
class MetricsService {
    static initialized = false;
    // System metrics
    static memoryUsage = new prom_client_1.Gauge({
        name: 'nodejs_memory_usage_bytes',
        help: 'Node.js memory usage in bytes',
        labelNames: ['type']
    });
    static cpuUsage = new prom_client_1.Gauge({
        name: 'nodejs_cpu_usage_percent',
        help: 'Node.js CPU usage percentage',
        labelNames: ['type']
    });
    static loadAverage = new prom_client_1.Gauge({
        name: 'system_load_average',
        help: 'System load average',
        labelNames: ['period']
    });
    static uptime = new prom_client_1.Gauge({
        name: 'nodejs_uptime_seconds',
        help: 'Node.js uptime in seconds'
    });
    // Application metrics
    static httpRequestsTotal = new prom_client_1.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
    });
    static httpRequestDuration = new prom_client_1.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });
    static databaseQueriesTotal = new prom_client_1.Counter({
        name: 'database_queries_total',
        help: 'Total number of database queries',
        labelNames: ['operation', 'table']
    });
    static databaseQueryDuration = new prom_client_1.Histogram({
        name: 'database_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'table'],
        buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5]
    });
    static redisOperationsTotal = new prom_client_1.Counter({
        name: 'redis_operations_total',
        help: 'Total number of Redis operations',
        labelNames: ['operation', 'status']
    });
    static kafkaMessagesTotal = new prom_client_1.Counter({
        name: 'kafka_messages_total',
        help: 'Total number of Kafka messages',
        labelNames: ['topic', 'status']
    });
    // Business metrics
    static tradesTotal = new prom_client_1.Counter({
        name: 'trades_total',
        help: 'Total number of trades executed',
        labelNames: ['exchange', 'symbol', 'side']
    });
    static tradeVolume = new prom_client_1.Counter({
        name: 'trade_volume_total',
        help: 'Total trade volume',
        labelNames: ['exchange', 'symbol', 'side']
    });
    static activeUsers = new prom_client_1.Gauge({
        name: 'active_users_total',
        help: 'Number of active users',
        labelNames: ['broker_id']
    });
    static walletBalances = new prom_client_1.Gauge({
        name: 'wallet_balances_total',
        help: 'Total wallet balances',
        labelNames: ['broker_id', 'currency', 'wallet_type']
    });
    static complianceEvents = new prom_client_1.Counter({
        name: 'compliance_events_total',
        help: 'Total compliance events',
        labelNames: ['event_type', 'status']
    });
    static initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Collect default Node.js metrics
            (0, prom_client_1.collectDefaultMetrics)({ register: prom_client_1.register });
            // Start system metrics collection
            this.startSystemMetricsCollection();
            // Start business metrics collection
            this.startBusinessMetricsCollection();
            this.initialized = true;
            logger_1.LoggerService.info('Prometheus metrics service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize Prometheus metrics service:', { error });
        }
    }
    static startSystemMetricsCollection() {
        setInterval(() => {
            try {
                const memUsage = process_1.default.memoryUsage();
                const cpuUsage = process_1.default.cpuUsage();
                const loadAvg = os_1.default.loadavg();
                // Memory metrics
                this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
                this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
                this.memoryUsage.set({ type: 'external' }, memUsage.external);
                this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
                // CPU metrics (simplified)
                this.cpuUsage.set({ type: 'user' }, cpuUsage.user / 1000000); // Convert to seconds
                this.cpuUsage.set({ type: 'system' }, cpuUsage.system / 1000000);
                // Load average
                this.loadAverage.set({ period: '1m' }, loadAvg[0] ?? 0);
                this.loadAverage.set({ period: '5m' }, loadAvg[1] ?? 0);
                this.loadAverage.set({ period: '15m' }, loadAvg[2] ?? 0);
                // Uptime
                this.uptime.set(process_1.default.uptime());
            }
            catch (error) {
                logger_1.LoggerService.error('Error collecting system metrics:', { error });
            }
        }, 10000); // Every 10 seconds
    }
    static startBusinessMetricsCollection() {
        setInterval(async () => {
            try {
                // Collect real business metrics from database
                const { DatabaseService } = await import('./database');
                // Active users count
                try {
                    const UserModel = DatabaseService.getModel('User');
                    if (UserModel) {
                        const activeUsersCount = await UserModel.count({
                            where: { isActive: true }
                        });
                        this.activeUsers.set({ broker_id: 'platform' }, activeUsersCount);
                    }
                }
                catch (error) {
                    logger_1.LoggerService.debug('Could not collect active users metric:', error.message);
                }
                // Wallet balances
                try {
                    const WalletModel = DatabaseService.getModel('Wallet');
                    if (WalletModel) {
                        const wallets = await WalletModel.findAll({
                            attributes: ['brokerId', 'currency', 'type', 'balance'],
                            where: { isActive: true }
                        });
                        // Group by broker, currency, and wallet type
                        const balanceMap = new Map();
                        for (const wallet of wallets) {
                            const data = wallet.dataValues || wallet;
                            const key = `${data.brokerId || 'platform'}_${data.currency || 'USDT'}_${data.type || 'hot'}`;
                            const currentBalance = parseFloat(data.balance || '0');
                            if (balanceMap.has(key)) {
                                balanceMap.set(key, (balanceMap.get(key) || 0) + currentBalance);
                            }
                            else {
                                balanceMap.set(key, currentBalance);
                            }
                        }
                        // Update metrics
                        for (const [key, balance] of balanceMap.entries()) {
                            const [brokerId, currency, walletType] = key.split('_');
                            this.walletBalances.set({
                                broker_id: brokerId || 'platform',
                                currency: currency || 'USDT',
                                wallet_type: walletType || 'hot'
                            }, balance);
                        }
                    }
                }
                catch (error) {
                    logger_1.LoggerService.debug('Could not collect wallet balance metrics:', error.message);
                }
            }
            catch (error) {
                logger_1.LoggerService.error('Error collecting business metrics:', { error });
            }
        }, 30000); // Every 30 seconds
    }
    // HTTP metrics
    static recordHttpRequest(method, route, statusCode, duration) {
        this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
        this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration / 1000);
    }
    // Database metrics
    static recordDatabaseQuery(operation, table, duration) {
        this.databaseQueriesTotal.inc({ operation, table });
        this.databaseQueryDuration.observe({ operation, table }, duration / 1000);
    }
    // Redis metrics
    static recordRedisOperation(operation, status) {
        this.redisOperationsTotal.inc({ operation, status });
    }
    // Kafka metrics
    static recordKafkaMessage(topic, status) {
        this.kafkaMessagesTotal.inc({ topic, status });
    }
    // Business metrics
    static recordTrade(exchange, symbol, side, volume) {
        this.tradesTotal.inc({ exchange, symbol, side });
        this.tradeVolume.inc({ exchange, symbol, side }, volume);
    }
    static setActiveUsers(brokerId, count) {
        this.activeUsers.set({ broker_id: brokerId }, count);
    }
    static setWalletBalance(brokerId, currency, walletType, balance) {
        this.walletBalances.set({ broker_id: brokerId, currency, wallet_type: walletType }, balance);
    }
    static recordComplianceEvent(eventType, status) {
        this.complianceEvents.inc({ event_type: eventType, status });
    }
    static async getMetrics() {
        return prom_client_1.register.metrics();
    }
    static getMetricsAsJSON() {
        return prom_client_1.register.getMetricsAsJSON();
    }
    static clear() {
        prom_client_1.register.clear();
    }
}
exports.MetricsService = MetricsService;
//# sourceMappingURL=metrics.js.map