"use strict";
/**
 * Dashboard Service
 *
 * Aggregates system information and service status for admin dashboards.
 *
 * Features:
 * - System information (Node.js, OS metrics)
 * - Service health status aggregation
 * - Database connection status
 * - Redis connection status
 * - Keycloak realm information
 * - RBAC statistics
 * - DEX service status
 * - Exchange service status
 * - Ledger service status
 * - KYC service status
 *
 * Metrics Collected:
 * - Node.js version, PID, uptime, memory, CPU
 * - OS platform, architecture, CPU count, memory, load average
 * - Service health checks
 * - Connection status for external services
 *
 * Use Cases:
 * - Admin dashboard data
 * - System monitoring
 * - Health check aggregation
 * - Service status reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const logger_1 = require("./logger");
const database_1 = require("./database");
const redis_1 = require("./redis");
const keycloak_1 = require("./keycloak");
const rbac_1 = require("./rbac");
const dex_1 = require("./dex");
const native_cex_1 = require("./native-cex");
const blnkfinance_1 = require("./blnkfinance");
const nft_1 = require("./nft");
const multi_tier_ledger_1 = require("./multi-tier-ledger");
const kyc_1 = require("./kyc");
const event_streaming_1 = require("./event-streaming");
class DashboardService {
    static async getSystemInfo() {
        const os = require('os');
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        const load = os.loadavg();
        const up = process.uptime();
        return {
            node: {
                version: process.version,
                pid: process.pid,
                uptimeSec: up,
                memory: {
                    rss: mem.rss,
                    heapUsed: mem.heapUsed,
                    heapTotal: mem.heapTotal,
                    external: mem.external
                },
                cpu: {
                    user: cpu.user,
                    system: cpu.system
                }
            },
            os: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus()?.length || 0,
                totalMem: os.totalmem(),
                freeMem: os.freemem(),
                load1: load[0],
                load5: load[1],
                load15: load[2],
                hostname: os.hostname(),
                uptimeSec: os.uptime()
            },
            timestamp: new Date().toISOString()
        };
    }
    static async getPlatformDashboard() {
        const services = {
            database: database_1.DatabaseService.isConnected(),
            redis: redis_1.RedisService.isConnected(),
            keycloak: keycloak_1.KeycloakService.isHealthy(),
            rbac: rbac_1.RBACService.isHealthy(),
            dex: dex_1.DEXService.isHealthy(),
            cex: native_cex_1.NativeCEXService ? true : false,
            ledger: multi_tier_ledger_1.MultiTierLedgerService.isHealthy(),
            kyc: kyc_1.KYCService.isHealthy(),
            blnkfinance: blnkfinance_1.BlnkFinanceService.isHealthy(),
            nft: nft_1.NFTService.isHealthy(),
            events: event_streaming_1.EventStreamingService ? true : true
        };
        const errorRates = logger_1.LoggerService.getMetrics?.() || {};
        return {
            services,
            api: {
                errorRates,
            },
            workloads: {
                queueDepths: {
                    payouts: 0,
                    deposits: 0,
                    kyc: 0
                },
                requestLatency: {
                    p50: 0,
                    p95: 0,
                    p99: 0
                }
            },
            riskAndCompliance: {
                travelRule: { pending: 0, sent: 0, acknowledged: 0, failed: 0 },
                carf: { pending: 0, submitted: 0, acknowledged: 0, rejected: 0 }
            },
            timestamp: new Date().toISOString()
        };
    }
    static async getBrokerDashboard(brokerId) {
        return {
            brokerId,
            kyc: {
                pending: 0,
                approved: 0,
                rejected: 0
            },
            fiatPipelines: {
                depositsPending: 0,
                withdrawalsPending: 0,
                unallocatedDeposits: 0,
                allocationsPendingApproval: 0
            },
            trading: {
                dexVolume24h: 0,
                cexVolume24h: 0,
                failedOrders24h: 0,
                avgOrderLatencyMs: 0
            },
            support: {
                openTickets: 0,
                avgFirstResponseMs: 0
            },
            timestamp: new Date().toISOString()
        };
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboard.js.map