/**
 * Financial Repository Service
 *
 * Core repository for all financial database operations with double-entry bookkeeping.
 *
 * Features:
 * - Journal entries with strict double-entry validation (debits = credits)
 * - Account management with balance tracking
 * - Fund segregation rules enforcement (client funds vs platform funds)
 * - Hold management (reserving funds for pending transactions)
 * - Client account relationships
 * - Comprehensive audit logging for all financial operations
 * - Transaction safety with Sequelize transactions
 * - Idempotency support to prevent duplicate entries
 *
 * Double-Entry Bookkeeping:
 * - All journal entries must balance (total debits = total credits)
 * - Validation occurs before database commit
 * - Supports multi-currency transactions
 *
 * Fund Segregation:
 * - Validates transfers between client and platform accounts
 * - Enforces segregation rules per tenant
 * - Prevents unauthorized fund mixing
 *
 * Account Operations:
 * - Create and manage financial accounts
 * - Track account balances with Decimal precision
 * - Support for multiple currencies
 * - Account holds for pending operations
 *
 * Audit Trail:
 * - All operations logged with full context
 * - Includes user, IP, session, and operation details
 * - Immutable audit logs for compliance
 *
 * Production Features:
 * - Comprehensive error handling
 * - Transaction rollback on errors
 * - Decimal precision for financial calculations
 * - Thread-safe operations
 */
import { Transaction } from 'sequelize';
interface JournalEntryLine {
    accountId: string;
    debit: number;
    credit: number;
    currency: string;
    description?: string;
}
interface AuditContext {
    clientId?: string;
    brokerId?: string;
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}
interface FundSegregationCheck {
    allowed: boolean;
    reason?: string;
    requiresDualAuth?: boolean;
}
export declare class FinancialRepository {
    private sequelize;
    /**
     * Create journal entry with double-entry bookkeeping validation
     */
    createJournalEntry(tenantId: string, description: string, lines: JournalEntryLine[], idempotencyKey?: string, metadata?: any, context?: AuditContext): Promise<any>;
    /**
     * Get journal entries for tenant
     */
    getJournalEntries(tenantId: string, limit?: number, offset?: number): Promise<any[]>;
    /**
     * Get single journal entry
     */
    getJournalEntry(id: string): Promise<any | null>;
    /**
     * Get journal entry lines (helper)
     */
    private getJournalEntryLines;
    /**
     * Ensure account exists, create if not
     */
    ensureAccountExists(accountId: string, tenantId: string, currency: string, clientId?: string, transaction?: Transaction): Promise<void>;
    /**
     * Get account
     */
    getAccount(accountId: string): Promise<any | null>;
    /**
     * Get accounts by tenant
     */
    getAccountsByTenant(tenantId: string): Promise<any[]>;
    /**
     * Get account balance
     */
    getAccountBalance(accountId: string): Promise<any | null>;
    /**
     * Create hold on account balance
     */
    createHold(tenantId: string, accountId: string, amount: number, currency: string, description?: string, expiresAt?: Date, metadata?: any): Promise<any>;
    /**
     * Release hold
     */
    releaseHold(holdId: string): Promise<void>;
    /**
     * Get holds for tenant
     */
    getHolds(tenantId: string, status?: string): Promise<any[]>;
    /**
     * Create client - only allowed for broker-tenants
     */
    createClient(tenantId: string, name: string, externalId?: string, email?: string, phone?: string, metadata?: any): Promise<any>;
    /**
     * Get client
     */
    getClient(clientId: string): Promise<any | null>;
    /**
     * Get clients by tenant - only returns clients for broker-tenants
     */
    getClientsByTenant(tenantId: string, status?: string): Promise<any[]>;
    /**
     * Update client KYC status
     */
    updateClientKycStatus(clientId: string, kycStatus: string, completedAt?: Date): Promise<void>;
    /**
     * Link client to account
     */
    linkClientToAccount(clientId: string, accountId: string, relationshipType?: string, permissions?: any): Promise<any>;
    /**
     * Get client accounts
     */
    getClientAccounts(clientId: string): Promise<any[]>;
    /**
     * Create fund segregation rule
     */
    createSegregationRule(tenantId: string, ruleName: string, segregationType: string, options?: any): Promise<any>;
    /**
     * Validate fund segregation rules
     */
    validateFundSegregation(tenantId: string, sourceAccountId: string, targetAccountId: string, amount: number, transaction?: Transaction): Promise<FundSegregationCheck>;
    /**
     * Create audit log
     */
    private createAuditLog;
}
export {};
//# sourceMappingURL=financial-repository.d.ts.map