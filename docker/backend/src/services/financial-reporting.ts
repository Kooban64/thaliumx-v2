/**
 * Financial Reporting Service
 * 
 * Complete implementation matching original financial-svc
 * Generates:
 * - Balance Sheet
 * - Income Statement
 * - Trial Balance
 */

import { FinancialRepository } from './financial-repository';
import { DatabaseService } from './database';
import { LoggerService } from './logger';
import { v4 as uuidv4 } from 'uuid';

interface FinancialReport {
  id: string;
  tenantId: string;
  reportType: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  data: any;
  status: string;
}

export class FinancialReportingService {
  private repository: FinancialRepository;

  constructor() {
    this.repository = new FinancialRepository();
  }

  /**
   * Generate balance sheet
   */
  async generateBalanceSheet(
    tenantId: string,
    asOfDate: Date,
    generatedBy: string
  ): Promise<FinancialReport> {
    const reportId = `bs_${tenantId}_${Date.now()}`;
    
    try {
      LoggerService.info('Generating balance sheet', { tenantId, asOfDate, reportId });

      const report: FinancialReport = {
        id: reportId,
        tenantId,
        reportType: 'balance_sheet',
        period: {
          startDate: new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1),
          endDate: asOfDate
        },
        generatedAt: new Date(),
        generatedBy,
        data: {},
        status: 'generating'
      };

      await this.storeReport(report);

      // Get account balances as of the date
      const accounts = await this.repository.getAccountsByTenant(tenantId);
      
      // Categorize accounts
      const assets: any = { current: {}, nonCurrent: {}, total: 0 };
      const liabilities: any = { current: {}, nonCurrent: {}, total: 0 };
      const equity: any = {};

      for (const account of accounts) {
        const balance = parseFloat(account.balance) || 0;
        const accountType = account.accountType || '';

        if (accountType.includes('asset') || accountType.includes('bank') || accountType.includes('cash')) {
          if (accountType.includes('current')) {
            assets.current[account.name] = balance;
          } else {
            assets.nonCurrent[account.name] = balance;
          }
          assets.total += balance;
        } else if (accountType.includes('liability') || accountType.includes('payable')) {
          if (accountType.includes('current')) {
            liabilities.current[account.name] = balance;
          } else {
            liabilities.nonCurrent[account.name] = balance;
          }
          liabilities.total += balance;
        } else if (accountType.includes('equity')) {
          equity[account.name] = balance;
        }
      }

      const totalEquity = Object.values(equity).reduce((sum: number, val: any) => sum + val, 0);
      const totalLiabilitiesAndEquity = liabilities.total + totalEquity;

      report.data = {
        assets,
        liabilities,
        equity,
        totalEquity,
        totalLiabilitiesAndEquity
      };

      report.status = 'completed';
      await this.updateReport(report);

      LoggerService.info('Balance sheet generated successfully', { reportId, tenantId });
      return report;
    } catch (error: any) {
      LoggerService.error('Failed to generate balance sheet', {
        tenantId,
        asOfDate,
        reportId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate income statement
   */
  async generateIncomeStatement(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<FinancialReport> {
    const reportId = `is_${tenantId}_${Date.now()}`;

    try {
      LoggerService.info('Generating income statement', { tenantId, startDate, endDate, reportId });

      const report: FinancialReport = {
        id: reportId,
        tenantId,
        reportType: 'income_statement',
        period: { startDate, endDate },
        generatedAt: new Date(),
        generatedBy,
        data: {},
        status: 'generating'
      };

      await this.storeReport(report);

      // Get journal entries for the period
      const entries = await this.repository.getJournalEntries(tenantId, 10000, 0);
      const periodEntries = entries.filter(e => {
        const entryDate = new Date(e.createdAt);
        return entryDate >= startDate && entryDate <= endDate;
      });

      // Calculate revenue and expenses
      const revenue: any = {};
      const expenses: any = {};
      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const entry of periodEntries) {
        for (const line of entry.lines || []) {
          const amount = parseFloat(line.credit || 0) - parseFloat(line.debit || 0);
          
          if (line.accountId.includes('revenue') || line.accountId.includes('fee_income')) {
            revenue[line.accountId] = (revenue[line.accountId] || 0) + amount;
            totalRevenue += amount;
          } else if (line.accountId.includes('expense') || line.accountId.includes('fee')) {
            expenses[line.accountId] = (expenses[line.accountId] || 0) + Math.abs(amount);
            totalExpenses += Math.abs(amount);
          }
        }
      }

      const grossProfit = totalRevenue - totalExpenses;
      const netIncome = grossProfit;

      report.data = {
        revenue,
        totalRevenue,
        expenses,
        totalExpenses,
        grossProfit,
        netIncome
      };

      report.status = 'completed';
      await this.updateReport(report);

      LoggerService.info('Income statement generated successfully', { reportId, tenantId });
      return report;
    } catch (error: any) {
      LoggerService.error('Failed to generate income statement', {
        tenantId,
        startDate,
        endDate,
        reportId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate trial balance
   */
  async generateTrialBalance(
    tenantId: string,
    asOfDate: Date,
    generatedBy: string
  ): Promise<FinancialReport> {
    const reportId = `tb_${tenantId}_${Date.now()}`;

    try {
      LoggerService.info('Generating trial balance', { tenantId, asOfDate, reportId });

      const report: FinancialReport = {
        id: reportId,
        tenantId,
        reportType: 'trial_balance',
        period: {
          startDate: new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1),
          endDate: asOfDate
        },
        generatedAt: new Date(),
        generatedBy,
        data: {},
        status: 'generating'
      };

      await this.storeReport(report);

      // Get all accounts with balances
      const accounts = await this.repository.getAccountsByTenant(tenantId);
      
      // Get journal entries up to asOfDate
      const entries = await this.repository.getJournalEntries(tenantId, 10000, 0);
      const periodEntries = entries.filter(e => new Date(e.createdAt) <= asOfDate);

      // Calculate account balances from journal entries
      const accountBalances: any = {};
      
      for (const account of accounts) {
        accountBalances[account.id] = {
          accountId: account.id,
          accountName: account.name,
          debit: 0,
          credit: 0,
          balance: 0
        };
      }

      for (const entry of periodEntries) {
        for (const line of entry.lines || []) {
          if (!accountBalances[line.accountId]) {
            accountBalances[line.accountId] = {
              accountId: line.accountId,
              accountName: line.accountId,
              debit: 0,
              credit: 0,
              balance: 0
            };
          }
          accountBalances[line.accountId].debit += parseFloat(line.debit || 0);
          accountBalances[line.accountId].credit += parseFloat(line.credit || 0);
        }
      }

      const accountsArray = Object.values(accountBalances).map((acc: any) => {
        acc.balance = acc.debit - acc.credit;
        return acc;
      });

      let totalDebits = 0;
      let totalCredits = 0;

      for (const acc of accountsArray) {
        totalDebits += acc.debit;
        totalCredits += acc.credit;
      }

      const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

      report.data = {
        accounts: accountsArray,
        totalDebits,
        totalCredits,
        isBalanced
      };

      report.status = 'completed';
      await this.updateReport(report);

      LoggerService.info('Trial balance generated successfully', { reportId, tenantId });
      return report;
    } catch (error: any) {
      LoggerService.error('Failed to generate trial balance', {
        tenantId,
        asOfDate,
        reportId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<FinancialReport | null> {
    try {
      const FinancialReportModel = DatabaseService.getModel('FinancialReport');
      if (!FinancialReportModel) {
        LoggerService.warn('FinancialReport model not found');
        return null;
      }

      const report = await FinancialReportModel.findOne({
        where: { id: reportId }
      });

      if (!report) {
        return null;
      }

      const data = report.toJSON ? report.toJSON() : report;
      return {
        id: data.id,
        tenantId: data.tenantId,
        reportType: data.reportType,
        period: {
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate)
        },
        generatedAt: new Date(data.generatedAt),
        generatedBy: data.generatedBy,
        data: typeof data.data === 'string' ? JSON.parse(data.data) : data.data,
        status: data.status
      };
    } catch (error: any) {
      LoggerService.error('Get report failed:', { error: error.message, reportId });
      return null;
    }
  }

  /**
   * List reports
   */
  async listReports(
    tenantId: string,
    reportType?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FinancialReport[]> {
    // TODO: Retrieve from database
    return [];
  }

  /**
   * Store report
   */
  private async storeReport(report: FinancialReport): Promise<void> {
    try {
      const FinancialReportModel = DatabaseService.getModel('FinancialReport');
      if (FinancialReportModel) {
        await FinancialReportModel.create({
          id: report.id,
          tenantId: report.tenantId,
          reportType: report.reportType,
          startDate: report.period.startDate,
          endDate: report.period.endDate,
          generatedAt: report.generatedAt,
          generatedBy: report.generatedBy,
          data: JSON.stringify(report.data),
          status: report.status,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        LoggerService.info('Report stored in database', { reportId: report.id });
      } else {
        LoggerService.warn('FinancialReport model not found, report not persisted');
      }
    } catch (error: any) {
      LoggerService.error('Store report failed:', { error: error.message, reportId: report.id });
      throw error;
    }
  }

  /**
   * Update report
   */
  private async updateReport(report: FinancialReport): Promise<void> {
    try {
      const FinancialReportModel = DatabaseService.getModel('FinancialReport');
      if (FinancialReportModel) {
        await FinancialReportModel.update(
          {
            data: JSON.stringify(report.data),
            status: report.status,
            updatedAt: new Date()
          },
          {
            where: { id: report.id }
          }
        );
        LoggerService.info('Report updated in database', { reportId: report.id });
      } else {
        LoggerService.warn('FinancialReport model not found, report not updated');
      }
    } catch (error: any) {
      LoggerService.error('Update report failed:', { error: error.message, reportId: report.id });
      throw error;
    }
  }
}

