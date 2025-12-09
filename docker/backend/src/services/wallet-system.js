"use strict";
/**
 * Comprehensive Wallet System Service
 *
 * ARCHITECTURE OVERVIEW:
 * - Multi-tier wallet system (Platform → Broker → User)
 * - FIAT wallets with unique reference system
 * - Crypto hot wallets (non-custodial with MFA recovery)
 * - Integration with native CEX (Dingir + Liquibook)
 * - THAL token promotion and business model
 * - Nedbank pool account system
 *
 * Features:
 * - Unique reference generation (THAL-JD-8F2K format)
 * - FIAT → USDT conversion with bulk liquidity management
 * - Hot wallet portability with secure MFA recovery
 * - Native CEX integration with liquidity incentives
 * - THAL token rewards and fee discounts
 * - Complete audit trails and compliance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletSystemService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ethers_1 = require("ethers");
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const blnkfinance_1 = require("./blnkfinance");
const quantlib_1 = require("./quantlib");
class WalletSystemService {
    db;
    eventStreamingService;
    blnkfinanceService;
    quantlibService;
    // Wallet management
    wallets = new Map();
    references = new Map();
    poolAccounts = new Map();
    // CEX integration
    cexOrders = new Map();
    thalRewards = new Map();
    transactionsLog = [];
    // ==================== FIAT ADMIN (UNALLOCATED & MULTI-SIG) ====================
    unallocatedDeposits = new Map();
    allocationProposals = new Map();
    recordUnallocatedDeposit(dep) {
        this.unallocatedDeposits.set(dep.id, {
            id: dep.id,
            brokerId: dep.brokerId,
            poolAccountNumber: dep.poolAccountNumber,
            amount: dep.amount,
            currency: dep.currency,
            bankReference: dep.bankReference,
            customerReference: dep.customerReference,
            valueDate: dep.valueDate,
            status: 'unallocated',
            notes: dep.notes,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    listUnallocatedDeposits(filter) {
        const items = Array.from(this.unallocatedDeposits.values());
        return items.filter(i => (!filter?.brokerId || i.brokerId === filter.brokerId)
            && (!filter?.currency || i.currency === filter.currency)
            && (!filter?.status || i.status === filter.status));
    }
    createAllocationProposal(params) {
        const dep = this.unallocatedDeposits.get(params.depositId);
        if (!dep || dep.status !== 'unallocated')
            throw new Error('Deposit not available');
        const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const prop = {
            id,
            depositId: params.depositId,
            proposedBy: params.proposedBy,
            target: params.target,
            amount: params.amount,
            approvalsRequired: params.approvalsRequired,
            approvers: params.approvers,
            approvals: [],
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.allocationProposals.set(id, prop);
        dep.status = 'proposed';
        dep.updatedAt = new Date();
        return prop;
    }
    approveAllocationProposal(proposalId, approverId) {
        const prop = this.allocationProposals.get(proposalId);
        if (!prop)
            throw new Error('Proposal not found');
        if (!prop.approvers.includes(approverId))
            throw new Error('Not an authorized approver');
        if (prop.approvals.includes(approverId))
            return prop; // idempotent
        prop.approvals.push(approverId);
        prop.updatedAt = new Date();
        if (prop.approvals.length >= prop.approvalsRequired) {
            prop.status = 'approved';
        }
        return prop;
    }
    rejectAllocationProposal(proposalId, approverId, reason) {
        const prop = this.allocationProposals.get(proposalId);
        if (!prop)
            throw new Error('Proposal not found');
        if (!prop.approvers.includes(approverId))
            throw new Error('Not an authorized approver');
        prop.status = 'rejected';
        prop.updatedAt = new Date();
        const dep = this.unallocatedDeposits.get(prop.depositId);
        if (dep) {
            dep.status = 'unallocated';
            dep.updatedAt = new Date();
            dep.notes = reason || dep.notes;
        }
        return prop;
    }
    async executeAllocation(proposalId) {
        const prop = this.allocationProposals.get(proposalId);
        if (!prop)
            throw new Error('Proposal not found');
        if (prop.status !== 'approved')
            throw new Error('Proposal not approved');
        const dep = this.unallocatedDeposits.get(prop.depositId);
        if (!dep)
            throw new Error('Deposit not found');
        // Credit target user's FIAT wallet
        const fiatWallet = Array.from(this.wallets.values()).find(w => w.userId === prop.target.userId && w.walletType === 'fiat' && w.currency === prop.target.currency);
        if (!fiatWallet)
            throw new Error('Target FIAT wallet not found');
        fiatWallet.balance = (parseFloat(fiatWallet.balance) + parseFloat(prop.amount)).toString();
        fiatWallet.metadata.updatedAt = new Date();
        // Update records
        dep.status = 'allocated';
        dep.updatedAt = new Date();
        prop.status = 'executed';
        prop.updatedAt = new Date();
        // Log
        logger_1.LoggerService.logTransaction(proposalId, 'fiat_admin_allocation', {
            depositId: dep.id,
            amount: prop.amount,
            currency: dep.currency,
            userId: prop.target.userId,
            brokerId: prop.target.brokerId
        });
        return { success: true, depositId: dep.id, walletId: fiatWallet.id };
    }
    // Configuration
    ZAR_TO_USDT_RATE = 18.5; // Example rate
    THAL_REWARD_RATE = 0.001; // 0.1% of trading volume
    MIN_THAL_REWARD = '1'; // Minimum 1 THAL
    MAX_THAL_REWARD = '1000'; // Maximum 1000 THAL per transaction
    // Fee layering (can be moved to ConfigService and broker overrides later)
    PLATFORM_FEE_RATE = 0.001; // 0.1%
    BROKER_FEE_RATE = 0.001; // 0.1%
    constructor(db) {
        this.db = db;
        this.eventStreamingService = new event_streaming_1.EventStreamingService();
        this.blnkfinanceService = new blnkfinance_1.BlnkFinanceService();
        this.quantlibService = new quantlib_1.QuantLibService();
    }
    async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Wallet System Service...');
            await this.loadExistingWallets();
            await this.loadPoolAccounts();
            await this.initializeCEXIntegration();
            logger_1.LoggerService.info('Wallet System Service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize Wallet System Service', { error });
            throw error;
        }
    }
    // ==================== WALLET MANAGEMENT ====================
    /**
     * Create comprehensive wallet infrastructure for new user
     */
    async createUserWalletInfrastructure(userId, tenantId, brokerId, userInfo) {
        try {
            logger_1.LoggerService.info('Creating wallet infrastructure for user', { userId, tenantId, brokerId });
            const wallets = [];
            // 1. Create FIAT wallet (linked to BlnkFinance account)
            const fiatWallet = await this.createFiatWallet(userId, tenantId, brokerId, userInfo);
            wallets.push(fiatWallet);
            // 2. Create Crypto Hot wallet (non-custodial with MFA recovery)
            const cryptoHotWallet = await this.createCryptoHotWallet(userId, tenantId, brokerId);
            wallets.push(cryptoHotWallet);
            // 3. Create THAL Token wallet
            const thalWallet = await this.createTHALWallet(userId, tenantId, brokerId);
            wallets.push(thalWallet);
            // 4. Create Trading wallet (for CEX integration)
            const tradingWallet = await this.createTradingWallet(userId, tenantId, brokerId);
            wallets.push(tradingWallet);
            // Store wallets
            wallets.forEach(wallet => {
                this.wallets.set(wallet.id, wallet);
            });
            // Log wallet infrastructure creation
            logger_1.LoggerService.info('Wallet infrastructure created', {
                userId,
                tenantId,
                brokerId,
                wallets: wallets.map(w => ({ id: w.id, type: w.walletType, currency: w.currency })),
                timestamp: new Date().toISOString()
            });
            logger_1.LoggerService.info('Wallet infrastructure created successfully', {
                userId,
                walletCount: wallets.length,
                walletTypes: wallets.map(w => w.walletType)
            });
            return wallets;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create wallet infrastructure', { error, userId });
            throw error;
        }
    }
    /**
     * Create FIAT wallet with BlnkFinance integration
     */
    async createFiatWallet(userId, tenantId, brokerId, userInfo) {
        try {
            // Create mock ledger account for FIAT (simplified)
            const ledgerAccount = {
                id: `ledger_${userId}_${Date.now()}`,
                userId,
                tenantId,
                brokerId,
                accountType: 'fiat',
                currency: 'ZAR',
                accountName: `${userInfo.firstName} ${userInfo.lastName} - FIAT Wallet`
            };
            const wallet = {
                id: `fiat_${userId}_${Date.now()}`,
                userId,
                tenantId,
                brokerId,
                walletType: 'fiat',
                currency: 'ZAR',
                accountId: ledgerAccount.id,
                status: 'active',
                balance: '0',
                metadata: {
                    mfaEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                },
                security: {
                    accessCount: 0,
                    accessLog: [],
                    fraudIndicators: []
                }
            };
            logger_1.LoggerService.info('FIAT wallet created', {
                walletId: wallet.id,
                userId,
                accountId: ledgerAccount.id
            });
            return wallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create FIAT wallet', { error, userId });
            throw error;
        }
    }
    /**
     * Create Crypto Hot wallet (non-custodial with MFA recovery)
     */
    async createCryptoHotWallet(userId, tenantId, brokerId) {
        try {
            // Generate HD wallet
            const wallet = ethers_1.ethers.Wallet.createRandom();
            const mnemonic = wallet.mnemonic;
            if (!mnemonic) {
                throw new Error('Failed to generate wallet mnemonic');
            }
            // Encrypt private key and recovery phrase
            const encryptedPrivateKey = this.encryptData(wallet.privateKey);
            const encryptedRecoveryPhrase = this.encryptData(mnemonic.phrase);
            const cryptoWallet = {
                id: `crypto_hot_${userId}_${Date.now()}`,
                userId,
                tenantId,
                brokerId,
                walletType: 'crypto_hot',
                currency: 'USDT',
                address: wallet.address,
                status: 'active',
                balance: '0',
                metadata: {
                    network: 'ethereum',
                    derivationPath: 'm/44\'/60\'/0\'/0/0',
                    publicKey: wallet.publicKey,
                    encryptedPrivateKey,
                    recoveryPhrase: encryptedRecoveryPhrase,
                    mfaEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                },
                security: {
                    accessCount: 0,
                    accessLog: [],
                    fraudIndicators: []
                }
            };
            logger_1.LoggerService.info('Crypto hot wallet created', {
                walletId: cryptoWallet.id,
                userId,
                address: wallet.address
            });
            return cryptoWallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create crypto hot wallet', { error, userId });
            throw error;
        }
    }
    /**
     * Create THAL Token wallet
     */
    async createTHALWallet(userId, tenantId, brokerId) {
        try {
            const thalWallet = {
                id: `thal_${userId}_${Date.now()}`,
                userId,
                tenantId,
                brokerId,
                walletType: 'thal_token',
                currency: 'THAL',
                status: 'active',
                balance: '0',
                metadata: {
                    mfaEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                },
                security: {
                    accessCount: 0,
                    accessLog: [],
                    fraudIndicators: []
                }
            };
            logger_1.LoggerService.info('THAL wallet created', {
                walletId: thalWallet.id,
                userId
            });
            return thalWallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create THAL wallet', { error, userId });
            throw error;
        }
    }
    /**
     * Create Trading wallet for CEX integration
     */
    async createTradingWallet(userId, tenantId, brokerId) {
        try {
            const tradingWallet = {
                id: `trading_${userId}_${Date.now()}`,
                userId,
                tenantId,
                brokerId,
                walletType: 'trading',
                currency: 'MULTI', // Multi-currency trading wallet
                status: 'active',
                balance: '0',
                metadata: {
                    mfaEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                },
                security: {
                    accessCount: 0,
                    accessLog: [],
                    fraudIndicators: []
                }
            };
            logger_1.LoggerService.info('Trading wallet created', {
                walletId: tradingWallet.id,
                userId
            });
            return tradingWallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create trading wallet', { error, userId });
            throw error;
        }
    }
    // ==================== UNIQUE REFERENCE SYSTEM ====================
    /**
     * Generate unique reference for FIAT deposits
     */
    async generateUniqueReference(userId, tenantId, brokerId, referenceType, currency, expectedAmount) {
        try {
            // Get broker code
            const brokerCode = await this.getBrokerCode(brokerId);
            // Get user initials
            const userInitials = await this.getUserInitials(userId);
            // Generate random suffix
            const randomSuffix = this.generateRandomSuffix();
            // Create reference string (alphanumeric only, no separators)
            const reference = `${brokerCode}${userInitials}${randomSuffix}`.toUpperCase();
            // Ensure uniqueness
            await this.ensureReferenceUniqueness(reference);
            const uniqueRef = {
                id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                reference,
                referenceType,
                brokerCode,
                userInitials,
                randomSuffix,
                userId,
                tenantId,
                brokerId,
                currency,
                expectedAmount,
                status: 'active',
                isPersistent: false,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                metadata: {
                    createdVia: 'auto_generated',
                    riskScore: 0,
                    complianceFlags: []
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.references.set(uniqueRef.id, uniqueRef);
            logger_1.LoggerService.info('Unique reference generated', {
                reference,
                userId,
                brokerId,
                referenceType,
                currency
            });
            return uniqueRef;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to generate unique reference', { error, userId });
            throw error;
        }
    }
    /**
     * Get or create a persistent alphanumeric reference per (userId, brokerId, currency)
     */
    async getOrCreatePersistentReference(userId, tenantId, brokerId, currency) {
        const existing = Array.from(this.references.values()).find(r => r.userId === userId && r.tenantId === tenantId && r.brokerId === brokerId &&
            r.currency === currency && r.isPersistent === true && r.status === 'active');
        if (existing)
            return existing;
        const brokerCode = await this.getBrokerCode(brokerId);
        const userInitials = await this.getUserInitials(userId);
        const randomSuffix = this.generateRandomSuffix();
        const reference = `${brokerCode}${userInitials}${randomSuffix}`.toUpperCase();
        await this.ensureReferenceUniqueness(reference);
        const ref = {
            id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            reference,
            referenceType: 'fiat_deposit',
            brokerCode,
            userInitials,
            randomSuffix,
            userId,
            tenantId,
            brokerId,
            currency,
            status: 'active',
            isPersistent: true,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            metadata: {
                createdVia: 'auto_generated',
                riskScore: 0,
                complianceFlags: []
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.references.set(ref.id, ref);
        logger_1.LoggerService.info('Persistent FIAT reference created', { userId, brokerId, currency, reference });
        return ref;
    }
    /**
     * Process FIAT deposit with unique reference
     */
    async processFiatDeposit(reference, actualAmount, bankTransaction) {
        try {
            // Find reference
            const uniqueRef = Array.from(this.references.values())
                .find(r => r.reference === reference && r.status === 'active');
            if (!uniqueRef) {
                throw new Error('Invalid or expired reference');
            }
            // Check if reference is expired
            if (new Date() > uniqueRef.expiresAt) {
                uniqueRef.status = 'expired';
                throw new Error('Reference has expired');
            }
            // Get user's FIAT wallet
            const fiatWallet = Array.from(this.wallets.values())
                .find(w => w.userId === uniqueRef.userId && w.walletType === 'fiat');
            if (!fiatWallet) {
                throw new Error('FIAT wallet not found');
            }
            // Update FIAT wallet balance
            const newBalance = (parseFloat(fiatWallet.balance) + parseFloat(actualAmount)).toString();
            fiatWallet.balance = newBalance;
            fiatWallet.metadata.updatedAt = new Date();
            // No auto-conversion or THAL rewards on deposit. User will convert explicitly.
            // Mark reference as used
            uniqueRef.status = 'used';
            uniqueRef.actualAmount = actualAmount;
            uniqueRef.usedAt = new Date();
            uniqueRef.updatedAt = new Date();
            // Log FIAT deposit processing
            logger_1.LoggerService.info('FIAT deposit processed (FIAT credited only)', {
                reference,
                userId: uniqueRef.userId,
                brokerId: uniqueRef.brokerId,
                amount: actualAmount,
                timestamp: new Date().toISOString()
            });
            logger_1.LoggerService.logTransaction(uniqueRef.id, 'fiat_deposit_processed', {
                reference,
                userId: uniqueRef.userId,
                brokerId: uniqueRef.brokerId,
                amount: actualAmount
            });
            return {
                success: true,
                walletId: fiatWallet.id
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to process FIAT deposit', { error, reference });
            throw error;
        }
    }
    /**
     * Create a conversion quote (FIAT ↔ USDT) with fee/tax breakdown (estimates)
     */
    async getConversionQuote(params) {
        const gross = parseFloat(params.amount);
        const rate = (params.fromCurrency === 'ZAR' && params.toCurrency === 'USDT')
            ? this.ZAR_TO_USDT_RATE
            : (params.fromCurrency === 'USDT' && params.toCurrency === 'ZAR')
                ? (1 / this.ZAR_TO_USDT_RATE)
                : 1;
        const fxSpread = gross * 0.002; // 0.2%
        const platformLayerFee = gross * this.PLATFORM_FEE_RATE;
        const brokerLayerFee = gross * this.BROKER_FEE_RATE;
        const platformFee = platformLayerFee + brokerLayerFee;
        const taxes = 0; // placeholder
        const net = (gross - fxSpread - platformFee - taxes) * rate;
        return {
            quoteId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            fromCurrency: params.fromCurrency,
            toCurrency: params.toCurrency,
            grossAmount: gross.toFixed(6),
            rate: rate.toString(),
            fxSpread: fxSpread.toFixed(6),
            platformFee: platformFee.toFixed(6),
            taxes: taxes.toFixed(2),
            netToReceive: net.toFixed(6),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            feePolicyVersion: '1.0.0'
        };
    }
    /**
     * Confirm conversion (FIAT ↔ USDT) applying quoted fees, updating wallets
     */
    async confirmConversion(params) {
        if (!params.acceptFees) {
            throw new Error('Fees must be accepted to proceed');
        }
        const fromWallet = Array.from(this.wallets.values()).find(w => w.userId === params.userId && ((w.walletType === 'fiat' && w.currency === params.fromCurrency) || (w.walletType === 'crypto_hot' && w.currency === params.fromCurrency)));
        const toWallet = Array.from(this.wallets.values()).find(w => w.userId === params.userId && ((w.walletType === 'fiat' && w.currency === params.toCurrency) || (w.walletType === 'crypto_hot' && w.currency === params.toCurrency)));
        if (!fromWallet || !toWallet)
            throw new Error('Wallets not found for conversion');
        const quote = await this.getConversionQuote({ userId: params.userId, tenantId: params.tenantId, brokerId: params.brokerId, fromCurrency: params.fromCurrency, toCurrency: params.toCurrency, amount: params.amount });
        const fromBal = parseFloat(fromWallet.balance);
        const amount = parseFloat(params.amount);
        if (fromBal < amount)
            throw new Error('Insufficient balance');
        fromWallet.balance = (fromBal - amount).toString();
        toWallet.balance = (parseFloat(toWallet.balance) + parseFloat(quote.netToReceive)).toString();
        fromWallet.metadata.updatedAt = new Date();
        toWallet.metadata.updatedAt = new Date();
        // Track lots and tax basis if converting ZAR<->USDT
        const now = new Date();
        if (params.fromCurrency === 'ZAR' && params.toCurrency === 'USDT') {
            // Acquire USDT lot with ZAR cost basis
            toWallet.metadata.lots = toWallet.metadata.lots || [];
            toWallet.metadata.lots.push({ amount: parseFloat(quote.netToReceive), costZAR: amount - parseFloat(quote.fxSpread) - parseFloat(quote.platformFee) - parseFloat(quote.taxes), acquiredAt: now });
        }
        else if (params.fromCurrency === 'USDT' && params.toCurrency === 'ZAR') {
            // Dispose USDT: compute simple FIFO gain (mock from current lots)
            const qtyToDispose = amount; // amount in USDT here when USDT->ZAR path uses amount in fromCurrency
            let remaining = qtyToDispose;
            let cost = 0;
            const lots = fromWallet.metadata.lots || [];
            while (remaining > 0 && lots.length) {
                const lot = lots[0];
                if (!lot)
                    break;
                const use = Math.min(remaining, lot.amount);
                cost += (lot.costZAR * (use / lot.amount));
                lot.amount -= use;
                if (lot.amount <= 0.0000001) {
                    lots.shift();
                }
                remaining -= use;
            }
            fromWallet.metadata.lots = lots;
            const proceeds = parseFloat(quote.netToReceive); // ZAR
            const taxableGain = proceeds - cost;
            this.transactionsLog.push({
                date: now,
                userId: params.userId,
                walletId: fromWallet.id,
                type: 'conversion',
                amount: amount,
                currency: params.fromCurrency,
                balanceAfter: parseFloat(fromWallet.balance),
                fees: parseFloat(quote.platformFee),
                taxes: parseFloat(quote.taxes),
                fxSpread: parseFloat(quote.fxSpread),
                proceedsZAR: proceeds,
                costZAR: cost,
                taxableGainZAR: taxableGain
            });
        }
        logger_1.LoggerService.logTransaction(params.quoteId, 'conversion_confirmed', {
            userId: params.userId,
            fromCurrency: params.fromCurrency,
            toCurrency: params.toCurrency,
            grossAmount: params.amount,
            netToReceive: quote.netToReceive,
            fxSpread: quote.fxSpread,
            platformFee: quote.platformFee,
            taxes: quote.taxes,
            feePolicyVersion: quote.feePolicyVersion
        });
        return { success: true, fromWalletId: fromWallet.id, toWalletId: toWallet.id };
    }
    // ==================== POOL ACCOUNT MANAGEMENT ====================
    /**
     * Create pool account for broker
     */
    async createPoolAccount(brokerId, accountType, bankDetails) {
        try {
            const poolAccount = {
                id: `pool_${brokerId}_${accountType}_${Date.now()}`,
                brokerId,
                accountType,
                bankAccountNumber: bankDetails.bankAccountNumber,
                bankReference: this.generateBankReference(brokerId, accountType),
                currency: 'ZAR',
                balance: '0',
                availableBalance: '0',
                pendingDeposits: '0',
                metadata: {
                    bankName: bankDetails.bankName,
                    accountHolder: bankDetails.accountHolder,
                    swiftCode: bankDetails.swiftCode,
                    iban: bankDetails.iban,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            };
            this.poolAccounts.set(poolAccount.id, poolAccount);
            logger_1.LoggerService.info('Pool account created', {
                poolAccountId: poolAccount.id,
                brokerId,
                accountType,
                bankAccountNumber: bankDetails.bankAccountNumber
            });
            return poolAccount;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create pool account', { error, brokerId });
            throw error;
        }
    }
    // ==================== CEX INTEGRATION ====================
    /**
     * Place order on native CEX
     */
    async placeCEXOrder(userId, tenantId, brokerId, params) {
        try {
            // Check user has sufficient balance
            const tradingWallet = Array.from(this.wallets.values())
                .find(w => w.userId === userId && w.walletType === 'trading');
            if (!tradingWallet) {
                throw new Error('Trading wallet not found');
            }
            // Calculate required balance
            const requiredBalance = params.type === 'market'
                ? (parseFloat(params.quantity) * await this.getMarketPrice(params.tradingPair))
                : (parseFloat(params.quantity) * parseFloat(params.price || '0'));
            if (parseFloat(tradingWallet.balance) < requiredBalance) {
                throw new Error('Insufficient balance');
            }
            // Create CEX order
            const cexOrder = {
                id: `cex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId,
                tenantId,
                brokerId,
                tradingPair: params.tradingPair,
                side: params.side,
                type: params.type,
                quantity: params.quantity,
                price: params.price,
                stopPrice: params.stopPrice,
                status: 'pending',
                filledQuantity: '0',
                averagePrice: '0',
                fees: '0',
                thalRewards: '0',
                engine: 'hybrid', // Will determine best engine
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            };
            // Process order through trading engines
            await this.processCEXOrder(cexOrder);
            this.cexOrders.set(cexOrder.id, cexOrder);
            logger_1.LoggerService.logTransaction(cexOrder.id, 'cex_order_placed', {
                userId,
                brokerId,
                tradingPair: params.tradingPair,
                side: params.side,
                quantity: params.quantity,
                price: params.price
            });
            return cexOrder;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to place CEX order', { error, userId });
            throw error;
        }
    }
    /**
     * Process CEX order through trading engines
     */
    async processCEXOrder(order) {
        try {
            // Try Dingir first, fallback to Liquibook
            let engineUsed = 'dingir';
            try {
                await this.processDingirOrder(order);
            }
            catch (error) {
                logger_1.LoggerService.warn('Dingir order failed, trying Liquibook', { error, orderId: order.id });
                await this.processLiquibookOrder(order);
                engineUsed = 'liquibook';
            }
            order.engine = engineUsed;
            order.status = 'open';
            order.metadata.updatedAt = new Date();
            // Calculate THAL rewards
            const thalReward = this.calculateTHALReward(order.quantity);
            order.thalRewards = thalReward;
            // Credit THAL rewards to user's THAL wallet
            if (thalReward) {
                await this.creditTHALReward(order.userId, thalReward, 'trading_fee_discount', order.id);
            }
            logger_1.LoggerService.info('CEX order processed', {
                orderId: order.id,
                engine: engineUsed,
                thalReward
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to process CEX order', { error, orderId: order.id });
            order.status = 'rejected';
            order.metadata.updatedAt = new Date();
            throw error;
        }
    }
    // ==================== THAL TOKEN BUSINESS MODEL ====================
    /**
     * Calculate THAL reward based on transaction
     */
    calculateTHALReward(amount) {
        const reward = parseFloat(amount) * this.THAL_REWARD_RATE;
        const clampedReward = Math.max(parseFloat(this.MIN_THAL_REWARD), Math.min(reward, parseFloat(this.MAX_THAL_REWARD)));
        return clampedReward.toString();
    }
    /**
     * Credit THAL reward to user
     */
    async creditTHALReward(userId, amount, rewardType, sourceId) {
        try {
            const thalReward = {
                id: `thal_reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId,
                brokerId: 'platform', // Platform-level reward
                rewardType,
                amount,
                currency: 'THAL',
                status: 'credited',
                metadata: {
                    sourceOrderId: sourceId,
                    multiplier: 1.0,
                    createdAt: new Date()
                }
            };
            this.thalRewards.set(thalReward.id, thalReward);
            // Update user's THAL wallet
            const thalWallet = Array.from(this.wallets.values())
                .find(w => w.userId === userId && w.walletType === 'thal_token');
            if (thalWallet) {
                const newBalance = (parseFloat(thalWallet.balance) + parseFloat(amount)).toString();
                thalWallet.balance = newBalance;
                thalWallet.metadata.updatedAt = new Date();
            }
            logger_1.LoggerService.info('THAL reward credited', {
                userId,
                amount,
                rewardType,
                sourceId
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to credit THAL reward', { error, userId });
        }
    }
    // ==================== WALLET RECOVERY ====================
    /**
     * Recover hot wallet with MFA verification
     */
    async recoverHotWallet(userId, mfaCode, recoveryMethod) {
        try {
            // Verify MFA code (simplified - in production, use proper MFA service)
            if (!this.verifyMFACode(userId, mfaCode)) {
                throw new Error('Invalid MFA code');
            }
            const cryptoWallet = Array.from(this.wallets.values())
                .find(w => w.userId === userId && w.walletType === 'crypto_hot');
            if (!cryptoWallet) {
                throw new Error('Crypto wallet not found');
            }
            // Decrypt recovery data
            let recoveryData;
            if (recoveryMethod === 'phrase') {
                recoveryData = this.decryptData(cryptoWallet.metadata.recoveryPhrase);
            }
            else {
                recoveryData = this.decryptData(cryptoWallet.metadata.encryptedPrivateKey);
            }
            // Update wallet status
            cryptoWallet.status = 'active';
            cryptoWallet.metadata.updatedAt = new Date();
            logger_1.LoggerService.logSecurity('hot_wallet_recovered', {
                userId,
                recoveryMethod,
                walletId: cryptoWallet.id
            });
            return {
                success: true,
                wallet: cryptoWallet,
                recoveryData
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to recover hot wallet', { error, userId });
            throw error;
        }
    }
    // ==================== UTILITY METHODS ====================
    async loadExistingWallets() {
        // In production, load from database
        logger_1.LoggerService.info('Loading existing wallets from database...');
    }
    async loadPoolAccounts() {
        // In production, load from database
        logger_1.LoggerService.info('Loading pool accounts from database...');
    }
    async initializeCEXIntegration() {
        logger_1.LoggerService.info('Initializing CEX integration...');
    }
    async getBrokerCode(brokerId) {
        // In production, get from broker configuration
        return 'THAL'; // Default broker code
    }
    async getUserInitials(userId) {
        // In production, get from user profile
        return 'JD'; // Default initials
    }
    generateRandomSuffix() {
        return Math.random().toString(36).substr(2, 4).toUpperCase();
    }
    async ensureReferenceUniqueness(reference) {
        const existing = Array.from(this.references.values())
            .find(r => r.reference === reference && r.status === 'active');
        if (existing) {
            throw new Error('Reference already exists');
        }
    }
    /**
     * Attempt to auto-match a bank deposit to a persistent reference
     */
    autoMatchDepositToReference(record) {
        const ref = Array.from(this.references.values()).find(r => r.reference.toUpperCase() === record.reference.toUpperCase() &&
            r.currency === record.currency &&
            r.status === 'active');
        if (!ref)
            return { matched: false };
        return {
            matched: true,
            userId: ref.userId,
            brokerId: ref.brokerId,
            tenantId: ref.tenantId,
            referenceId: ref.id
        };
    }
    generateBankReference(brokerId, accountType) {
        return `BANK_${brokerId}_${accountType}_${Date.now()}`;
    }
    encryptData(data) {
        const algorithm = 'aes-256-gcm';
        const key = crypto_1.default.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }
    decryptData(encryptedData) {
        const algorithm = 'aes-256-gcm';
        const key = crypto_1.default.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const parts = encryptedData.split(':');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error('Invalid encrypted data format');
        }
        const [ivHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv(algorithm, key, iv);
        const updateResult = decipher.update(encrypted, 'hex', 'utf8');
        const finalResult = decipher.final('utf8');
        const decrypted = (updateResult ?? '') + (finalResult ?? '');
        return decrypted;
    }
    verifyMFACode(userId, code) {
        // Simplified MFA verification - in production, use proper MFA service
        return code === '123456'; // Mock verification
    }
    async getMarketPrice(tradingPair) {
        // In production, get from market data service
        return 50000; // Mock BTC price
    }
    async processDingirOrder(order) {
        // Mock Dingir order processing
        logger_1.LoggerService.info('Processing Dingir order', { orderId: order.id });
    }
    async processLiquibookOrder(order) {
        // Mock Liquibook order processing
        logger_1.LoggerService.info('Processing Liquibook order', { orderId: order.id });
    }
    // ==================== PUBLIC API METHODS ====================
    /**
     * Get user's wallets
     */
    getUserWallets(userId) {
        return Array.from(this.wallets.values())
            .filter(w => w.userId === userId);
    }
    /**
     * Get wallet by ID
     */
    getWallet(walletId) {
        return this.wallets.get(walletId) || null;
    }
    /**
     * Get unique reference by reference string
     */
    getReference(reference) {
        return Array.from(this.references.values())
            .find(r => r.reference === reference) || null;
    }
    /**
     * Get pool accounts for broker
     */
    getBrokerPoolAccounts(brokerId) {
        return Array.from(this.poolAccounts.values())
            .filter(p => p.brokerId === brokerId);
    }
    /**
     * Get CEX orders for user
     */
    getUserCEXOrders(userId) {
        return Array.from(this.cexOrders.values())
            .filter(o => o.userId === userId);
    }
    /**
     * Get THAL rewards for user
     */
    getUserTHALRewards(userId) {
        return Array.from(this.thalRewards.values())
            .filter(r => r.userId === userId);
    }
    /**
     * Generate wallet statement (CSV) for date range (mocked from in-memory state)
     */
    async generateWalletStatementCSV(params) {
        const wallet = this.getWallet(params.walletId);
        if (!wallet)
            throw new Error('Wallet not found');
        const from = params.from ? new Date(params.from) : new Date('1970-01-01');
        const to = params.to ? new Date(params.to) : new Date();
        const rows = [];
        rows.push('date,type,reference,amount,currency,balanceAfter,fees,taxes,fxSpread');
        for (const t of this.transactionsLog) {
            if (t.walletId !== wallet.id)
                continue;
            if (t.date < from || t.date > to)
                continue;
            rows.push(`${t.date.toISOString()},${t.type},${t.reference || ''},${t.amount},${t.currency},${t.balanceAfter},${t.fees || 0},${t.taxes || 0},${t.fxSpread || 0}`);
        }
        return rows.join('\n');
    }
    /**
     * Generate tax report (CSV) for a range with method (FIFO/LIFO) - placeholder
     */
    async generateTaxReportCSV(params) {
        const from = params.from ? new Date(params.from) : new Date('1970-01-01');
        const to = params.to ? new Date(params.to) : new Date();
        const rows = [];
        rows.push('date,event,asset,quantity,proceedsZAR,feesZAR,taxableGainZAR');
        for (const t of this.transactionsLog) {
            if (t.userId !== params.userId)
                continue;
            if (t.date < from || t.date > to)
                continue;
            if (typeof t.taxableGainZAR === 'number') {
                rows.push(`${t.date.toISOString()},conversion,USDT,${t.amount},${t.proceedsZAR || 0},${t.fees || 0},${t.taxableGainZAR || 0}`);
            }
        }
        return rows.join('\n');
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        logger_1.LoggerService.info('Shutting down Wallet System Service...');
    }
}
exports.WalletSystemService = WalletSystemService;
//# sourceMappingURL=wallet-system.js.map