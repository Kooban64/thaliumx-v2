/**
 * Reporting Controller
 * 
 * Complete implementation matching original financial-svc
 */

import { Request, Response } from 'express';
import { FinancialReportingService } from '../services/financial-reporting';
import { LoggerService } from '../services/logger';

export class ReportingController {
  private reportingService: FinancialReportingService;

  constructor() {
    this.reportingService = new FinancialReportingService();
  }

  /**
   * Generate balance sheet
   */
  async generateBalanceSheet(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.params.tenantId;
      if (!tenantId) {
        res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { asOfDate } = req.body;

      if (!asOfDate) {
        res.status(400).json({
          message: 'asOfDate is required',
          code: 'MISSING_DATE'
        });
        return;
      }

      const userId = (req.user as any)?.id || 'system';
      const report = await this.reportingService.generateBalanceSheet(
        tenantId,
        new Date(asOfDate),
        userId
      );

      res.status(201).json({
        message: 'Balance sheet generated successfully',
        report
      });
    } catch (error: any) {
      LoggerService.error('Failed to generate balance sheet', { error: error.message });
      res.status(500).json({
        message: 'Failed to generate balance sheet',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Generate income statement
   */
  async generateIncomeStatement(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.params.tenantId;
      if (!tenantId) {
        res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        res.status(400).json({
          message: 'startDate and endDate are required',
          code: 'MISSING_DATES'
        });
        return;
      }

      const userId = (req.user as any)?.id || 'system';
      const report = await this.reportingService.generateIncomeStatement(
        tenantId,
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.status(201).json({
        message: 'Income statement generated successfully',
        report
      });
    } catch (error: any) {
      LoggerService.error('Failed to generate income statement', { error: error.message });
      res.status(500).json({
        message: 'Failed to generate income statement',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Generate trial balance
   */
  async generateTrialBalance(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.params.tenantId;
      if (!tenantId) {
        res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { asOfDate } = req.body;

      if (!asOfDate) {
        res.status(400).json({
          message: 'asOfDate is required',
          code: 'MISSING_DATE'
        });
        return;
      }

      const userId = (req.user as any)?.id || 'system';
      const report = await this.reportingService.generateTrialBalance(
        tenantId,
        new Date(asOfDate),
        userId
      );

      res.status(201).json({
        message: 'Trial balance generated successfully',
        report
      });
    } catch (error: any) {
      LoggerService.error('Failed to generate trial balance', { error: error.message });
      res.status(500).json({
        message: 'Failed to generate trial balance',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Get report by ID
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = req.params.reportId;
      if (!reportId) {
        res.status(400).json({ message: 'reportId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const report = await this.reportingService.getReport(reportId);

      if (!report) {
        res.status(404).json({
          message: 'Report not found',
          code: 'NOT_FOUND'
        });
        return;
      }

      res.json(report);
    } catch (error: any) {
      LoggerService.error('Failed to get report', { error: error.message });
      res.status(500).json({
        message: 'Failed to get report',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * List reports
   */
  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.params.tenantId;
      if (!tenantId) {
        res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { reportType, limit = '50', offset = '0' } = req.query;

      const reports = await this.reportingService.listReports(
        tenantId,
        reportType as string | undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        reports,
        total: reports.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error: any) {
      LoggerService.error('Failed to list reports', { error: error.message });
      res.status(500).json({
        message: 'Failed to list reports',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }
}

