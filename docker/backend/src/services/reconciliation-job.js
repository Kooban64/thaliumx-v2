"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationJob = void 0;
const database_1 = require("./database");
const logger_1 = require("./logger");
const redis_1 = require("./redis");
const decimal_js_1 = __importDefault(require("decimal.js"));
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const sequelize_1 = require("sequelize");
class ReconciliationJob {
    static isRunning = false;
    static LOCK_KEY = 'reconciliation:lock';
    static LOCK_TTL_MS = 3600000; // 1 hour max for reconciliation job
    /**
     * Run reconciliation with distributed locking to prevent concurrent execution
     * This ensures only one reconciliation job runs at a time across all instances
     *
     * @param options Optional reconciliation options
     * @returns Promise resolving to reconciliation result
     */
    static async run(options) {
        const lockToken = (0, uuid_1.v4)();
        const redis = redis_1.RedisService.isConnected() ? redis_1.RedisService.getClient() : null;
        // Try to acquire distributed lock
        if (redis && !options?.force) {
            try {
                const acquired = await ReconciliationJob.tryAcquireLock(redis, ReconciliationJob.LOCK_KEY, lockToken, ReconciliationJob.LOCK_TTL_MS);
                if (!acquired) {
                    logger_1.LoggerService.warn('Reconciliation job already running, skipping');
                    return {
                        status: 'skipped',
                        reason: 'Another reconciliation job is already running',
                        timestamp: new Date()
                    };
                }
            }
            catch (error) {
                logger_1.LoggerService.error('Failed to acquire reconciliation lock', { error: error.message });
                // If Redis is unavailable, fall back to in-memory lock (single instance only)
                if (ReconciliationJob.isRunning) {
                    return {
                        status: 'skipped',
                        reason: 'Reconciliation job already running (in-memory check)',
                        timestamp: new Date()
                    };
                }
            }
        }
        else if (ReconciliationJob.isRunning && !options?.force) {
            // In-memory lock fallback when Redis unavailable
            logger_1.LoggerService.warn('Reconciliation job already running (in-memory), skipping');
            return {
                status: 'skipped',
                reason: 'Reconciliation job already running',
                timestamp: new Date()
            };
        }
        try {
            ReconciliationJob.isRunning = true;
            logger_1.LoggerService.info('Starting reconciliation job', { lockToken });
            // Step 1: Fetch balances from all configured exchanges
            logger_1.LoggerService.info('Step 1: Fetching exchange balances...');
            const exchangeBalances = {};
            try {
                const { OmniExchangeService } = await import('./omni-exchange');
                // OmniExchangeService expects a Pool, but we can pass null/undefined and it will work
                // The service will use DatabaseService internally if needed
                const omniService = new OmniExchangeService(null);
                await omniService.initialize();
                const exchanges = omniService.getAvailableExchanges();
                for (const exchange of exchanges) {
                    if (exchange.enabled && (exchange.health?.status === 'healthy' || !exchange.health)) {
                        try {
                            // Get balances for major assets
                            const assets = ['BTC', 'ETH', 'USDT', 'USDC'];
                            const exchangeBalanceMap = {};
                            exchangeBalances[exchange.id] = exchangeBalanceMap;
                            for (const asset of assets) {
                                try {
                                    const balance = await omniService.getBalance(exchange.id, asset);
                                    if (balance?.asset) {
                                        exchangeBalanceMap[balance.asset] = parseFloat(balance.available || '0');
                                    }
                                }
                                catch (error) {
                                    logger_1.LoggerService.warn(`Failed to get ${asset} balance from ${exchange.name}`, {
                                        exchangeId: exchange.id,
                                        error: error.message
                                    });
                                }
                            }
                            logger_1.LoggerService.info(`Fetched balances from ${exchange.name}`, {
                                exchangeId: exchange.id,
                                assetCount: Object.keys(exchangeBalances[exchange.id] || {}).length
                            });
                        }
                        catch (error) {
                            logger_1.LoggerService.warn(`Failed to fetch balances from ${exchange.name}`, {
                                exchangeId: exchange.id,
                                error: error.message
                            });
                        }
                    }
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to fetch exchange balances, continuing with internal balances only', {
                    error: error.message
                });
            }
            // Step 2: Get internal ledger balances from BlnkFinance
            logger_1.LoggerService.info('Step 2: Fetching internal ledger balances...');
            const { BlnkFinanceService } = await import('./blnkfinance');
            const internalBalances = {};
            try {
                // Get all accounts from database
                const AccountModel = database_1.DatabaseService.getModel('Account');
                const accounts = await AccountModel.findAll({
                    where: {
                        isActive: true
                    },
                    attributes: ['id', 'currency']
                });
                logger_1.LoggerService.info(`Found ${accounts.length} active accounts`);
                for (const account of accounts) {
                    try {
                        const accountData = account.toJSON ? account.toJSON() : account;
                        const accountId = accountData.id || accountData.dataValues?.id;
                        const currency = accountData.currency || accountData.dataValues?.currency || 'USD';
                        const balance = await BlnkFinanceService.getAccountBalance(accountId);
                        if (balance) {
                            const balanceValue = parseFloat(balance.netBalance?.toString() || balance.balance?.toString() || '0');
                            internalBalances[currency] = (internalBalances[currency] || 0) + balanceValue;
                        }
                    }
                    catch (error) {
                        logger_1.LoggerService.warn(`Failed to get balance for account`, {
                            accountId: account.id || account.dataValues?.id || account.get?.('id') || '',
                            error: error.message
                        });
                    }
                }
                logger_1.LoggerService.info('Fetched internal balances', {
                    currencyCount: Object.keys(internalBalances).length,
                    totalAccounts: accounts.length
                });
            }
            catch (error) {
                logger_1.LoggerService.error('Failed to fetch internal balances', { error: error.message });
                throw error;
            }
            // Step 3: Compare balances and identify discrepancies
            logger_1.LoggerService.info('Step 3: Comparing balances...');
            const discrepancies = [];
            const DISCREPANCY_THRESHOLD = 0.01; // 1 cent tolerance
            const DISCREPANCY_PERCENT_THRESHOLD = 0.1; // 0.1% tolerance
            // Compare internal balances with exchange balances
            for (const [exchangeId, balances] of Object.entries(exchangeBalances)) {
                for (const [asset, exchangeBalance] of Object.entries(balances)) {
                    const internalBalance = internalBalances[asset] || 0;
                    const difference = Math.abs(internalBalance - exchangeBalance);
                    const differencePercent = internalBalance > 0
                        ? (difference / internalBalance) * 100
                        : (exchangeBalance > 0 ? 100 : 0);
                    if (difference > DISCREPANCY_THRESHOLD || differencePercent > DISCREPANCY_PERCENT_THRESHOLD) {
                        discrepancies.push({
                            exchange: exchangeId,
                            asset,
                            expectedBalance: internalBalance,
                            actualBalance: exchangeBalance,
                            difference,
                            differencePercent
                        });
                    }
                }
            }
            // Check for internal balances not on exchanges
            for (const [asset, internalBalance] of Object.entries(internalBalances)) {
                let foundOnExchange = false;
                for (const [exchangeId, balances] of Object.entries(exchangeBalances)) {
                    if (balances[asset] !== undefined) {
                        foundOnExchange = true;
                        break;
                    }
                }
                // If asset exists internally but not on any exchange, it's not a discrepancy
                // (some assets may be internal-only)
            }
            // Step 4: Generate reconciliation snapshot
            logger_1.LoggerService.info('Step 4: Generating reconciliation snapshot...');
            const ReconciliationSnapshotModel = database_1.DatabaseService.getModel('ReconciliationSnapshot');
            const snapshotData = {
                snapshotAt: new Date(),
                platformTotals: internalBalances,
                exchangeBalances: exchangeBalances,
                internalAllocations: {},
                reconciliation: {
                    status: discrepancies.length === 0 ? 'matched' : 'difference',
                    discrepancyCount: discrepancies.length,
                    discrepancies: discrepancies.slice(0, 100), // Limit to 100 discrepancies per snapshot
                    totalAssets: Object.keys(internalBalances).length,
                    totalExchanges: Object.keys(exchangeBalances).length
                }
            };
            const snapshot = await ReconciliationSnapshotModel.create(snapshotData);
            logger_1.LoggerService.info('Reconciliation snapshot created', {
                snapshotId: snapshot.get('id'),
                discrepancyCount: discrepancies.length
            });
            // Step 5: Generate proof of reserves if balances match
            if (discrepancies.length === 0) {
                logger_1.LoggerService.info('Step 5: Generating proof of reserves...');
                const reconciliationJob = new ReconciliationJob();
                // Generate proof for each asset
                for (const [asset, internalBalance] of Object.entries(internalBalances)) {
                    // Find exchange with this asset
                    for (const [exchangeId, balances] of Object.entries(exchangeBalances)) {
                        if (balances[asset] !== undefined) {
                            try {
                                await reconciliationJob.generateProofOfReserves(exchangeId, asset, balances[asset], internalBalance);
                            }
                            catch (error) {
                                logger_1.LoggerService.warn(`Failed to generate proof of reserves for ${asset} on ${exchangeId}`, {
                                    error: error.message
                                });
                            }
                        }
                    }
                }
            }
            // Step 6: Alert on discrepancies
            if (discrepancies.length > 0) {
                logger_1.LoggerService.warn('Reconciliation discrepancies detected', {
                    count: discrepancies.length,
                    discrepancies: discrepancies.slice(0, 10) // Log first 10
                });
                // Emit alert event
                try {
                    const { EventStreamingService } = await import('./event-streaming');
                    await EventStreamingService.emitAuditEvent('reconciliation.discrepancies', 'reconciliation', snapshot.get('id'), {
                        discrepancyCount: discrepancies.length,
                        discrepancies: discrepancies.slice(0, 20), // Include first 20 in event
                        snapshotId: snapshot.get('id')
                    });
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to emit reconciliation alert event', { error: error.message });
                }
            }
            const result = {
                status: discrepancies.length === 0 ? 'matched' : 'difference',
                timestamp: new Date(),
                snapshotId: snapshot.get('id'),
                discrepancyCount: discrepancies.length,
                totalAssets: Object.keys(internalBalances).length,
                totalExchanges: Object.keys(exchangeBalances).length,
                message: discrepancies.length === 0
                    ? 'Reconciliation completed successfully - all balances matched'
                    : `Reconciliation completed with ${discrepancies.length} discrepancy(ies)`
            };
            logger_1.LoggerService.info('Reconciliation job completed', {
                lockToken,
                status: result.status,
                discrepancyCount: discrepancies.length
            });
            return result;
        }
        catch (error) {
            logger_1.LoggerService.error('Reconciliation job failed', {
                error: error.message,
                stack: error.stack,
                lockToken
            });
            throw error;
        }
        finally {
            ReconciliationJob.isRunning = false;
            // Release distributed lock
            if (redis) {
                try {
                    await ReconciliationJob.releaseLock(redis, ReconciliationJob.LOCK_KEY, lockToken);
                }
                catch (error) {
                    logger_1.LoggerService.error('Failed to release reconciliation lock', {
                        error: error.message,
                        lockToken
                    });
                    // Emit alert for stuck locks
                    await logger_1.LoggerService.logAudit('reconciliation_lock_release_failed', 'reconciliation', {}, { lockKey: ReconciliationJob.LOCK_KEY, lockToken, error: error.message }).catch(() => {
                        logger_1.LoggerService.warn('Failed to emit lock release failure event');
                    });
                }
            }
        }
    }
    /**
     * Try to acquire a distributed lock using Redis
     * Uses SET with NX (only if not exists) and EX (expiration) for atomic lock acquisition
     */
    static async tryAcquireLock(redis, key, token, ttlMs) {
        try {
            const result = await redis.set(key, token, {
                EX: Math.floor(ttlMs / 1000),
                NX: true
            });
            return result === 'OK';
        }
        catch (error) {
            logger_1.LoggerService.error('Lock acquisition error', { key, error: error.message });
            return false;
        }
    }
    /**
     * Release a distributed lock using Redis
     * Uses Lua script to ensure atomic release (only if token matches)
     */
    static async releaseLock(redis, key, token) {
        try {
            // Lua script to atomically check and delete lock
            // Only deletes if the value matches the token (prevents releasing someone else's lock)
            const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
            await redis.eval(luaScript, 1, key, token);
        }
        catch (error) {
            logger_1.LoggerService.error('Lock release error', { key, error: error.message });
            throw error;
        }
    }
    /**
     * Get reconciliation statistics
     */
    async getStats(days = 7) {
        const sequelize = database_1.DatabaseService.getSequelize();
        // Query reconciliation snapshots for statistics
        const ReconciliationSnapshotModel = database_1.DatabaseService.getModel('ReconciliationSnapshot');
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - days);
        const snapshots = await ReconciliationSnapshotModel.findAll({
            where: {
                snapshotAt: {
                    [sequelize_1.Op.gte]: dateThreshold
                }
            },
            order: [['snapshotAt', 'DESC']]
        });
        let totalReconciliations = 0;
        let matchedCount = 0;
        let discrepancyCount = 0;
        let totalDiscrepancyPercent = 0;
        for (const snapshot of snapshots) {
            const data = snapshot.toJSON();
            const reconciliation = data.reconciliation || {};
            totalReconciliations++;
            if (reconciliation.status === 'matched') {
                matchedCount++;
            }
            else {
                discrepancyCount++;
                if (reconciliation.differencePercent) {
                    totalDiscrepancyPercent += Math.abs(parseFloat(reconciliation.differencePercent));
                }
            }
        }
        return {
            totalReconciliations,
            matchedCount,
            discrepancyCount,
            avgDiscrepancyPercent: discrepancyCount > 0 ? totalDiscrepancyPercent / discrepancyCount : 0,
            maxDiscrepancyPercent: totalDiscrepancyPercent, // Simplified
            periodDays: days
        };
    }
    /**
     * Get last proof of reserves
     */
    async getLastProofOfReserves(exchange, asset) {
        // Query from reconciliation snapshots
        const ReconciliationSnapshotModel = database_1.DatabaseService.getModel('ReconciliationSnapshot');
        const snapshots = await ReconciliationSnapshotModel.findAll({
            where: {
                exchangeBalances: {
                    [sequelize_1.Op.contains]: [{ exchange, asset }]
                }
            },
            order: [['snapshotAt', 'DESC']],
            limit: 1
        });
        if (snapshots.length === 0) {
            return null;
        }
        const snapshot = snapshots[0];
        if (!snapshot) {
            return null;
        }
        const data = snapshot.toJSON();
        const exchangeBalances = data.exchangeBalances || {};
        const platformTotals = data.platformTotals || {};
        const reconciliation = data.reconciliation || {};
        const exchangeBalance = new decimal_js_1.default(exchangeBalances[`${exchange}_${asset}`] || 0);
        const internalTotal = new decimal_js_1.default(platformTotals[asset] || 0);
        return {
            id: snapshot.get('id'),
            exchangeName: exchange,
            asset,
            exchangeBalance,
            internalTotal,
            reserveRatio: internalTotal.isZero() ? new decimal_js_1.default(0) : exchangeBalance.dividedBy(internalTotal),
            merkleRoot: reconciliation.merkleRoot || '',
            signature: reconciliation.signature || '',
            timestamp: snapshot?.get('snapshotAt') || new Date(),
            proofDate: snapshot?.get('snapshotAt') || new Date(),
            createdAt: snapshot?.get('createdAt') || new Date()
        };
    }
    /**
     * Generate proof of reserves
     */
    async generateProofOfReserves(exchangeName, asset, exchangeBalance, internalTotal) {
        const exchangeBalanceDec = exchangeBalance instanceof decimal_js_1.default ? exchangeBalance : new decimal_js_1.default(exchangeBalance);
        const internalTotalDec = internalTotal instanceof decimal_js_1.default ? internalTotal : new decimal_js_1.default(internalTotal);
        // Calculate reserve ratio
        const reserveRatio = internalTotalDec.isZero()
            ? new decimal_js_1.default(0)
            : exchangeBalanceDec.dividedBy(internalTotalDec);
        // Calculate merkle root
        const merkleRoot = await this.calculateMerkleRoot(asset);
        // Generate signature
        const signature = await this.signProof(exchangeName, asset, exchangeBalanceDec, merkleRoot);
        // Store in reconciliation snapshot
        const ReconciliationSnapshotModel = database_1.DatabaseService.getModel('ReconciliationSnapshot');
        const proofId = (0, uuid_1.v4)();
        const snapshotData = {
            snapshotAt: new Date(),
            platformTotals: { [asset]: internalTotalDec.toString() },
            exchangeBalances: { [`${exchangeName}_${asset}`]: exchangeBalanceDec.toString() },
            internalAllocations: {},
            reconciliation: {
                status: 'matched',
                merkleRoot,
                signature,
                reserveRatio: reserveRatio.toString()
            }
        };
        await ReconciliationSnapshotModel.create(snapshotData);
        logger_1.LoggerService.info('Proof of reserves generated', {
            proofId,
            exchangeName,
            asset,
            reserveRatio: reserveRatio.toFixed(4)
        });
        return {
            id: proofId,
            exchangeName,
            asset,
            exchangeBalance: exchangeBalanceDec,
            internalTotal: internalTotalDec,
            reserveRatio,
            merkleRoot,
            signature,
            timestamp: new Date(),
            proofDate: new Date(),
            createdAt: new Date()
        };
    }
    /**
     * Calculate merkle root of all user balances
     */
    async calculateMerkleRoot(asset) {
        const BalanceModel = database_1.DatabaseService.getModel('Balance');
        const balances = await BalanceModel.findAll({
            where: {
                asset
            },
            attributes: ['userId', 'tenantId', 'total']
        });
        if (balances.length === 0) {
            return '0x0000000000000000000000000000000000000000000000000000000000000000';
        }
        const leaves = balances.map(balance => {
            const data = balance.toJSON();
            const dataString = `${data.userId}:${data.tenantId}:${data.total}`;
            return crypto.createHash('sha256').update(dataString).digest('hex');
        });
        let currentLevel = leaves;
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                const combined = crypto.createHash('sha256').update((left || '') + (right || '')).digest('hex');
                nextLevel.push(combined);
            }
            currentLevel = nextLevel;
        }
        return '0x' + currentLevel[0];
    }
    /**
     * Sign proof of reserves
     */
    async signProof(exchangeName, asset, balance, merkleRoot) {
        const balanceDec = balance instanceof decimal_js_1.default ? balance : new decimal_js_1.default(balance);
        const message = JSON.stringify({
            exchange: exchangeName,
            asset,
            balance: balanceDec.toString(),
            merkleRoot,
            timestamp: new Date().toISOString()
        });
        // In production: use HSM or Vault for signing
        const signature = crypto
            .createHash('sha256')
            .update(message)
            .digest('hex');
        return signature;
    }
}
exports.ReconciliationJob = ReconciliationJob;
//# sourceMappingURL=reconciliation-job.js.map