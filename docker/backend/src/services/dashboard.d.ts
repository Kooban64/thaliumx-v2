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
export declare class DashboardService {
    static getSystemInfo(): Promise<{
        node: {
            version: string;
            pid: number;
            uptimeSec: number;
            memory: {
                rss: number;
                heapUsed: number;
                heapTotal: number;
                external: number;
            };
            cpu: {
                user: number;
                system: number;
            };
        };
        os: {
            platform: any;
            arch: any;
            cpus: any;
            totalMem: any;
            freeMem: any;
            load1: any;
            load5: any;
            load15: any;
            hostname: any;
            uptimeSec: any;
        };
        timestamp: string;
    }>;
    static getPlatformDashboard(): Promise<{
        services: {
            readonly database: boolean;
            readonly redis: boolean;
            readonly keycloak: boolean;
            readonly rbac: boolean;
            readonly dex: boolean;
            readonly cex: boolean;
            readonly ledger: boolean;
            readonly kyc: boolean;
            readonly blnkfinance: boolean;
            readonly nft: boolean;
            readonly events: true;
        };
        api: {
            errorRates: Record<string, number>;
        };
        workloads: {
            queueDepths: {
                payouts: number;
                deposits: number;
                kyc: number;
            };
            requestLatency: {
                p50: number;
                p95: number;
                p99: number;
            };
        };
        riskAndCompliance: {
            travelRule: {
                pending: number;
                sent: number;
                acknowledged: number;
                failed: number;
            };
            carf: {
                pending: number;
                submitted: number;
                acknowledged: number;
                rejected: number;
            };
        };
        timestamp: string;
    }>;
    static getBrokerDashboard(brokerId: string): Promise<{
        brokerId: string;
        kyc: {
            pending: number;
            approved: number;
            rejected: number;
        };
        fiatPipelines: {
            depositsPending: number;
            withdrawalsPending: number;
            unallocatedDeposits: number;
            allocationsPendingApproval: number;
        };
        trading: {
            dexVolume24h: number;
            cexVolume24h: number;
            failedOrders24h: number;
            avgOrderLatencyMs: number;
        };
        support: {
            openTickets: number;
            avgFirstResponseMs: number;
        };
        timestamp: string;
    }>;
}
//# sourceMappingURL=dashboard.d.ts.map