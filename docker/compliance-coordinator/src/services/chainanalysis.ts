/**
 * ChainAnalysis Service Client
 * Integrates with thaliumx-compliance-chainanalysis service
 */

import { logger } from '../utils/logger';

export interface ChainAnalysisConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface TransactionTraceRequest {
  txHash: string;
  chain: string;
  depth?: number;
}

export interface AddressRiskRequest {
  address: string;
  chain: string;
}

export interface TransactionRiskRequest {
  txHash: string;
  chain: string;
}

interface HealthResponse {
  status?: string;
}

export interface ChainAnalysisResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  timestamp: string;
}

export interface TransactionAnalysis {
  txHash: string;
  chain: string;
  depth: number;
  transaction: {
    from: string;
    to: string | null;
    value: string;
    gasPrice: string;
    gasLimit: string;
  };
  receipt: {
    status: boolean;
    gasUsed: string;
    logs: number;
  };
  analysis: {
    isContractInteraction: boolean;
    isLargeTransaction: boolean;
    gasEfficiency: number;
    riskFactors: string[];
  };
  relatedTransactions: Array<{
    hash: string;
    from: string;
    to: string | null;
    value: string;
    timestamp: string;
  }>;
  riskScore: number;
  entities: Array<{
    address: string;
    clusterId?: string;
    riskScore: number;
    labels: string[];
  }>;
  timestamp: string;
}

export interface RiskScoreResponse {
  address?: string;
  txHash?: string;
  chain: string;
  riskScore: number;
  labels: string[];
  analysis: {
    balance?: string;
    transactionCount?: number;
    riskFactors: string[];
  };
  timestamp: string;
}

export interface AlertResponse {
  alerts: Array<{
    id: string;
    type: 'high_risk_transaction' | 'suspicious_pattern' | 'large_transfer' | 'circular_flow';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    entities: string[];
    riskScore: number;
    timestamp: string;
  }>;
  total: number;
  timestamp: string;
}

export class ChainAnalysisService {
  private config: ChainAnalysisConfig;

  constructor(config: Partial<ChainAnalysisConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://thaliumx-compliance-chainanalysis:3011',
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };
  }

  /**
   * Trace transaction with blockchain analysis
   */
  async traceTransaction(request: TransactionTraceRequest): Promise<ChainAnalysisResponse<TransactionAnalysis>> {
    try {
      const response = await this.makeRequest<TransactionAnalysis>(
        'POST',
        '/api/v1/chainanalysis/analytics/transaction-trace',
        request
      );

      logger.info('ChainAnalysis transaction trace completed', {
        txHash: request.txHash,
        chain: request.chain,
        depth: request.depth,
        success: response.success,
      });

      return response;
    } catch (error) {
      logger.error('ChainAnalysis transaction trace failed', {
        txHash: request.txHash,
        chain: request.chain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction trace failed',
        requestId: `trace-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Score address risk
   */
  async scoreAddressRisk(request: AddressRiskRequest): Promise<ChainAnalysisResponse<RiskScoreResponse>> {
    try {
      const response = await this.makeRequest<RiskScoreResponse>(
        'POST',
        '/api/v1/chainanalysis/risk/score-address',
        request
      );

      logger.info('ChainAnalysis address risk score completed', {
        address: request.address,
        chain: request.chain,
        riskScore: response.data?.riskScore,
        success: response.success,
      });

      return response;
    } catch (error) {
      logger.error('ChainAnalysis address risk scoring failed', {
        address: request.address,
        chain: request.chain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Address risk scoring failed',
        requestId: `address-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Score transaction risk
   */
  async scoreTransactionRisk(request: TransactionRiskRequest): Promise<ChainAnalysisResponse<RiskScoreResponse>> {
    try {
      const response = await this.makeRequest<RiskScoreResponse>(
        'POST',
        '/api/v1/chainanalysis/risk/score-transaction',
        request
      );

      logger.info('ChainAnalysis transaction risk score completed', {
        txHash: request.txHash,
        chain: request.chain,
        riskScore: response.data?.riskScore,
        success: response.success,
      });

      return response;
    } catch (error) {
      logger.error('ChainAnalysis transaction risk scoring failed', {
        txHash: request.txHash,
        chain: request.chain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction risk scoring failed',
        requestId: `transaction-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<ChainAnalysisResponse<AlertResponse>> {
    try {
      const response = await this.makeRequest<AlertResponse>(
        'GET',
        '/api/v1/chainanalysis/risk/alerts'
      );

      logger.info('ChainAnalysis alerts retrieved', {
        alertCount: response.data?.total ?? 0,
        success: response.success,
      });

      return response;
    } catch (error) {
      logger.error('ChainAnalysis alerts retrieval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Alerts retrieval failed',
        requestId: `alerts-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest<HealthResponse>('GET', '/health');
      return response.success && response.data?.status === 'healthy';
    } catch (error) {
      logger.warn('ChainAnalysis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<ChainAnalysisResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const requestHeaders = new Headers();
        requestHeaders.set('Content-Type', 'application/json');
        requestHeaders.set('User-Agent', 'ThaliumX-Compliance-Coordinator/1.0.0');

        const requestInit: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body !== undefined) {
          requestInit.body = JSON.stringify(body);
        }

        const response = await fetch(url, requestInit);

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: T = (await response.json()) as T;

        return {
          success: true,
          data,
          requestId: `req-${Date.now()}-${attempt}`,
          timestamp: new Date().toISOString(),
        };

      } catch (error) {
        logger.warn(`ChainAnalysis request attempt ${attempt} failed`, {
          method,
          path,
          attempt,
          maxRetries: this.config.retries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (attempt === this.config.retries) {
          throw error;
        }

        // Exponential backoff
        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.pow(2, attempt) * 1000);
        });
      }
    }

    throw new Error('All retry attempts exhausted');
  }
}

// Singleton instance
let chainAnalysisService: ChainAnalysisService | null = null;

export function getChainAnalysisService(): ChainAnalysisService {
  if (!chainAnalysisService) {
    const configuredBaseUrl = process.env['CHAINANALYSIS_URL'];
    const configuredTimeout = process.env['CHAINANALYSIS_TIMEOUT'];
    const configuredRetries = process.env['CHAINANALYSIS_RETRIES'];

    chainAnalysisService = new ChainAnalysisService({
      baseUrl: configuredBaseUrl ?? 'http://thaliumx-compliance-chainanalysis:3011',
      timeout: configuredTimeout !== undefined ? parseInt(configuredTimeout, 10) : 30000,
      retries: configuredRetries !== undefined ? parseInt(configuredRetries, 10) : 3,
    });
  }
  return chainAnalysisService;
}

export function createChainAnalysisService(config?: Partial<ChainAnalysisConfig>): ChainAnalysisService {
  return new ChainAnalysisService(config);
}
