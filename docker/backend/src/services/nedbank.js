"use strict";
/**
 * Nedbank Integration Service
 * - Payouts (PayShap / EFT)
 * - Deposit scraping (pool account statements)
 * - Pool account selection (platform or broker-level)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NedbankService = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
class NedbankService {
    static payoutClient;
    static depositsClient;
    static isInit = false;
    static async initialize() {
        if (this.isInit)
            return;
        // Read secrets
        const secretsPath = path_1.default.resolve(process.env.NEDBANK_SECRETS_PATH || '/home/ubuntu/thaliumx-clean/.secrets/nedbank.json');
        const raw = fs_1.default.readFileSync(secretsPath, 'utf8');
        const secrets = JSON.parse(raw);
        this.payoutClient = axios_1.default.create({
            baseURL: secrets.payout.baseUrl,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': secrets.payout.apiKey || ''
            },
            auth: {
                username: secrets.payout.clientId,
                password: secrets.payout.clientSecret
            }
        });
        this.depositsClient = axios_1.default.create({
            baseURL: secrets.deposits.baseUrl,
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': secrets.deposits.apiKey || ''
            },
            auth: {
                username: secrets.deposits.clientId,
                password: secrets.deposits.clientSecret
            }
        });
        this.isInit = true;
        logger_1.LoggerService.info('Nedbank service initialized');
    }
    static isHealthy() {
        return this.isInit;
    }
    /**
     * Initiate payout (PayShap preferred if payshapId present, else EFT)
     */
    static async initiatePayout(req) {
        try {
            const payload = {
                poolAccountNumber: req.poolAccountNumber,
                brokerId: req.brokerId,
                beneficiary: req.beneficiary,
                amount: req.amount,
                currency: req.currency,
                reference: req.reference,
                metadata: req.metadata
            };
            // Endpoint selection (mocked paths; replace with actual from secrets doc)
            const endpoint = req.beneficiary.payshapId ? '/payouts/payshap' : '/payouts/eft';
            const { data } = await this.payoutClient.post(endpoint, payload);
            // Fee layering example: assume fees returned or compute basic model
            const amountNum = parseFloat(req.amount);
            const platformFee = amountNum * 0.001; // 0.1%
            const brokerFee = amountNum * 0.001; // 0.1%
            const totalFees = platformFee + brokerFee;
            logger_1.LoggerService.logTransaction(data.id || 'payout', 'payout_initiated', {
                brokerId: req.brokerId,
                poolAccountNumber: req.poolAccountNumber,
                amount: req.amount,
                currency: req.currency,
                reference: req.reference
            });
            return {
                success: true,
                payoutId: data.id,
                status: data.status || 'pending',
                fees: {
                    platformFee: platformFee.toFixed(2),
                    brokerFee: brokerFee.toFixed(2),
                    totalFees: totalFees.toFixed(2)
                }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Nedbank payout failed', { error: error?.message });
            return { success: false, message: error?.message || 'Payout failed' };
        }
    }
    /**
     * Scrape deposits for a pool account within a date range
     */
    static async scrapeDeposits(req) {
        try {
            const params = {
                brokerId: req.brokerId,
                poolAccountNumber: req.poolAccountNumber,
                fromDate: req.fromDate,
                toDate: req.toDate
            };
            const { data } = await this.depositsClient.get('/deposits', { params });
            const results = (data?.deposits || []).map((d) => ({
                id: d.id,
                amount: String(d.amount),
                currency: d.currency || 'ZAR',
                reference: d.reference || d.customerReference || '',
                bankReference: d.bankReference,
                valueDate: d.valueDate,
                description: d.description
            }));
            logger_1.LoggerService.info('Nedbank deposit scrape completed', { count: results.length });
            return results;
        }
        catch (error) {
            logger_1.LoggerService.error('Nedbank deposit scrape failed', { error: error?.message });
            return [];
        }
    }
}
exports.NedbankService = NedbankService;
//# sourceMappingURL=nedbank.js.map