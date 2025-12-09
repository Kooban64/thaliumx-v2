/**
 * Nedbank Integration Service
 * - Payouts (PayShap / EFT)
 * - Deposit scraping (pool account statements)
 * - Pool account selection (platform or broker-level)
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import { LoggerService } from './logger';

type NedbankSecrets = {
  payout: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    apiKey?: string;
  };
  deposits: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    apiKey?: string;
  };
};

export interface PayoutRequest {
  brokerId?: string; // optional: if omitted, use platform pool
  poolAccountNumber?: string; // override
  beneficiary: {
    name: string;
    bankAccountNumber: string;
    bankCode?: string; // For EFT
    payshapId?: string; // For PayShap
  };
  amount: string; // FIAT amount
  currency: string; // e.g., ZAR
  reference: string; // appears on beneficiary statement
  metadata?: Record<string, any>;
}

export interface PayoutResponse {
  success: boolean;
  payoutId?: string;
  status?: 'pending' | 'processing' | 'settled' | 'failed';
  message?: string;
  fees?: {
    platformFee: string;
    brokerFee: string;
    totalFees: string;
  };
}

export interface DepositScrapeRequest {
  brokerId?: string; // optional: if omitted, platform pool
  poolAccountNumber?: string; // override
  fromDate?: string;
  toDate?: string;
}

export interface DepositRecord {
  id: string;
  amount: string;
  currency: string;
  reference: string;
  bankReference?: string;
  valueDate: string;
  description?: string;
}

export class NedbankService {
  private static payoutClient: AxiosInstance;
  private static depositsClient: AxiosInstance;
  private static isInit = false;

  public static async initialize(): Promise<void> {
    if (this.isInit) return;
    // Read secrets
    const secretsPath = path.resolve(process.env.NEDBANK_SECRETS_PATH || '/home/ubuntu/thaliumx-clean/.secrets/nedbank.json');
    const raw = fs.readFileSync(secretsPath, 'utf8');
    const secrets: NedbankSecrets = JSON.parse(raw);

    this.payoutClient = axios.create({
      baseURL: secrets.payout.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': secrets.payout.apiKey || ''
      },
      auth: {
        username: secrets.payout.clientId,
        password: secrets.payout.clientSecret
      }
    });

    this.depositsClient = axios.create({
      baseURL: secrets.deposits.baseUrl,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': secrets.deposits.apiKey || ''
      },
      auth: {
        username: secrets.deposits.clientId,
        password: secrets.deposits.clientSecret
      }
    });

    this.isInit = true;
    LoggerService.info('Nedbank service initialized');
  }

  public static isHealthy(): boolean {
    return this.isInit;
  }

  /**
   * Initiate payout (PayShap preferred if payshapId present, else EFT)
   */
  public static async initiatePayout(req: PayoutRequest): Promise<PayoutResponse> {
    try {
      const payload: any = {
        poolAccountNumber: req.poolAccountNumber,
        brokerId: req.brokerId,
        beneficiary: req.beneficiary,
        amount: req.amount,
        currency: req.currency,
        reference: req.reference,
        metadata: req.metadata
      };

      // Endpoint selection (mocked paths; replace with actual from secrets doc)
      const endpoint = req.beneficiary.payshapId ? '/payouts/payshap' : '/payouts/eft';
      const { data } = await this.payoutClient.post(endpoint, payload);

      // Fee layering example: assume fees returned or compute basic model
      const amountNum = parseFloat(req.amount);
      const platformFee = amountNum * 0.001; // 0.1%
      const brokerFee = amountNum * 0.001;   // 0.1%
      const totalFees = platformFee + brokerFee;

      LoggerService.logTransaction(data.id || 'payout', 'payout_initiated', {
        brokerId: req.brokerId,
        poolAccountNumber: req.poolAccountNumber,
        amount: req.amount,
        currency: req.currency,
        reference: req.reference
      });

      return {
        success: true,
        payoutId: data.id,
        status: data.status || 'pending',
        fees: {
          platformFee: platformFee.toFixed(2),
          brokerFee: brokerFee.toFixed(2),
          totalFees: totalFees.toFixed(2)
        }
      };
    } catch (error: any) {
      LoggerService.error('Nedbank payout failed', { error: error?.message });
      return { success: false, message: error?.message || 'Payout failed' };
    }
  }

  /**
   * Scrape deposits for a pool account within a date range
   */
  public static async scrapeDeposits(req: DepositScrapeRequest): Promise<DepositRecord[]> {
    try {
      const params: any = {
        brokerId: req.brokerId,
        poolAccountNumber: req.poolAccountNumber,
        fromDate: req.fromDate,
        toDate: req.toDate
      };
      const { data } = await this.depositsClient.get('/deposits', { params });

      const results: DepositRecord[] = (data?.deposits || []).map((d: any) => ({
        id: d.id,
        amount: String(d.amount),
        currency: d.currency || 'ZAR',
        reference: d.reference || d.customerReference || '',
        bankReference: d.bankReference,
        valueDate: d.valueDate,
        description: d.description
      }));

      LoggerService.info('Nedbank deposit scrape completed', { count: results.length });
      return results;
    } catch (error: any) {
      LoggerService.error('Nedbank deposit scrape failed', { error: error?.message });
      return [];
    }
  }
}


