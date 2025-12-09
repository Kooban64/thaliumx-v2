/**
 * Reconciliation Controller
 *
 * Complete implementation matching original financial-svc
 *
 * Features:
 * - Daily reconciliation with transaction matching
 * - Date range reconciliation
 * - External transaction source management
 * - Configuration management per tenant
 * - Discrepancy detection and reporting
 */
import { Request, Response } from 'express';
export declare class ReconciliationController {
    private reconciliationJob;
    private repository;
    constructor();
    /**
     * Run daily reconciliation - reconciles today's transactions
     */
    runDailyReconciliation(req: Request, res: Response): Promise<void>;
    /**
     * Run reconciliation for date range
     */
    runReconciliation(req: Request, res: Response): Promise<void>;
    /**
     * Fetch external transactions from configured sources
     */
    fetchExternalTransactions(req: Request, res: Response): Promise<void>;
    /**
     * Get reconciliation configuration for tenant
     */
    getReconciliationConfig(req: Request, res: Response): Promise<void>;
    /**
     * Update reconciliation configuration
     */
    updateReconciliationConfig(req: Request, res: Response): Promise<void>;
    /**
     * Add external transaction source
     */
    addExternalTransactionSource(req: Request, res: Response): Promise<void>;
    /**
     * Get external transaction sources for tenant
     */
    getExternalTransactionSources(req: Request, res: Response): Promise<void>;
    /**
     * Update external transaction source
     */
    updateExternalTransactionSource(req: Request, res: Response): Promise<void>;
    /**
     * Delete external transaction source
     */
    deleteExternalTransactionSource(req: Request, res: Response): Promise<void>;
    /**
     * Get reconciliation reports for tenant
     */
    getReconciliationReports(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=reconciliation-controller.d.ts.map