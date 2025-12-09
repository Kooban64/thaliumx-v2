/**
 * Reporting Controller
 *
 * Complete implementation matching original financial-svc
 */
import { Request, Response } from 'express';
export declare class ReportingController {
    private reportingService;
    constructor();
    /**
     * Generate balance sheet
     */
    generateBalanceSheet(req: Request, res: Response): Promise<void>;
    /**
     * Generate income statement
     */
    generateIncomeStatement(req: Request, res: Response): Promise<void>;
    /**
     * Generate trial balance
     */
    generateTrialBalance(req: Request, res: Response): Promise<void>;
    /**
     * Get report by ID
     */
    getReport(req: Request, res: Response): Promise<void>;
    /**
     * List reports
     */
    listReports(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=reporting-controller.d.ts.map