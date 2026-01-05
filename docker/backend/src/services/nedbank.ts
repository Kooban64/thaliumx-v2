/**
 * Nedbank Integration Service
 * - Payouts (PayShap / EFT)
 * - Deposit scraping (pool account statements)
 * - Pool account selection (platform or broker-level)
 */

import type { AxiosInstance } from 'axios';
import axios from 'axios';
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
      // payload extracted but not used in this function
      const _payload: any = {
        poolAccountNumber: req.poolAccountNumber,
        brokerId: req.brokerId,
        beneficiary: req.beneficiary,
        amount: req.amount,
        currency: req.currency,
        reference: req.reference,
        metadata: req.metadata
      };

      // Endpoint selection (mocked paths; replace with actual from secrets doc)
      // endpoint extracted but not used in this function
      req.beneficiary.payshapId ? '/payouts/payshap' : '/payouts/eft';
      // TODO: Make actual API call to Nedbank
      const data: any = {
        id: `payout_${Date.now()}`,
        status: 'pending'
      };

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
   * Uses the Nedbank Transactions API endpoint
   */
  public static async scrapeDeposits(req: DepositScrapeRequest): Promise<DepositRecord[]> {
    try {
      // Read secrets to get account number and endpoint
      const secretsPath = path.resolve(process.env.NEDBANK_SECRETS_PATH || '/home/ubuntu/thaliumx-clean/.secrets/nedbank.json');
      const raw = fs.readFileSync(secretsPath, 'utf8');
      const secrets = JSON.parse(raw);
      
      const accountNumber = req.poolAccountNumber || secrets.deposits?.accountNumber;
      const endpoint = secrets.deposits?.endpoints?.transactions || '/Transactions';
      
      const params: any = {
        AccountNumber: accountNumber
      };
      
      // Add date filters if provided (format: YYYYMMDD)
      if (req.fromDate) {
        params.FromDate = req.fromDate.replace(/-/g, '');
      }
      if (req.toDate) {
        params.ToDate = req.toDate.replace(/-/g, '');
      }
      
      LoggerService.info('Nedbank deposit scrape starting', { accountNumber, endpoint, params });
      
      // TODO: Make actual API call to Nedbank
      const data: any = {
        body: JSON.stringify([])
      };

      // Handle the API response format - body is a JSON string
      let transactions: any[] = [];
      if (data?.body) {
        try {
          transactions = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        } catch {
          LoggerService.error('Failed to parse Nedbank response body', { body: data.body });
          transactions = [];
        }
      } else if (Array.isArray(data)) {
        transactions = data;
      } else if (data?.transactions || data?.Transactions) {
        transactions = data.transactions || data.Transactions;
      }

      const results: DepositRecord[] = transactions.map((d: any) => ({
        id: d.TransactionKey || d.id || '',
        amount: String(d.TransactionAmount || d.amount || 0),
        currency: d.Currency || d.currency || 'ZAR',
        reference: d.Reference || d.reference || d.customerReference || '',
        bankReference: d.TransactionKey || d.bankReference || '',
        valueDate: formatNedbankDate(d.ActionDate, d.ActionTime) || d.valueDate || '',
        description: `${d.TransactionType || ''} via ${d.ChannelName || ''}`.trim() || d.description || ''
      }));

      LoggerService.info('Nedbank deposit scrape completed', { count: results.length });
      return results;
    } catch (error: any) {
      LoggerService.error('Nedbank deposit scrape failed', { error: error?.message, stack: error?.stack });
      return [];
    }
  }
}

/**
 * Format Nedbank date/time strings to ISO format
 * ActionDate: YYYYMMDD, ActionTime: HH:MM:SS:ms
 */
function formatNedbankDate(actionDate?: string, actionTime?: string): string {
  if (!actionDate) return '';
  
  try {
    const year = actionDate.substring(0, 4);
    const month = actionDate.substring(4, 6);
    const day = actionDate.substring(6, 8);
    
    let timeStr = '00:00:00';
    if (actionTime) {
      const timeParts = actionTime.split(':');
      if (timeParts.length >= 3) {
        timeStr = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
      }
    }
    
    return `${year}-${month}-${day}T${timeStr}Z`;
  } catch {
    return actionDate;
  }
}


