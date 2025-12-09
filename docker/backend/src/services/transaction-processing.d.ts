/**
 * Transaction Processing Service
 *
 * Core service for processing financial transactions with comprehensive validation and security.
 *
 * Features:
 * - Distributed locking using Redis to prevent double-spend and race conditions
 * - Transaction limits validation (daily, monthly, per-user limits)
 * - Fraud detection with scoring algorithm
 * - Dual authorization for high-value transactions
 * - Journal entry creation with double-entry bookkeeping
 * - Compliance checks using OPA (Open Policy Agent)
 * - Idempotency support to prevent duplicate transactions
 * - Comprehensive audit logging
 *
 * Transaction Flow:
 * 1. Acquire distributed lock (prevents concurrent processing)
 * 2. Validate transaction limits (daily/monthly/user limits)
 * 3. Calculate fraud score (amount, frequency, location, etc.)
 * 4. Check compliance rules (OPA policy evaluation)
 * 5. Validate fund segregation rules
 * 6. Check if dual authorization required
 * 7. Execute transaction (create journal entries)
 * 8. Emit events and log audit trail
 *
 * Security:
 * - All transactions logged for audit compliance
 * - Failed transactions logged with reasons
 * - Fraud scores tracked and monitored
 * - High-value transactions require additional approval
 *
 * Error Handling:
 * - Graceful degradation if Redis unavailable (continues without locks)
 * - Comprehensive error messages for debugging
 * - Transaction rollback on failures
 */
interface TransactionRequest {
    id?: string;
    tenantId: string;
    userId: string;
    userRole?: string;
    type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'interest' | 'adjustment';
    amount: number;
    currency: string;
    sourceAccountId?: string;
    targetAccountId?: string;
    description?: string;
    idempotencyKey?: string;
    metadata?: any;
    ipAddress?: string;
    location?: string;
}
interface TransactionResult {
    transactionId: string;
    status: 'approved' | 'rejected' | 'requires_approval' | 'pending';
    journalEntryId?: string;
    fraudScore?: number;
    approvalId?: string;
    reason?: string;
    timestamp: Date;
}
export declare class TransactionProcessingService {
    private repository;
    private redis;
    constructor();
    /**
     * Process a transaction request
     */
    processTransaction(request: TransactionRequest): Promise<TransactionResult>;
    /**
     * Execute the actual transaction (create journal entry)
     */
    private executeTransaction;
    /**
     * Build journal entry lines based on transaction type
     */
    private buildJournalLines;
    /**
     * Check transaction limits
     */
    private checkTransactionLimits;
    /**
     * Calculate fraud score (simplified implementation)
     */
    private calculateFraudScore;
    /**
     * Check if dual authorization is required
     */
    private requiresDualAuth;
    /**
     * Store pending transaction for approval
     */
    private storePendingTransaction;
    /**
     * Store transaction record
     */
    private storeTransaction;
    /**
     * Approve a transaction that requires dual authorization
     */
    approveTransaction(transactionId: string, approverId: string, approverRole: string, mfaVerified: boolean, ipAddress: string): Promise<TransactionResult>;
    /**
     * Reject a transaction
     */
    rejectTransaction(transactionId: string, rejectedBy: string, reason: string): Promise<void>;
    /**
     * Get transaction status
     */
    getTransactionStatus(transactionId: string): Promise<any>;
    /**
     * Acquire Redis lock
     */
    private tryAcquireLock;
    /**
     * Release Redis lock
     */
    private releaseLock;
}
export {};
//# sourceMappingURL=transaction-processing.d.ts.map