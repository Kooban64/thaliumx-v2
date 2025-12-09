/**
 * Transaction Controller
 *
 * Complete implementation matching original financial-svc
 */
import { Request, Response } from 'express';
export declare class TransactionController {
    private transactionService;
    constructor();
    /**
     * Process a transaction
     */
    processTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Approve a transaction
     */
    approveTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Reject a transaction
     */
    rejectTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Get transaction status
     */
    getTransactionStatus(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=transaction-controller.d.ts.map