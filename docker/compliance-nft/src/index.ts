/**
 * NFT Compliance Service
 * Main entry point for the NFT compliance microservice
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { getConfig, validateConfig } from './config';
import { createComponentLogger } from './utils/logger';
import {
  getDatabaseService,
  getEventProducer,
  getEventConsumer,
  subscribeToNFTEvents,
  getWashTradingService,
  getContentScreeningService,
  getNFTRiskAssessmentService,
  getNFTTravelRuleService,
  getNFTCARFService,
} from './services';
import { CARFReportOptions } from './services/carf/NFTCARFService';
import { ContentScreeningService } from './services/content-screening';
import { RiskAssessmentInput } from './services/risk-assessment/NFTRiskAssessmentService';
import { TravelRuleInput } from './services/travel-rule/NFTTravelRuleService';
import { WashTradingService } from './services/wash-trading';
import { ServiceHealth } from './types/compliance';
import { NFT_COMPLIANCE_TOPICS } from './types/events';

const appLogger = createComponentLogger('app');

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ContentType = 'image' | 'video' | 'audio' | '3d_model' | 'other';

interface ValidationIssue {
  field: string;
  message: string;
}

interface ValidationResult<T> {
  data?: T;
  issues: ValidationIssue[];
}

interface MetricsSnapshot {
  pendingScreenings: number;
  pendingAssessments: number;
  highRiskAlerts: number;
}

interface HealthDependencyStatus {
  status: 'connected' | 'degraded' | 'disconnected';
  latency: number;
}

interface BlockchainProviderHealth {
  chainId: number;
  name: string;
  blockNumber: number | null;
  latency: number;
  status: 'connected' | 'degraded' | 'disconnected';
  rpcUrl: string;
}

interface RiskReviewRequest {
  reviewedBy: string;
  approved: boolean;
  reviewNotes?: string;
  overrideReason?: string;
  newRiskLevel?: RiskLevel;
}

interface ContentReviewRequest {
  reviewedBy: string;
  approved: boolean;
  reviewNotes?: string;
  actionTaken?: string;
}

interface CarfSubmitRequest {
  submittedTo: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function parseInteger(value: unknown, field: string, issues: ValidationIssue[], options?: { min?: number }): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push({ field, message: 'Must be an integer' });
    return undefined;
  }

  if (options?.min !== undefined && value < options.min) {
    issues.push({ field, message: `Must be greater than or equal to ${options.min}` });
    return undefined;
  }

  return value;
}

function parseIntegerString(value: unknown, field: string, issues: ValidationIssue[], options?: { min?: number }): number | undefined {
  if (!isNonEmptyString(value)) {
    issues.push({ field, message: 'Must be a non-empty integer string' });
    return undefined;
  }

  if (!/^-?\d+$/.test(value.trim())) {
    issues.push({ field, message: 'Must be a valid integer string' });
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    issues.push({ field, message: 'Must be a safe integer value' });
    return undefined;
  }

  if (options?.min !== undefined && parsed < options.min) {
    issues.push({ field, message: `Must be greater than or equal to ${options.min}` });
    return undefined;
  }

  return parsed;
}

function parseOptionalPositiveIntegerQuery(value: unknown, field: string, issues: ValidationIssue[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    issues.push({ field, message: 'Must be a non-empty integer string when provided' });
    return undefined;
  }

  return parseIntegerString(value, field, issues, { min: 1 });
}

function parseIsoDate(value: unknown, field: string, issues: ValidationIssue[]): Date | undefined {
  if (!isNonEmptyString(value)) {
    issues.push({ field, message: 'Must be a non-empty ISO 8601 date string' });
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    issues.push({ field, message: 'Must be a valid ISO 8601 date string' });
    return undefined;
  }

  return parsed;
}

function parseOptionalString(value: unknown, field: string, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    issues.push({ field, message: 'Must be a non-empty string when provided' });
    return undefined;
  }

  return value.trim();
}

function parseRequiredString(value: unknown, field: string, issues: ValidationIssue[]): string | undefined {
  const parsed = parseOptionalString(value, field, issues);
  if (parsed === undefined) {
    issues.push({ field, message: 'Field is required' });
    return undefined;
  }

  return parsed;
}

function parseStringEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
  issues: ValidationIssue[]
): T | undefined {
  if (!isNonEmptyString(value)) {
    issues.push({ field, message: `Must be one of: ${allowedValues.join(', ')}` });
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    issues.push({ field, message: `Must be one of: ${allowedValues.join(', ')}` });
    return undefined;
  }

  return value as T;
}

function parseNestedPartyInfo(value: unknown, field: string, issues: ValidationIssue[]): TravelRuleInput['originatorInfo'] {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    issues.push({ field, message: 'Must be an object when provided' });
    return undefined;
  }

  const name = parseOptionalString(value['name'], `${field}.name`, issues);
  const address = parseOptionalString(value['address'], `${field}.address`, issues);
  const country = parseOptionalString(value['country'], `${field}.country`, issues);
  const accountNumber = parseOptionalString(value['accountNumber'], `${field}.accountNumber`, issues);

  return {
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(country ? { country } : {}),
    ...(accountNumber ? { accountNumber } : {}),
  };
}

function sendValidationError(res: Response, issues: ValidationIssue[]): void {
  res.status(400).json({
    error: 'Invalid request',
    issues,
  });
}

function validateWashTradingAnalyzeRequest(body: unknown): ValidationResult<Parameters<WashTradingService['analyzeSale']>> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const saleId = parseRequiredString(body['saleId'], 'saleId', issues);
  const contractAddress = parseRequiredString(body['contractAddress'], 'contractAddress', issues);
  const tokenId = parseRequiredString(body['tokenId'], 'tokenId', issues);
  const chainId = parseInteger(body['chainId'], 'chainId', issues, { min: 1 });
  const sellerAddress = parseRequiredString(body['sellerAddress'], 'sellerAddress', issues);
  const buyerAddress = parseRequiredString(body['buyerAddress'], 'buyerAddress', issues);
  const price = parseRequiredString(body['price'], 'price', issues);
  const priceUSD = parseRequiredString(body['priceUSD'], 'priceUSD', issues);
  const tenantId = parseRequiredString(body['tenantId'], 'tenantId', issues);

  if (issues.length > 0 || !saleId || !contractAddress || !tokenId || chainId === undefined || !sellerAddress || !buyerAddress || !price || !priceUSD || !tenantId) {
    return { issues };
  }

  return {
    data: [saleId, contractAddress, tokenId, chainId, sellerAddress, buyerAddress, price, priceUSD, tenantId],
    issues,
  };
}

function validateContentScreenRequest(body: unknown): ValidationResult<Parameters<ContentScreeningService['screenContent']>> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const contentTypes = ['image', 'video', 'audio', '3d_model', 'other'] as const;
  const contractAddress = parseRequiredString(body['contractAddress'], 'contractAddress', issues);
  const tokenId = parseRequiredString(body['tokenId'], 'tokenId', issues);
  const chainId = parseInteger(body['chainId'], 'chainId', issues, { min: 1 });
  const contentUrl = parseRequiredString(body['contentUrl'], 'contentUrl', issues);
  const contentType = parseStringEnum<ContentType>(body['contentType'], 'contentType', contentTypes, issues);
  const tenantId = parseRequiredString(body['tenantId'], 'tenantId', issues);

  if (issues.length > 0 || !contractAddress || !tokenId || chainId === undefined || !contentUrl || !contentType || !tenantId) {
    return { issues };
  }

  return {
    data: [contractAddress, tokenId, chainId, contentUrl, contentType, tenantId],
    issues,
  };
}

function validateRiskAssessRequest(body: unknown): ValidationResult<RiskAssessmentInput> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const transactionId = parseRequiredString(body['transactionId'], 'transactionId', issues);
  const transactionHash = parseRequiredString(body['transactionHash'], 'transactionHash', issues);
  const contractAddress = parseRequiredString(body['contractAddress'], 'contractAddress', issues);
  const tokenId = parseRequiredString(body['tokenId'], 'tokenId', issues);
  const chainId = parseInteger(body['chainId'], 'chainId', issues, { min: 1 });
  const sellerAddress = parseRequiredString(body['sellerAddress'], 'sellerAddress', issues);
  const buyerAddress = parseRequiredString(body['buyerAddress'], 'buyerAddress', issues);
  const price = parseRequiredString(body['price'], 'price', issues);
  const priceUSD = parseRequiredString(body['priceUSD'], 'priceUSD', issues);
  const marketplace = parseRequiredString(body['marketplace'], 'marketplace', issues);
  const tenantId = parseRequiredString(body['tenantId'], 'tenantId', issues);
  const userId = parseOptionalString(body['userId'], 'userId', issues);
  const brokerId = parseOptionalString(body['brokerId'], 'brokerId', issues);

  if (issues.length > 0 || !transactionId || !transactionHash || !contractAddress || !tokenId || chainId === undefined || !sellerAddress || !buyerAddress || !price || !priceUSD || !marketplace || !tenantId) {
    return { issues };
  }

  const data: RiskAssessmentInput = {
    transactionId,
    transactionHash,
    contractAddress,
    tokenId,
    chainId,
    sellerAddress,
    buyerAddress,
    price,
    priceUSD,
    marketplace,
    tenantId,
  };

  if (userId) {
    data.userId = userId;
  }

  if (brokerId) {
    data.brokerId = brokerId;
  }

  return { data, issues };
}

function validateRiskReviewRequest(body: unknown): ValidationResult<RiskReviewRequest> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const riskLevels = ['low', 'medium', 'high', 'critical'] as const;
  const reviewedBy = parseRequiredString(body['reviewedBy'], 'reviewedBy', issues);
  const approved = isBoolean(body['approved']) ? body['approved'] : (issues.push({ field: 'approved', message: 'Must be a boolean' }), undefined);
  const reviewNotes = parseOptionalString(body['reviewNotes'], 'reviewNotes', issues);
  const overrideReason = parseOptionalString(body['overrideReason'], 'overrideReason', issues);
  const newRiskLevel = body['newRiskLevel'] === undefined
    ? undefined
    : parseStringEnum<RiskLevel>(body['newRiskLevel'], 'newRiskLevel', riskLevels, issues);

  if (issues.length > 0 || !reviewedBy || approved === undefined) {
    return { issues };
  }

  const data: RiskReviewRequest = { reviewedBy, approved };

  if (reviewNotes) {
    data.reviewNotes = reviewNotes;
  }

  if (overrideReason) {
    data.overrideReason = overrideReason;
  }

  if (newRiskLevel) {
    data.newRiskLevel = newRiskLevel;
  }

  return { data, issues };
}

function validateContentReviewRequest(body: unknown): ValidationResult<ContentReviewRequest> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const reviewedBy = parseRequiredString(body['reviewedBy'], 'reviewedBy', issues);
  const approved = isBoolean(body['approved']) ? body['approved'] : (issues.push({ field: 'approved', message: 'Must be a boolean' }), undefined);
  const reviewNotes = parseOptionalString(body['reviewNotes'], 'reviewNotes', issues);
  const actionTaken = parseOptionalString(body['actionTaken'], 'actionTaken', issues);

  if (issues.length > 0 || !reviewedBy || approved === undefined) {
    return { issues };
  }

  const data: ContentReviewRequest = { reviewedBy, approved };

  if (reviewNotes) {
    data.reviewNotes = reviewNotes;
  }

  if (actionTaken) {
    data.actionTaken = actionTaken;
  }

  return { data, issues };
}

function validateTravelRuleCreateRequest(body: unknown): ValidationResult<TravelRuleInput> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const saleId = parseRequiredString(body['saleId'], 'saleId', issues);
  const contractAddress = parseRequiredString(body['contractAddress'], 'contractAddress', issues);
  const tokenId = parseRequiredString(body['tokenId'], 'tokenId', issues);
  const chainId = parseInteger(body['chainId'], 'chainId', issues, { min: 1 });
  const sellerAddress = parseRequiredString(body['sellerAddress'], 'sellerAddress', issues);
  const buyerAddress = parseRequiredString(body['buyerAddress'], 'buyerAddress', issues);
  const price = parseRequiredString(body['price'], 'price', issues);
  const priceUSD = parseRequiredString(body['priceUSD'], 'priceUSD', issues);
  const currency = parseRequiredString(body['currency'], 'currency', issues);
  const timestamp = parseIsoDate(body['timestamp'], 'timestamp', issues);
  const tenantId = parseRequiredString(body['tenantId'], 'tenantId', issues);
  const brokerId = parseOptionalString(body['brokerId'], 'brokerId', issues);
  const userId = parseOptionalString(body['userId'], 'userId', issues);
  const originatorInfo = parseNestedPartyInfo(body['originatorInfo'], 'originatorInfo', issues);
  const beneficiaryInfo = parseNestedPartyInfo(body['beneficiaryInfo'], 'beneficiaryInfo', issues);

  if (issues.length > 0 || !saleId || !contractAddress || !tokenId || chainId === undefined || !sellerAddress || !buyerAddress || !price || !priceUSD || !currency || !timestamp || !tenantId) {
    return { issues };
  }

  const data: TravelRuleInput = {
    saleId,
    contractAddress,
    tokenId,
    chainId,
    sellerAddress,
    buyerAddress,
    price,
    priceUSD,
    currency,
    timestamp,
    tenantId,
  };

  if (brokerId) {
    data.brokerId = brokerId;
  }

  if (userId) {
    data.userId = userId;
  }

  if (originatorInfo && Object.keys(originatorInfo).length > 0) {
    data.originatorInfo = originatorInfo;
  }

  if (beneficiaryInfo && Object.keys(beneficiaryInfo).length > 0) {
    data.beneficiaryInfo = beneficiaryInfo;
  }

  return { data, issues };
}

function validateCarfGenerateRequest(body: unknown): ValidationResult<CARFReportOptions> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const walletAddress = parseRequiredString(body['walletAddress'], 'walletAddress', issues);
  const startDate = parseIsoDate(body['startDate'], 'startDate', issues);
  const endDate = parseIsoDate(body['endDate'], 'endDate', issues);
  const fiscalYear = parseOptionalString(body['fiscalYear'], 'fiscalYear', issues);
  const userId = parseOptionalString(body['userId'], 'userId', issues);
  const tenantId = parseRequiredString(body['tenantId'], 'tenantId', issues);
  const brokerId = parseOptionalString(body['brokerId'], 'brokerId', issues);

  if (startDate && endDate && startDate > endDate) {
    issues.push({ field: 'startDate', message: 'Must be before or equal to endDate' });
  }

  if (issues.length > 0 || !walletAddress || !startDate || !endDate || !tenantId) {
    return { issues };
  }

  const data: CARFReportOptions = {
    walletAddress,
    startDate,
    endDate,
    tenantId,
  };

  if (fiscalYear) {
    data.fiscalYear = fiscalYear;
  }

  if (userId) {
    data.userId = userId;
  }

  if (brokerId) {
    data.brokerId = brokerId;
  }

  return { data, issues };
}

function validateCarfSubmitRequest(body: unknown): ValidationResult<CarfSubmitRequest> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return { issues: [{ field: 'body', message: 'Request body must be an object' }] };
  }

  const submittedTo = parseRequiredString(body['submittedTo'], 'submittedTo', issues);
  if (issues.length > 0 || !submittedTo) {
    return { issues };
  }

  return { data: { submittedTo }, issues };
}

function validateRequiredIdParam(value: unknown, field: string): ValidationResult<string> {
  const issues: ValidationIssue[] = [];
  const parsed = parseRequiredString(value, field, issues);

  if (!parsed || issues.length > 0) {
    return { issues };
  }

  return { data: parsed, issues };
}

function validateTenantHeader(req: Request): ValidationResult<string> {
  const issues: ValidationIssue[] = [];
  const tenantId = parseRequiredString(req.headers['x-tenant-id'], 'x-tenant-id', issues);

  if (!tenantId || issues.length > 0) {
    return { issues };
  }

  return { data: tenantId, issues };
}

function validatePaginationLimit(req: Request, field = 'limit'): ValidationResult<number> {
  const issues: ValidationIssue[] = [];
  const parsed = parseOptionalPositiveIntegerQuery(req.query[field], field, issues) ?? 100;

  if (issues.length > 0) {
    return { issues };
  }

  return { data: parsed, issues };
}

function validateWashTradingTokenPath(req: Request): ValidationResult<{ contractAddress: string; tokenId: string; chainId: number; tenantId: string }> {
  const issues: ValidationIssue[] = [];
  const contractAddress = parseRequiredString(req.params['contractAddress'], 'contractAddress', issues);
  const tokenId = parseRequiredString(req.params['tokenId'], 'tokenId', issues);
  const chainId = parseIntegerString(req.params['chainId'], 'chainId', issues, { min: 1 });
  const tenantId = parseRequiredString(req.headers['x-tenant-id'], 'x-tenant-id', issues);

  if (!contractAddress || !tokenId || chainId === undefined || !tenantId || issues.length > 0) {
    return { issues };
  }

  return {
    data: { contractAddress, tokenId, chainId, tenantId },
    issues,
  };
}

async function getRedisHealth(): Promise<HealthDependencyStatus> {
  const config = getConfig();
  const startTime = Date.now();

  try {
    const socket = await import('node:net');
    await new Promise<void>((resolve, reject) => {
      const client = socket.createConnection({
        host: config.redis.host,
        port: config.redis.port,
      });

      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('Redis health check timed out'));
      }, 2000);

      client.once('connect', () => {
        clearTimeout(timeout);
        client.end();
        resolve();
      });

      client.once('error', (error: Error) => {
        clearTimeout(timeout);
        client.destroy();
        reject(error);
      });
    });

    return {
      status: 'connected',
      latency: Date.now() - startTime,
    };
  } catch (error) {
    appLogger.warn('Redis health check failed', {
      error: (error as Error).message,
      host: config.redis.host,
      port: config.redis.port,
    });

    return {
      status: 'disconnected',
      latency: Date.now() - startTime,
    };
  }
}

async function getBlockchainHealth(): Promise<BlockchainProviderHealth[]> {
  const config = getConfig();

  const { JsonRpcProvider } = await import('ethers');

  return Promise.all(config.blockchain.providers.map(async (providerConfig) => {
    const startTime = Date.now();

    try {
      const provider = new JsonRpcProvider(providerConfig.rpcUrl, providerConfig.chainId, {
        staticNetwork: true,
      });
      const blockNumber = await provider.getBlockNumber();

      return {
        chainId: providerConfig.chainId,
        name: providerConfig.name,
        blockNumber,
        latency: Date.now() - startTime,
        status: 'connected' as const,
        rpcUrl: providerConfig.rpcUrl,
      };
    } catch (error) {
      appLogger.warn('Blockchain provider health check failed', {
        chainId: providerConfig.chainId,
        provider: providerConfig.name,
        rpcUrl: providerConfig.rpcUrl,
        error: (error as Error).message,
      });

      return {
        chainId: providerConfig.chainId,
        name: providerConfig.name,
        blockNumber: null,
        latency: Date.now() - startTime,
        status: 'disconnected' as const,
        rpcUrl: providerConfig.rpcUrl,
      };
    }
  }));
}

async function getComplianceMetrics(): Promise<MetricsSnapshot> {
  const db = getDatabaseService();

  const pendingScreeningsResult = await db.queryOne<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM content_screenings
    WHERE manual_review_required = true
  `);

  const pendingAssessmentsResult = await db.queryOne<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM nft_risk_assessments
    WHERE review_required = true
  `);

  const highRiskAlertsResult = await db.queryOne<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM nft_risk_assessments
    WHERE risk_level IN ('high', 'critical')
      AND assessment_date >= NOW() - INTERVAL '24 hours'
  `);

  return {
    pendingScreenings: Number.parseInt(pendingScreeningsResult?.count ?? '0', 10),
    pendingAssessments: Number.parseInt(pendingAssessmentsResult?.count ?? '0', 10),
    highRiskAlerts: Number.parseInt(highRiskAlertsResult?.count ?? '0', 10),
  };
}

/**
 * Create Express application
 */
function createApp(): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      appLogger.logHttpRequest(req.method, req.path, res.statusCode, duration, {
        requestId,
        tenantId: req.headers['x-tenant-id'] as string,
      });
    });

    next();
  });

  // Health check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await getServiceHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  });

  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const health = await getServiceHealth();
      res.status(200).type('text/plain; version=0.0.4').send([
        '# HELP nft_compliance_service_up Whether the NFT compliance service dependencies are healthy',
        '# TYPE nft_compliance_service_up gauge',
        `nft_compliance_service_up ${health.status === 'unhealthy' ? 0 : 1}`,
        '# HELP nft_compliance_pending_screenings Number of pending manual content reviews',
        '# TYPE nft_compliance_pending_screenings gauge',
        `nft_compliance_pending_screenings ${health.compliance.pendingScreenings}`,
        '# HELP nft_compliance_pending_assessments Number of pending manual risk reviews',
        '# TYPE nft_compliance_pending_assessments gauge',
        `nft_compliance_pending_assessments ${health.compliance.pendingAssessments}`,
        '# HELP nft_compliance_high_risk_alerts_24h Number of high-risk assessments in the last 24 hours',
        '# TYPE nft_compliance_high_risk_alerts_24h gauge',
        `nft_compliance_high_risk_alerts_24h ${health.compliance.highRiskAlerts}`,
        '# HELP nft_compliance_memory_heap_used_bytes Process heap memory used in bytes',
        '# TYPE nft_compliance_memory_heap_used_bytes gauge',
        `nft_compliance_memory_heap_used_bytes ${health.memory.used}`,
        '# HELP nft_compliance_database_latency_ms Database health check latency in milliseconds',
        '# TYPE nft_compliance_database_latency_ms gauge',
        `nft_compliance_database_latency_ms ${health.database.latency}`,
        '# HELP nft_compliance_redis_up Whether Redis is reachable',
        '# TYPE nft_compliance_redis_up gauge',
        `nft_compliance_redis_up ${health.redis.status === 'connected' ? 1 : 0}`,
        '# HELP nft_compliance_redis_latency_ms Redis health check latency in milliseconds',
        '# TYPE nft_compliance_redis_latency_ms gauge',
        `nft_compliance_redis_latency_ms ${health.redis.latency}`,
      ].join('\n'));
    } catch (error) {
      res.status(503).type('text/plain; version=0.0.4').send([
        '# HELP nft_compliance_service_up Whether the NFT compliance service dependencies are healthy',
        '# TYPE nft_compliance_service_up gauge',
        'nft_compliance_service_up 0',
        `# ERROR ${(error as Error).message.replaceAll('\n', ' ')}`,
      ].join('\n'));
    }
  });

  // Readiness check endpoint
  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      const db = getDatabaseService();
      const producer = getEventProducer();

      if (db.isHealthy() && producer.isHealthy()) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false });
      }
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  // API routes
  setupRoutes(app);

  // Error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    appLogger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Setup API routes
 */
function setupRoutes(app: Express): void {
  const config = getConfig();

  // Wash Trading Detection endpoints
  app.post('/api/v1/wash-trading/analyze', async (req: Request, res: Response) => {
    try {
      const validation = validateWashTradingAnalyzeRequest(req.body);
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getWashTradingService();
      const result = await service.analyzeSale(...validation.data);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/wash-trading/token/:contractAddress/:tokenId/:chainId', async (req: Request, res: Response) => {
    try {
      const validation = validateWashTradingTokenPath(req);
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getWashTradingService();
      const history = await service.getTokenHistory(
        validation.data.contractAddress,
        validation.data.tokenId,
        validation.data.chainId,
        validation.data.tenantId
      );

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Content Screening endpoints
  app.post('/api/v1/content/screen', async (req: Request, res: Response) => {
    try {
      const validation = validateContentScreenRequest(req.body);
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getContentScreeningService();
      const result = await service.screenContent(...validation.data);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/v1/content/review/:screeningId', async (req: Request, res: Response) => {
    try {
      const screeningIdValidation = validateRequiredIdParam(req.params['screeningId'], 'screeningId');
      if (!screeningIdValidation.data) {
        sendValidationError(res, screeningIdValidation.issues);
        return;
      }

      const requestValidation = validateContentReviewRequest(req.body);
      if (!requestValidation.data) {
        sendValidationError(res, requestValidation.issues);
        return;
      }

      const service = getContentScreeningService();
      const result = await service.reviewContent(
        screeningIdValidation.data,
        requestValidation.data.reviewedBy,
        requestValidation.data.approved,
        requestValidation.data.reviewNotes,
        requestValidation.data.actionTaken
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/content/pending', async (req: Request, res: Response) => {
    try {
      const tenantValidation = validateTenantHeader(req);
      if (!tenantValidation.data) {
        sendValidationError(res, tenantValidation.issues);
        return;
      }

      const limitValidation = validatePaginationLimit(req);
      if (limitValidation.data === undefined) {
        sendValidationError(res, limitValidation.issues);
        return;
      }

      const service = getContentScreeningService();
      const pending = await service.getPendingReviews(tenantValidation.data, limitValidation.data);

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Risk Assessment endpoints
  app.post('/api/v1/risk/assess', async (req: Request, res: Response) => {
    try {
      const validation = validateRiskAssessRequest(req.body);
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getNFTRiskAssessmentService();
      const result = await service.assessTransaction(validation.data);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/risk/assessment/:assessmentId', async (req: Request, res: Response) => {
    try {
      const validation = validateRequiredIdParam(req.params['assessmentId'], 'assessmentId');
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getNFTRiskAssessmentService();
      const assessment = await service.getAssessment(validation.data);

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/v1/risk/review/:assessmentId', async (req: Request, res: Response) => {
    try {
      const assessmentIdValidation = validateRequiredIdParam(req.params['assessmentId'], 'assessmentId');
      if (!assessmentIdValidation.data) {
        sendValidationError(res, assessmentIdValidation.issues);
        return;
      }

      const validation = validateRiskReviewRequest(req.body);
      if (!validation.data) {
        sendValidationError(res, validation.issues);
        return;
      }

      const service = getNFTRiskAssessmentService();
      const result = await service.reviewAssessment(
        assessmentIdValidation.data,
        validation.data.reviewedBy,
        validation.data.approved,
        validation.data.reviewNotes,
        validation.data.overrideReason,
        validation.data.newRiskLevel
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/v1/risk/pending', async (req: Request, res: Response) => {
    try {
      const tenantValidation = validateTenantHeader(req);
      if (!tenantValidation.data) {
        sendValidationError(res, tenantValidation.issues);
        return;
      }

      const limitValidation = validatePaginationLimit(req);
      if (limitValidation.data === undefined) {
        sendValidationError(res, limitValidation.issues);
        return;
      }

      const service = getNFTRiskAssessmentService();
      const pending = await service.getPendingReviews(tenantValidation.data, limitValidation.data);

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Travel Rule endpoints
  if (config.travelRule.enabled) {
    app.post('/api/v1/travel-rule/create', async (req: Request, res: Response) => {
      try {
        const validation = validateTravelRuleCreateRequest(req.body);
        if (!validation.data) {
          sendValidationError(res, validation.issues);
          return;
        }

        const service = getNFTTravelRuleService();
        const result = await service.createTravelRuleMessage(validation.data);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.post('/api/v1/travel-rule/send/:travelRuleId', async (req: Request, res: Response) => {
      try {
        const validation = validateRequiredIdParam(req.params['travelRuleId'], 'travelRuleId');
        if (!validation.data) {
          sendValidationError(res, validation.issues);
          return;
        }

        const service = getNFTTravelRuleService();
        await service.sendTravelRuleMessage(validation.data);

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/travel-rule/:travelRuleId', async (req: Request, res: Response) => {
      try {
        const validation = validateRequiredIdParam(req.params['travelRuleId'], 'travelRuleId');
        if (!validation.data) {
          sendValidationError(res, validation.issues);
          return;
        }

        const service = getNFTTravelRuleService();
        const message = await service.getTravelRuleMessage(validation.data);

        if (!message) {
          res.status(404).json({ error: 'Travel Rule message not found' });
          return;
        }

        res.json(message);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/travel-rule/pending', async (req: Request, res: Response) => {
      try {
        const tenantValidation = validateTenantHeader(req);
        if (!tenantValidation.data) {
          sendValidationError(res, tenantValidation.issues);
          return;
        }

        const limitValidation = validatePaginationLimit(req);
        if (limitValidation.data === undefined) {
          sendValidationError(res, limitValidation.issues);
          return;
        }

        const service = getNFTTravelRuleService();
        const pending = await service.getPendingMessages(tenantValidation.data, limitValidation.data);

        res.json(pending);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  // CARF endpoints
  if (config.carf.enabled) {
    app.post('/api/v1/carf/generate', async (req: Request, res: Response) => {
      try {
        const validation = validateCarfGenerateRequest(req.body);
        if (!validation.data) {
          sendValidationError(res, validation.issues);
          return;
        }

        const service = getNFTCARFService();
        const result = await service.generateReport(validation.data);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/carf/report/:reportId', async (req: Request, res: Response) => {
      try {
        const validation = validateRequiredIdParam(req.params['reportId'], 'reportId');
        if (!validation.data) {
          sendValidationError(res, validation.issues);
          return;
        }

        const service = getNFTCARFService();
        const report = await service.getReport(validation.data);

        if (!report) {
          res.status(404).json({ error: 'Report not found' });
          return;
        }

        res.json(report);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.post('/api/v1/carf/submit/:reportId', async (req: Request, res: Response) => {
      try {
        const reportIdValidation = validateRequiredIdParam(req.params['reportId'], 'reportId');
        if (!reportIdValidation.data) {
          sendValidationError(res, reportIdValidation.issues);
          return;
        }

        const bodyValidation = validateCarfSubmitRequest(req.body);
        if (!bodyValidation.data) {
          sendValidationError(res, bodyValidation.issues);
          return;
        }

        const service = getNFTCARFService();
        const result = await service.submitReport(reportIdValidation.data, bodyValidation.data.submittedTo);

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    app.get('/api/v1/carf/wallet/:walletAddress', async (req: Request, res: Response) => {
      try {
        const issues: ValidationIssue[] = [];
        const walletAddress = parseRequiredString(req.params['walletAddress'], 'walletAddress', issues);
        const tenantId = parseRequiredString(req.headers['x-tenant-id'], 'x-tenant-id', issues);

        if (!walletAddress || !tenantId || issues.length > 0) {
          sendValidationError(res, issues);
          return;
        }

        const service = getNFTCARFService();
        const reports = await service.getWalletReports(walletAddress, tenantId);

        res.json(reports);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }
}

/**
 * Get service health status
 */
async function getServiceHealth(): Promise<ServiceHealth> {
  const config = getConfig();
  const db = getDatabaseService();
  const producer = getEventProducer();
  const consumer = getEventConsumer();

  const [dbHealth, metrics, redisHealth, blockchainHealth] = await Promise.all([
    db.healthCheck(),
    getComplianceMetrics(),
    getRedisHealth(),
    getBlockchainHealth(),
  ]);

  const memUsage = process.memoryUsage();
  const producerHealthy = producer.isHealthy();
  const consumerHealthy = consumer.isHealthy();
  const kafkaHealthy = producerHealthy && consumerHealthy;
  const blockchainHealthy = blockchainHealth.every((chain) => chain.status === 'connected');
  const dependencyHealthy = dbHealth.healthy && kafkaHealthy && redisHealth.status === 'connected' && blockchainHealthy;
  const dependencyDegraded = !dependencyHealthy && (dbHealth.healthy || kafkaHealthy || redisHealth.status === 'connected' || blockchainHealth.some((chain) => chain.status === 'connected'));

  return {
    status: dependencyHealthy ? 'healthy' : dependencyDegraded ? 'degraded' : 'unhealthy',
    timestamp: new Date(),
    version: config.version,
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    database: {
      status: dbHealth.healthy ? 'connected' : 'disconnected',
      latency: dbHealth.latency,
    },
    redis: {
      status: redisHealth.status === 'connected' ? 'connected' : 'disconnected',
      latency: redisHealth.latency,
    },
    kafka: {
      status: kafkaHealthy ? 'connected' : 'disconnected',
      topics: Object.values(NFT_COMPLIANCE_TOPICS),
    },
    blockchain: {
      status: blockchainHealth.every((chain) => chain.status === 'connected') ? 'connected' : blockchainHealth.some((chain) => chain.status === 'connected') ? 'degraded' : 'disconnected',
      chains: blockchainHealth.map((chain) => ({
        chainId: chain.chainId,
        name: chain.name,
        blockNumber: chain.blockNumber ?? 0,
        latency: chain.latency,
      })),
    },
    compliance: metrics,
  };
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  appLogger.info('Initializing services...');

  // Connect to database
  const db = getDatabaseService();
  await db.connect();

  // Connect to Kafka producer
  const producer = getEventProducer();
  await producer.connect();

  // Connect to Kafka consumer
  const consumer = getEventConsumer();
  await consumer.connect();

  // Subscribe to NFT events
  await subscribeToNFTEvents(consumer);

  // Register event handlers
  registerEventHandlers(consumer);

  // Start consuming
  await consumer.start();

  appLogger.info('Services initialized successfully');
}

/**
 * Register event handlers
 */
function registerEventHandlers(consumer: ReturnType<typeof getEventConsumer>): void {
  // Handle NFT sale events
  consumer.registerHandler('nft.sale.created', async (event) => {
    const payload = event.payload as {
      saleId: string;
      transactionHash: string;
      contractAddress: string;
      tokenId: string;
      chainId: number;
      sellerAddress: string;
      buyerAddress: string;
      price: string;
      priceUSD: string;
      marketplace: string;
      userId?: string;
    };

    appLogger.info('Processing NFT sale event', {
      saleId: payload.saleId,
      contractAddress: payload.contractAddress,
    });

    // Assess risk
    const riskService = getNFTRiskAssessmentService();
    const riskInput: any = {
      transactionId: payload.saleId,
      transactionHash: payload.transactionHash,
      contractAddress: payload.contractAddress,
      tokenId: payload.tokenId,
      chainId: payload.chainId,
      sellerAddress: payload.sellerAddress,
      buyerAddress: payload.buyerAddress,
      price: payload.price,
      priceUSD: payload.priceUSD,
      marketplace: payload.marketplace,
      tenantId: event.tenantId,
    };

    if (payload.userId) riskInput.userId = payload.userId;
    if (event.brokerId) riskInput.brokerId = event.brokerId;

    await riskService.assessTransaction(riskInput);

    // Check Travel Rule
    const travelRuleService = getNFTTravelRuleService();
    const priceUSD = parseFloat(payload.priceUSD);
    if (travelRuleService.isTravelRuleRequired(priceUSD)) {
      const travelInput: any = {
        saleId: payload.saleId,
        contractAddress: payload.contractAddress,
        tokenId: payload.tokenId,
        chainId: payload.chainId,
        sellerAddress: payload.sellerAddress,
        buyerAddress: payload.buyerAddress,
        price: payload.price,
        priceUSD: payload.priceUSD,
        currency: 'USD',
        timestamp: new Date(),
        tenantId: event.tenantId,
      };

      if (event.brokerId) travelInput.brokerId = event.brokerId;
      if (payload.userId) travelInput.userId = payload.userId;

      await travelRuleService.createTravelRuleMessage(travelInput);
    }
  });

  // Handle NFT token minted events
  consumer.registerHandler('nft.token.minted', async (event) => {
    const payload = event.payload as {
      tokenId: string;
      contractAddress: string;
      chainId: number;
      tokenUri: string;
    };

    appLogger.info('Processing NFT mint event', {
      tokenId: payload.tokenId,
      contractAddress: payload.contractAddress,
    });

    // Screen content
    const contentService = getContentScreeningService();
    await contentService.screenContent(
      payload.contractAddress,
      payload.tokenId,
      payload.chainId,
      payload.tokenUri,
      'image', // Default to image, would detect from URI
      event.tenantId
    );
  });
}

/**
 * Shutdown services
 */
async function shutdownServices(): Promise<void> {
  appLogger.info('Shutting down services...');

  const consumer = getEventConsumer();
  await consumer.disconnect();

  const producer = getEventProducer();
  await producer.disconnect();

  const db = getDatabaseService();
  await db.disconnect();

  appLogger.info('Services shut down successfully');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const config = getConfig();

  // Validate configuration
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    appLogger.error('Configuration validation failed', { errors: configErrors });
    process.exit(1);
  }

  appLogger.info('Starting NFT Compliance Service', {
    version: config.version,
    environment: config.environment,
  });

  try {
    // Initialize services
    await initializeServices();

    // Create and start Express app
    const app = createApp();
    const server = app.listen(config.port, () => {
      appLogger.info(`NFT Compliance Service listening on port ${config.port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      appLogger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        await shutdownServices();
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        appLogger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    appLogger.error('Failed to start NFT Compliance Service', error as Error);
    process.exit(1);
  }
}

// Start the service
main();
