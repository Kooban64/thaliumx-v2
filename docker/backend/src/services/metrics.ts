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

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { LoggerService } from './logger';
import os from 'os';
import process from 'process';

export class MetricsService {
  private static initialized = false;
  
  // System metrics
  private static readonly memoryUsage = new Gauge({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    labelNames: ['type']
  });

  private static readonly cpuUsage = new Gauge({
    name: 'nodejs_cpu_usage_percent',
    help: 'Node.js CPU usage percentage',
    labelNames: ['type']
  });

  private static readonly loadAverage = new Gauge({
    name: 'system_load_average',
    help: 'System load average',
    labelNames: ['period']
  });

  private static readonly uptime = new Gauge({
    name: 'nodejs_uptime_seconds',
    help: 'Node.js uptime in seconds'
  });

  // Application metrics
  private static readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });

  private static readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  private static readonly databaseQueriesTotal = new Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table']
  });

  private static readonly databaseQueryDuration = new Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5]
  });

  private static readonly redisOperationsTotal = new Counter({
    name: 'redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status']
  });

  private static readonly kafkaMessagesTotal = new Counter({
    name: 'kafka_messages_total',
    help: 'Total number of Kafka messages',
    labelNames: ['topic', 'status']
  });

  // Business metrics
  private static readonly tradesTotal = new Counter({
    name: 'trades_total',
    help: 'Total number of trades executed',
    labelNames: ['exchange', 'symbol', 'side']
  });

  private static readonly tradeVolume = new Counter({
    name: 'trade_volume_total',
    help: 'Total trade volume',
    labelNames: ['exchange', 'symbol', 'side']
  });

  private static readonly activeUsers = new Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
    labelNames: ['broker_id']
  });

  private static readonly walletBalances = new Gauge({
    name: 'wallet_balances_total',
    help: 'Total wallet balances',
    labelNames: ['broker_id', 'currency', 'wallet_type']
  });

  private static readonly complianceEvents = new Counter({
    name: 'compliance_events_total',
    help: 'Total compliance events',
    labelNames: ['event_type', 'status']
  });

  // Security metrics
  private static readonly authLoginFailures = new Counter({
    name: 'auth_login_failures_total',
    help: 'Total number of failed login attempts',
    labelNames: ['reason']
  });

  private static readonly jwtValidationFailures = new Counter({
    name: 'jwt_validation_failures_total',
    help: 'Total number of JWT validation failures',
    labelNames: ['reason']
  });

  private static readonly rateLimitExceeded = new Counter({
    name: 'rate_limit_exceeded_total',
    help: 'Total number of rate limit violations',
    labelNames: ['endpoint', 'type']
  });

  private static readonly sqlInjectionBlocked = new Counter({
    name: 'sql_injection_blocked_total',
    help: 'Total number of SQL injection attempts blocked',
    labelNames: ['endpoint']
  });

  private static readonly xssBlocked = new Counter({
    name: 'xss_blocked_total',
    help: 'Total number of XSS attempts blocked',
    labelNames: ['endpoint']
  });

  // Workflow metrics
  private static readonly workflowExecutionsTotal = new Counter({
    name: 'workflow_executions_total',
    help: 'Total number of workflow executions',
    labelNames: ['workflow_type', 'status']
  });

  private static readonly workflowExecutionDuration = new Histogram({
    name: 'workflow_execution_duration_seconds',
    help: 'Duration of workflow executions in seconds',
    labelNames: ['workflow_type', 'status'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600]
  });

  // OPA metrics
  private static readonly opaEvaluationsTotal = new Counter({
    name: 'opa_evaluations_total',
    help: 'Total number of OPA policy evaluations',
    labelNames: ['policy_type', 'source', 'cache_hit', 'result']
  });

  private static readonly opaEvaluationDuration = new Histogram({
    name: 'opa_evaluation_duration_seconds',
    help: 'Duration of OPA policy evaluations in seconds',
    labelNames: ['policy_type', 'source', 'cache_hit'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  private static readonly opaCacheHits = new Counter({
    name: 'opa_cache_hits_total',
    help: 'Total number of OPA cache hits',
    labelNames: ['policy_type', 'cache_level']
  });

  private static readonly opaCacheMisses = new Counter({
    name: 'opa_cache_misses_total',
    help: 'Total number of OPA cache misses',
    labelNames: ['policy_type']
  });

  private static readonly opaWasmEvaluations = new Counter({
    name: 'opa_wasm_evaluations_total',
    help: 'Total number of OPA WASM evaluations',
    labelNames: ['policy_type']
  });

  private static readonly opaHttpEvaluations = new Counter({
    name: 'opa_http_evaluations_total',
    help: 'Total number of OPA HTTP evaluations',
    labelNames: ['policy_type']
  });

  public static initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Collect default Node.js metrics
      collectDefaultMetrics({ register });

      // Start system metrics collection
      this.startSystemMetricsCollection();

      // Start business metrics collection
      this.startBusinessMetricsCollection();

      this.initialized = true;
      LoggerService.info('Prometheus metrics service initialized successfully');
    } catch (error) {
      LoggerService.error('Failed to initialize Prometheus metrics service:', { error });
    }
  }

  private static startSystemMetricsCollection(): void {
    setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const loadAvg = os.loadavg();

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
        this.uptime.set(process.uptime());
      } catch (error) {
        LoggerService.error('Error collecting system metrics:', { error });
      }
    }, 10000); // Every 10 seconds
  }

  private static startBusinessMetricsCollection(): void {
    setInterval(() => {
      void (async () => {
        try {
          // Collect real business metrics from database
        const { DatabaseService } = await import('./database');
        
        // Active users count
        try {
          const UserModel: any = DatabaseService.getModel('User');
          if (UserModel) {
            const activeUsersCount = await UserModel.count({
              where: { isActive: true }
            });
            this.activeUsers.set({ broker_id: 'platform' }, activeUsersCount);
          }
        } catch (error: any) {
          LoggerService.debug('Could not collect active users metric:', error.message);
        }
        
        // Wallet balances
        try {
          const WalletModel: any = DatabaseService.getModel('Wallet');
          if (WalletModel) {
            const wallets = await WalletModel.findAll({
              attributes: ['brokerId', 'currency', 'type', 'balance'],
              where: { isActive: true }
            });
            
            // Group by broker, currency, and wallet type
            const balanceMap = new Map<string, number>();
            
            for (const wallet of wallets) {
              const data = wallet.dataValues || wallet;
              const key = `${data.brokerId || 'platform'}_${data.currency || 'USDT'}_${data.type || 'hot'}`;
              const currentBalance = parseFloat(data.balance || '0');
              
              if (balanceMap.has(key)) {
                balanceMap.set(key, (balanceMap.get(key) || 0) + currentBalance);
              } else {
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
        } catch (error: any) {
          LoggerService.debug('Could not collect wallet balance metrics:', error.message);
        }
      } catch (error) {
        LoggerService.error('Error collecting business metrics:', { error });
      }
      })();
    }, 30000); // Every 30 seconds
  }

  // HTTP metrics
  public static recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration / 1000);
  }

  // Database metrics
  public static recordDatabaseQuery(operation: string, table: string, duration: number): void {
    this.databaseQueriesTotal.inc({ operation, table });
    this.databaseQueryDuration.observe({ operation, table }, duration / 1000);
  }

  // Redis metrics
  public static recordRedisOperation(operation: string, status: string): void {
    this.redisOperationsTotal.inc({ operation, status });
  }

  // Kafka metrics
  public static recordKafkaMessage(topic: string, status: string): void {
    this.kafkaMessagesTotal.inc({ topic, status });
  }

  // Business metrics
  public static recordTrade(exchange: string, symbol: string, side: string, volume: number): void {
    this.tradesTotal.inc({ exchange, symbol, side });
    this.tradeVolume.inc({ exchange, symbol, side }, volume);
  }

  public static setActiveUsers(brokerId: string, count: number): void {
    this.activeUsers.set({ broker_id: brokerId }, count);
  }

  public static setWalletBalance(brokerId: string, currency: string, walletType: string, balance: number): void {
    this.walletBalances.set({ broker_id: brokerId, currency, wallet_type: walletType }, balance);
  }

  public static recordComplianceEvent(eventType: string, status: string): void {
    this.complianceEvents.inc({ event_type: eventType, status });
  }

  // Security metrics
  public static recordAuthLoginFailure(reason: string = 'invalid_credentials'): void {
    this.authLoginFailures.inc({ reason });
  }

  public static recordJWTValidationFailure(reason: string = 'invalid_token'): void {
    this.jwtValidationFailures.inc({ reason });
  }

  public static recordRateLimitExceeded(endpoint: string, type: string = 'general'): void {
    this.rateLimitExceeded.inc({ endpoint, type });
  }

  public static recordSQLInjectionBlocked(endpoint: string): void {
    this.sqlInjectionBlocked.inc({ endpoint });
  }

  public static recordXSSBlocked(endpoint: string): void {
    this.xssBlocked.inc({ endpoint });
  }

  // Workflow metrics
  public static recordWorkflowExecution(workflowType: string, status: string, duration: number): void {
    this.workflowExecutionsTotal.inc({ workflow_type: workflowType, status });
    this.workflowExecutionDuration.observe({ workflow_type: workflowType, status }, duration / 1000);
  }

  // OPA metrics
  public static recordOPAEvaluation(
    policyType: string,
    source: 'wasm' | 'http',
    cacheHit: boolean,
    duration: number,
    result: 'allowed' | 'denied' | 'error'
  ): void {
    this.opaEvaluationsTotal.inc({
      policy_type: policyType,
      source,
      cache_hit: cacheHit ? 'true' : 'false',
      result
    });
    this.opaEvaluationDuration.observe(
      { policy_type: policyType, source, cache_hit: cacheHit ? 'true' : 'false' },
      duration / 1000
    );

    if (cacheHit) {
      this.opaCacheHits.inc({ policy_type: policyType, cache_level: 'memory' });
    } else {
      this.opaCacheMisses.inc({ policy_type: policyType });
    }

    if (source === 'wasm') {
      this.opaWasmEvaluations.inc({ policy_type: policyType });
    } else {
      this.opaHttpEvaluations.inc({ policy_type: policyType });
    }
  }

  public static async getMetrics(): Promise<string> {
    return register.metrics();
  }

  public static getMetricsAsJSON(): Promise<any> {
    return register.getMetricsAsJSON();
  }

  public static clear(): void {
    register.clear();
  }
}
