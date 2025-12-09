/**
 * Financial Reporting Service
 *
 * Complete implementation matching original financial-svc
 * Generates:
 * - Balance Sheet
 * - Income Statement
 * - Trial Balance
 */
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
export declare class FinancialReportingService {
    private repository;
    constructor();
    /**
     * Generate balance sheet
     */
    generateBalanceSheet(tenantId: string, asOfDate: Date, generatedBy: string): Promise<FinancialReport>;
    /**
     * Generate income statement
     */
    generateIncomeStatement(tenantId: string, startDate: Date, endDate: Date, generatedBy: string): Promise<FinancialReport>;
    /**
     * Generate trial balance
     */
    generateTrialBalance(tenantId: string, asOfDate: Date, generatedBy: string): Promise<FinancialReport>;
    /**
     * Get report by ID
     */
    getReport(reportId: string): Promise<FinancialReport | null>;
    /**
     * List reports
     */
    listReports(tenantId: string, reportType?: string, limit?: number, offset?: number): Promise<FinancialReport[]>;
    /**
     * Store report
     */
    private storeReport;
    /**
     * Update report
     */
    private updateReport;
}
export {};
//# sourceMappingURL=financial-reporting.d.ts.map