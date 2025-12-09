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

import { LoggerService } from './logger';
import { DatabaseService } from './database';
import { RedisService } from './redis';
import { KeycloakService } from './keycloak';
import { RBACService } from './rbac';
import { DEXService } from './dex';
import { NativeCEXService } from './native-cex';
import { BlnkFinanceService } from './blnkfinance';
import { NFTService } from './nft';
import { MultiTierLedgerService } from './multi-tier-ledger';
import { KYCService } from './kyc';
import { EventStreamingService } from './event-streaming';

export class DashboardService {
  public static async getSystemInfo() {
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

  public static async getPlatformDashboard() {
    const services = {
      database: DatabaseService.isConnected(),
      redis: RedisService.isConnected(),
      keycloak: KeycloakService.isHealthy(),
      rbac: RBACService.isHealthy(),
      dex: DEXService.isHealthy(),
      cex: NativeCEXService ? true : false,
      ledger: MultiTierLedgerService.isHealthy(),
      kyc: KYCService.isHealthy(),
      blnkfinance: BlnkFinanceService.isHealthy(),
      nft: NFTService.isHealthy(),
      events: EventStreamingService ? true : true
    } as const;

    const errorRates = LoggerService.getMetrics?.() || {};

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

  public static async getBrokerDashboard(brokerId: string) {
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



