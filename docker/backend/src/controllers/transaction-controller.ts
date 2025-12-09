/**
 * Transaction Controller
 * 
 * Complete implementation matching original financial-svc
 */

import { Request, Response } from 'express';
import { TransactionProcessingService } from '../services/transaction-processing';
import { LoggerService } from '../services/logger';

export class TransactionController {
  private transactionService: TransactionProcessingService;

  constructor() {
    this.transactionService = new TransactionProcessingService();
  }

  /**
   * Process a transaction
   */
  async processTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;
      const transactionRequest = {
        ...req.body,
        tenantId,
        userId: (req as any).userId || (req.user as any)?.id,
        userRole: (req.user as any)?.role || 'user',
        ipAddress: req.ip,
        metadata: {
          ...req.body.metadata,
          userAgent: req.get('User-Agent'),
          sessionId: (req as any).sessionId
        }
      };

      const result = await this.transactionService.processTransaction(transactionRequest);
      res.status(201).json({
        message: 'Transaction processed',
        result
      });
    } catch (error: any) {
      LoggerService.error('Failed to process transaction', { error: error.message });
      res.status(500).json({
        message: 'Failed to process transaction',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Approve a transaction
   */
  async approveTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = req.params.transactionId;
      if (!transactionId) {
        res.status(400).json({ message: 'transactionId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { mfaVerified } = req.body;
      const userId = (req as any).userId || (req.user as any)?.id || 'system';
      const userRole = (req.user as any)?.role || 'user';
      const ip = req.ip || 'unknown';

      const result = await this.transactionService.approveTransaction(
        transactionId,
        userId,
        userRole,
        mfaVerified || false,
        ip
      );

      res.json({
        message: 'Transaction approval processed',
        result
      });
    } catch (error: any) {
      LoggerService.error('Failed to approve transaction', { error: error.message });
      res.status(500).json({
        message: 'Failed to approve transaction',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Reject a transaction
   */
  async rejectTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = req.params.transactionId;
      if (!transactionId) {
        res.status(400).json({ message: 'transactionId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          message: 'Reason is required',
          code: 'MISSING_REASON'
        });
        return;
      }

      const userId = (req as any).userId || (req.user as any)?.id || 'system';
      await this.transactionService.rejectTransaction(transactionId, userId, reason);

      res.json({
        message: 'Transaction rejected successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to reject transaction', { error: error.message });
      res.status(500).json({
        message: 'Failed to reject transaction',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = req.params.transactionId;
      if (!transactionId) {
        res.status(400).json({ message: 'transactionId is required', code: 'INVALID_REQUEST' });
        return;
      }
      const status = await this.transactionService.getTransactionStatus(transactionId);
      res.json(status);
    } catch (error: any) {
      LoggerService.error('Failed to get transaction status', { error: error.message });
      res.status(500).json({
        message: 'Failed to get transaction status',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }
}

