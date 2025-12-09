/**
 * Financial Controller
 *
 * Complete implementation matching original financial-svc controller
 * Handles all HTTP request/response for financial operations
 */
import { Request, Response } from 'express';
import { FinancialRepository } from '../services/financial-repository';
export declare class FinancialController {
    private repository;
    constructor(repository: FinancialRepository);
    createJournalEntry(req: Request, res: Response): Promise<void>;
    getJournalEntries(req: Request, res: Response): Promise<void>;
    getJournalEntry(req: Request, res: Response): Promise<void>;
    getBalances(req: Request, res: Response): Promise<void>;
    getAccountBalance(req: Request, res: Response): Promise<void>;
    getAvailableBalance(req: Request, res: Response): Promise<void>;
    createHold(req: Request, res: Response): Promise<void>;
    getHolds(req: Request, res: Response): Promise<void>;
    releaseHold(req: Request, res: Response): Promise<void>;
    createClient(req: Request, res: Response): Promise<void>;
    getClient(req: Request, res: Response): Promise<void>;
    getClientsByTenant(req: Request, res: Response): Promise<void>;
    updateClientKycStatus(req: Request, res: Response): Promise<void>;
    linkClientToAccount(req: Request, res: Response): Promise<void>;
    getClientAccounts(req: Request, res: Response): Promise<void>;
    createSegregationRule(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=financial-controller.d.ts.map