/**
 * Reconciliation Job Service
 *
 * Automated reconciliation system for verifying exchange balances and generating proof of reserves.
 *
 * Features:
 * - Exchange balance reconciliation (compares internal ledger vs exchange balances)
 * - Proof of Reserves generation with cryptographic verification
 * - Reconciliation statistics and reporting
 * - Discrepancy detection and alerting
 * - Reconciliation snapshots for historical tracking
 *
 * Reconciliation Process:
 * 1. Fetch balances from all configured exchanges
 * 2. Compare with internal ledger balances
 * 3. Identify discrepancies
 * 4. Generate reconciliation snapshot
 * 5. Create proof of reserves if balances match
 * 6. Alert on discrepancies above threshold
 *
 * Proof of Reserves:
 * - Cryptographic hash of all balances
 * - Timestamp and signature for verification
 * - Includes all currencies and accounts
 * - Used for regulatory compliance and transparency
 *
 * Statistics:
 * - Reconciliation success rate
 * - Discrepancy counts and percentages
 * - Historical reconciliation data
 * - Trend analysis
 *
 * Production Features:
 * - Prevents concurrent reconciliation runs
 * - Comprehensive error handling
 * - Detailed logging for audit trail
 */
export declare class ReconciliationJob {
    private static isRunning;
    private static readonly LOCK_KEY;
    private static readonly LOCK_TTL_MS;
    /**
     * Run reconciliation with distributed locking to prevent concurrent execution
     * This ensures only one reconciliation job runs at a time across all instances
     *
     * @param options Optional reconciliation options
     * @returns Promise resolving to reconciliation result
     */
    static run(options?: {
        force?: boolean;
    }): Promise<any>;
    /**
     * Try to acquire a distributed lock using Redis
     * Uses SET with NX (only if not exists) and EX (expiration) for atomic lock acquisition
     */
    private static tryAcquireLock;
    /**
     * Release a distributed lock using Redis
     * Uses Lua script to ensure atomic release (only if token matches)
     */
    private static releaseLock;
    /**
     * Get reconciliation statistics
     */
    getStats(days?: number): Promise<any>;
    /**
     * Get last proof of reserves
     */
    getLastProofOfReserves(exchange: string, asset: string): Promise<any | null>;
    /**
     * Generate proof of reserves
     */
    generateProofOfReserves(exchangeName: string, asset: string, exchangeBalance: number | string | any, internalTotal: number | string | any): Promise<any>;
    /**
     * Calculate merkle root of all user balances
     */
    private calculateMerkleRoot;
    /**
     * Sign proof of reserves
     */
    private signProof;
}
//# sourceMappingURL=reconciliation-job.d.ts.map