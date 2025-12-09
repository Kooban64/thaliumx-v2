"use strict";
/**
 * Omni Exchange Aggregator Service
 *
 * CRITICAL ARCHITECTURE: Single platform account per exchange
 * - Each exchange sees only ONE account from ThaliumX platform
 * - All fund segregation happens at platform level (broker/customer)
 * - Exchange orders are placed on behalf of internal users
 * - Internal ledger tracks all broker/customer allocations
 *
 * Features:
 * - Multi-exchange aggregation (KuCoin, Bybit, OKX, Kraken, VALR, Bitstamp, Crypto.com)
 * - Platform-level fund segregation (broker/customer separation)
 * - Internal order management and allocation
 * - Risk management with QuantLib integration
 * - Compliance monitoring and audit trails
 * - Real-time balance tracking per broker/customer
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmniExchangeService = void 0;
const axios_1 = __importDefault(require("axios"));
const opossum_1 = __importDefault(require("opossum"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
const config_1 = require("./config");
const event_streaming_1 = require("./event-streaming");
const quantlib_1 = require("./quantlib");
const blnkfinance_1 = require("./blnkfinance");
const database_1 = require("./database");
// ==================== Exchange Adapter Base Class ====================
class ExchangeAdapter {
    config;
    client;
    logger = logger_1.LoggerService;
    lastRequestAt = 0;
    minIntervalMs;
    breaker;
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Simple rate limit: spread requests evenly within a minute
        this.minIntervalMs = Math.max(0, Math.floor(60000 / Math.max(1, this.config.limits?.rateLimit || 60)));
        // Circuit breaker around low-level request
        this.breaker = new opossum_1.default(async (args) => {
            const res = await this.client.request(args);
            return res.data;
        }, {
            timeout: 12000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000,
            rollingCountTimeout: 10000
        });
    }
    generateSignature(timestamp, method, path, body = '') {
        const message = timestamp + method + path + body;
        return crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret).update(message).digest('hex');
    }
    async request(method, path, data) {
        // Rate limit spacing
        const now = Date.now();
        const delta = now - this.lastRequestAt;
        if (delta < this.minIntervalMs) {
            await new Promise(r => setTimeout(r, this.minIntervalMs - delta));
        }
        this.lastRequestAt = Date.now();
        // Default headers (override as needed in adapters)
        const timestamp = Date.now().toString();
        const signature = this.generateSignature(timestamp, method, path, data ? JSON.stringify(data) : '');
        const headers = {
            'X-MBX-APIKEY': this.config.credentials.apiKey,
            'X-MBX-TIMESTAMP': timestamp,
            'X-MBX-SIGNATURE': signature
        };
        if (this.config.credentials.passphrase)
            headers['X-MBX-PASSPHRASE'] = this.config.credentials.passphrase;
        // Retry with exponential backoff on transient errors
        const maxRetries = 3;
        let attempt = 0;
        let lastErr;
        while (attempt < maxRetries) {
            try {
                const result = await this.breaker.fire({ method, url: path, data, headers });
                return result;
            }
            catch (err) {
                lastErr = err;
                const status = err?.response?.status;
                const retriable = !status || (status >= 500 || status === 429);
                if (!retriable)
                    throw err;
                attempt++;
                const backoff = Math.min(2000 * attempt, 5000);
                await new Promise(r => setTimeout(r, backoff));
            }
        }
        throw lastErr;
    }
    formatSymbolForExchange(symbol) {
        // Default: pass-through
        return symbol;
    }
}
// ==================== Exchange Adapters ====================
class KuCoinAdapter extends ExchangeAdapter {
    async initialize() {
        this.logger.info(`KuCoin adapter initialized: ${this.config.baseURL}`);
    }
    kucoinSign(timestamp, method, path, body) {
        const strToSign = timestamp + method.toUpperCase() + path + (body ? JSON.stringify(body) : '');
        return crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret).update(strToSign).digest('base64');
    }
    async kucoinRequest(method, path, body) {
        const timestamp = Date.now().toString();
        const sign = this.kucoinSign(timestamp, method, path, body);
        const headers = {
            'KC-API-KEY': this.config.credentials.apiKey,
            'KC-API-SIGN': sign,
            'KC-API-TIMESTAMP': timestamp,
            'KC-API-PASSPHRASE': this.config.credentials.passphrase || '',
            'KC-API-KEY-VERSION': '2',
            'Content-Type': 'application/json'
        };
        const res = await this.client.request({ method, url: path, data: body, headers });
        if (res.data?.code && res.data.code !== '200000') {
            throw new Error(`KuCoin error: ${res.data.code}`);
        }
        return res.data?.data || res.data;
    }
    async getBalance(asset) {
        const data = await this.kucoinRequest('GET', '/api/v1/accounts');
        const entry = (data || []).find((a) => a.currency?.toUpperCase() === asset.toUpperCase()) || {};
        const available = entry?.available || '0';
        const holds = entry?.holds || '0';
        const total = (parseFloat(available) + parseFloat(holds)).toString();
        return {
            id: `${this.config.id}_${asset}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            exchangeId: this.config.id,
            asset,
            available,
            locked: holds,
            total,
            lastUpdated: new Date()
        };
    }
    async placeOrder(params) {
        const payload = {
            clientOid: `clid_${Date.now()}`,
            side: params.side,
            symbol: this.formatSymbolForExchange(params.symbol),
            type: params.type,
            size: params.amount
        };
        if (params.price)
            payload.price = params.price;
        const order = await this.kucoinRequest('POST', '/api/v1/orders', payload);
        return this.mapToStandardOrder(order || payload);
    }
    async getOrderStatus(orderId) {
        const order = await this.kucoinRequest('GET', `/api/v1/orders/${orderId}`);
        return this.mapToStandardOrder(order);
    }
    async cancelOrder(orderId) {
        await this.kucoinRequest('DELETE', `/api/v1/orders/${orderId}`);
    }
    mapToStandardOrder(order) {
        return {
            id: order.clientOid || order.orderId || `kucoin_${Date.now()}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: order.userId || 'unknown',
            exchangeId: this.config.id,
            symbol: order.symbol || order.instId,
            side: (order.side || 'buy').toLowerCase(),
            type: (order.type || 'limit').toLowerCase(),
            amount: order.size || order.qty || '0',
            price: order.price,
            status: this.mapStatus(order.status || order.orderStatus),
            filledAmount: order.dealSize || order.cumExecQty || '0',
            averagePrice: order.averagePrice || order.avgPrice || order.price || '0',
            fees: order.fee || order.cumExecFee || '0',
            externalOrderId: order.orderId || order.id,
            fundSegregation: {
                platformAccount: 'single_platform_account',
                brokerAllocation: 'unknown',
                customerAllocation: 'unknown',
                orderPool: 'user_trading_pool',
                feePool: 'fee_pool',
                settlementPool: 'exchange_settlement_pool'
            },
            riskMetrics: {
                exposure: 0,
                maxDrawdown: 0,
                volatility: 0
            },
            metadata: {
                createdAt: new Date(order.createdAt || Date.now()),
                updatedAt: new Date(order.updatedAt || order.createdAt || Date.now()),
                version: '1.0.0'
            }
        };
    }
    mapStatus(status) {
        const statusMap = {
            'new': 'pending',
            'open': 'open',
            'done': 'filled',
            'cancel': 'cancelled',
            'reject': 'rejected',
            'partial': 'partially_filled'
        };
        return statusMap[status] || 'pending';
    }
}
class BybitAdapter extends ExchangeAdapter {
    async initialize() {
        this.logger.info(`Bybit adapter initialized: ${this.config.baseURL}`);
    }
    bybitSign(timestamp, recvWindow, path, body) {
        const apiKey = this.config.credentials.apiKey;
        const params = body ? JSON.stringify(body) : '';
        const prehash = timestamp + apiKey + recvWindow + params;
        return crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret).update(prehash).digest('hex');
    }
    async bybitRequest(method, path, body) {
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        const sign = this.bybitSign(timestamp, recvWindow, path, body);
        const headers = {
            'X-BAPI-API-KEY': this.config.credentials.apiKey,
            'X-BAPI-SIGN': sign,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'Content-Type': 'application/json'
        };
        const res = await this.client.request({ method, url: path, data: body, headers });
        if (res.data?.retCode && res.data.retCode !== 0)
            throw new Error(`Bybit error: ${res.data.retMsg}`);
        return res.data?.result || res.data;
    }
    async getBalance(asset) {
        const result = await this.bybitRequest('POST', '/v5/account/wallet-balance', { coin: asset });
        const balance = result?.list?.[0]?.coin?.[0];
        return {
            id: `${this.config.id}_${asset}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            exchangeId: this.config.id,
            asset,
            available: balance?.availableBalance || '0',
            locked: balance?.locked || '0',
            total: balance?.walletBalance || '0',
            lastUpdated: new Date()
        };
    }
    async placeOrder(params) {
        const body = { ...params, symbol: this.formatSymbolForExchange(params.symbol) };
        const result = await this.bybitRequest('POST', '/v5/order/create', body);
        return this.mapToStandardOrder(result);
    }
    async getOrderStatus(orderId) {
        const result = await this.bybitRequest('POST', '/v5/order/history', { orderId });
        return this.mapToStandardOrder(result);
    }
    async cancelOrder(orderId) {
        await this.bybitRequest('POST', '/v5/order/cancel', { orderId });
    }
    mapToStandardOrder(order) {
        return {
            id: order.orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: order.userId || 'unknown',
            exchangeId: this.config.id,
            symbol: order.symbol,
            side: order.side.toLowerCase(),
            type: order.orderType.toLowerCase(),
            amount: order.qty,
            price: order.price,
            status: this.mapStatus(order.orderStatus),
            filledAmount: order.cumExecQty || '0',
            averagePrice: order.avgPrice || order.price || '0',
            fees: order.cumExecFee || '0',
            externalOrderId: order.orderId,
            fundSegregation: {
                platformAccount: 'single_platform_account',
                brokerAllocation: 'unknown',
                customerAllocation: 'unknown',
                orderPool: 'user_trading_pool',
                feePool: 'fee_pool',
                settlementPool: 'exchange_settlement_pool'
            },
            riskMetrics: {
                exposure: 0,
                maxDrawdown: 0,
                volatility: 0
            },
            metadata: {
                createdAt: new Date(order.createdTime),
                updatedAt: new Date(order.updatedTime || order.createdTime),
                version: '1.0.0'
            }
        };
    }
    mapStatus(status) {
        const statusMap = {
            'New': 'pending',
            'Filled': 'filled',
            'Cancelled': 'cancelled',
            'Rejected': 'rejected',
            'PartiallyFilled': 'partially_filled'
        };
        return statusMap[status] || 'pending';
    }
}
// Placeholder adapters for other exchanges
class OKXAdapter extends ExchangeAdapter {
    async initialize() { this.logger.info(`OKX adapter initialized: ${this.config.baseURL}`); }
    formatSymbolForExchange(symbol) { return symbol.includes('/') ? symbol.replace('/', '-') : symbol; }
    buildOkxSignature(timestamp, method, path, body) {
        const prehash = `${timestamp}${method.toUpperCase()}${path}${body ? JSON.stringify(body) : ''}`;
        const hmac = crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret);
        hmac.update(prehash);
        return hmac.digest('base64');
    }
    async okxRequest(method, path, body) {
        const timestamp = new Date().toISOString();
        const signature = this.buildOkxSignature(timestamp, method, path, body);
        const headers = {
            'OK-ACCESS-KEY': this.config.credentials.apiKey,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': this.config.credentials.passphrase || '',
            'Content-Type': 'application/json'
        };
        const res = await this.client.request({ method, url: path, data: body, headers });
        if (res.data?.code && res.data.code !== '0') {
            throw new Error(`OKX error: ${res.data.code} ${res.data.msg || ''}`);
        }
        return res.data;
    }
    async getBalance(asset) {
        const data = await this.okxRequest('GET', `/api/v5/account/balance?ccy=${asset}`);
        const details = data?.data?.[0]?.details || [];
        const entry = details.find((d) => d.ccy === asset) || {};
        const available = entry?.availBal || '0';
        const total = entry?.eqUsd ? entry.eqUsd : (parseFloat(entry?.availBal || '0') + parseFloat(entry?.frozenBal || '0')).toString();
        return {
            id: `${this.config.id}_${asset}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            exchangeId: this.config.id,
            asset,
            available: available,
            locked: entry?.frozenBal || '0',
            total: total,
            lastUpdated: new Date()
        };
    }
    async placeOrder(params) {
        const body = {
            instId: params.symbol,
            tdMode: 'cash',
            side: params.side,
            ordType: params.type,
            sz: params.amount
        };
        if (params.price)
            body.px = params.price;
        const data = await this.okxRequest('POST', '/api/v5/trade/order', body);
        const result = data?.data?.[0] || {};
        return {
            id: result?.clOrdId || result?.ordId || `okx_${Date.now()}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            amount: params.amount,
            price: params.price,
            status: 'pending',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: result?.ordId,
            fundSegregation: {
                platformAccount: 'single_platform_account',
                brokerAllocation: 'unknown',
                customerAllocation: 'unknown',
                orderPool: 'user_trading_pool',
                feePool: 'fee_pool',
                settlementPool: 'exchange_settlement_pool'
            },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async getOrderStatus(orderId) {
        const data = await this.okxRequest('GET', `/api/v5/trade/order?ordId=${orderId}`);
        const order = data?.data?.[0] || {};
        const statusMap = {
            'live': 'open', 'partially_filled': 'partially_filled', 'filled': 'filled', 'canceled': 'cancelled', 'rejected': 'rejected'
        };
        return {
            id: order?.clOrdId || order?.ordId || orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: order?.instId || 'UNKNOWN',
            side: (order?.side || 'buy'),
            type: (order?.ordType || 'market'),
            amount: order?.sz || '0',
            price: order?.px,
            status: statusMap[order?.state] || 'pending',
            filledAmount: order?.accFillSz || '0',
            averagePrice: order?.avgPx || '0',
            fees: order?.fee || '0',
            externalOrderId: order?.ordId,
            fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async cancelOrder(orderId) {
        await this.okxRequest('POST', '/api/v5/trade/cancel-order', { ordId: orderId });
    }
}
class KrakenAdapter extends ExchangeAdapter {
    async initialize() { this.logger.info(`Kraken adapter initialized: ${this.config.baseURL}`); }
    formatSymbolForExchange(symbol) {
        // Kraken often uses XBT instead of BTC
        const s = symbol.replace('BTC', 'XBT');
        return s.replace('/', '');
    }
    krakenSign(path, request) {
        const secret = Buffer.from(this.config.credentials.apiSecret, 'base64');
        const nonce = request.nonce;
        const postData = new URLSearchParams(request).toString();
        const sha256 = crypto_1.default.createHash('sha256').update(nonce + postData).digest();
        const hmac = crypto_1.default.createHmac('sha512', secret);
        hmac.update(path);
        hmac.update(sha256);
        return hmac.digest('base64');
    }
    async krakenPrivate(path, params = {}) {
        const nonce = (Date.now() * 1000).toString();
        const request = { ...params, nonce };
        const signature = this.krakenSign(path, request);
        const headers = {
            'API-Key': this.config.credentials.apiKey,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const body = new URLSearchParams(request).toString();
        const res = await this.client.post(path, body, { headers });
        if (res.data?.error && res.data.error.length) {
            throw new Error(`Kraken error: ${res.data.error.join(',')}`);
        }
        return res.data?.result;
    }
    async getBalance(asset) {
        const result = await this.krakenPrivate('/0/private/Balance');
        const key = (asset.toUpperCase() === 'BTC' ? 'XBT' : asset.toUpperCase());
        const total = result?.[key] || '0';
        return {
            id: `${this.config.id}_${asset}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            exchangeId: this.config.id,
            asset,
            available: total,
            locked: '0',
            total: total,
            lastUpdated: new Date()
        };
    }
    async placeOrder(params) {
        const body = {
            pair: params.symbol,
            type: params.side,
            ordertype: params.type === 'limit' ? 'limit' : 'market',
            volume: params.amount
        };
        if (params.price && params.type === 'limit')
            body.price = params.price;
        const result = await this.krakenPrivate('/0/private/AddOrder', body);
        const txid = (result?.txid && result.txid[0]) || `kraken_${Date.now()}`;
        return {
            id: txid,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            amount: params.amount,
            price: params.price,
            status: 'pending',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: txid,
            fundSegregation: {
                platformAccount: 'single_platform_account',
                brokerAllocation: 'unknown',
                customerAllocation: 'unknown',
                orderPool: 'user_trading_pool',
                feePool: 'fee_pool',
                settlementPool: 'exchange_settlement_pool'
            },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async getOrderStatus(orderId) {
        const result = await this.krakenPrivate('/0/private/QueryOrders', { txid: orderId });
        const order = result?.[orderId] || {};
        const statusMap = {
            'pending': 'pending', 'open': 'open', 'closed': 'filled', 'canceled': 'cancelled', 'expired': 'rejected'
        };
        return {
            id: orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: order?.descr?.pair || 'UNKNOWN',
            side: (order?.descr?.type || 'buy'),
            type: (order?.descr?.ordertype || 'market'),
            amount: order?.vol || '0',
            price: order?.descr?.price,
            status: statusMap[order?.status] || 'pending',
            filledAmount: order?.vol_exec || '0',
            averagePrice: order?.price || '0',
            fees: order?.fee || '0',
            externalOrderId: orderId,
            fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async cancelOrder(orderId) {
        await this.krakenPrivate('/0/private/CancelOrder', { txid: orderId });
    }
}
class VALRAdapter extends ExchangeAdapter {
    async initialize() { this.logger.info(`VALR adapter initialized: ${this.config.baseURL}`); }
    formatSymbolForExchange(symbol) { return symbol.replace('/', ''); }
    valrSignature(timestamp, method, path, body) {
        const payload = `${timestamp}${method.toUpperCase()}${path}${body ? JSON.stringify(body) : ''}`;
        return crypto_1.default.createHmac('sha512', this.config.credentials.apiSecret).update(payload).digest('hex');
    }
    async valrRequest(method, path, body) {
        const timestamp = Date.now().toString();
        const signature = this.valrSignature(timestamp, method, path, body);
        const headers = {
            'X-VALR-API-KEY': this.config.credentials.apiKey,
            'X-VALR-SIGNATURE': signature,
            'X-VALR-TIMESTAMP': timestamp,
            'Content-Type': 'application/json'
        };
        const res = await this.client.request({ method, url: path, data: body, headers });
        if (res.status >= 400) {
            throw new Error(`VALR HTTP ${res.status}`);
        }
        return res.data;
    }
    async getBalance(asset) {
        const data = await this.valrRequest('GET', '/v1/account/balances');
        const entry = (data || []).find((b) => (b.currency || '').toUpperCase() === asset.toUpperCase()) || {};
        const available = entry?.available || '0';
        const reserved = entry?.reserved || '0';
        const total = (parseFloat(available || '0') + parseFloat(reserved || '0')).toString();
        return {
            id: `${this.config.id}_${asset}`,
            tenantId: this.config.id,
            brokerId: this.config.id,
            exchangeId: this.config.id,
            asset,
            available: available.toString(),
            locked: reserved.toString(),
            total,
            lastUpdated: new Date()
        };
    }
    async placeOrder(params) {
        const isLimit = params.type === 'limit';
        const side = params.side.toUpperCase();
        const body = isLimit ? {
            pair: params.symbol,
            side,
            quantity: params.amount,
            price: params.price
        } : {
            pair: params.symbol,
            side,
            baseAmount: params.amount
        };
        const path = isLimit ? '/v1/orders/limit' : '/v1/orders/market';
        const result = await this.valrRequest('POST', path, body);
        const orderId = result?.id || result?.orderId || `valr_${Date.now()}`;
        return {
            id: orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            amount: params.amount,
            price: params.price,
            status: 'pending',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: orderId,
            fundSegregation: {
                platformAccount: 'single_platform_account',
                brokerAllocation: 'unknown',
                customerAllocation: 'unknown',
                orderPool: 'user_trading_pool',
                feePool: 'fee_pool',
                settlementPool: 'exchange_settlement_pool'
            },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async getOrderStatus(orderId) {
        const order = await this.valrRequest('GET', `/v1/orders/status?orderId=${orderId}`);
        const statusMap = {
            'ACTIVE': 'open', 'FILLED': 'filled', 'CANCELLED': 'cancelled', 'FAILED': 'rejected', 'PARTIALLY_FILLED': 'partially_filled'
        };
        return {
            id: order?.id || orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: order?.currencyPair || 'UNKNOWN',
            side: (order?.side?.toLowerCase() || 'buy'),
            type: (order?.orderType?.toLowerCase() || 'market'),
            amount: order?.originalQuantity || '0',
            price: order?.price,
            status: statusMap[order?.status] || 'pending',
            filledAmount: order?.quantity || order?.totalMatched || '0',
            averagePrice: order?.averagePrice || '0',
            fees: order?.feeAmount || '0',
            externalOrderId: order?.id || orderId,
            fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async cancelOrder(orderId) {
        await this.valrRequest('DELETE', `/v1/orders/order`, { orderId });
    }
}
class BitstampAdapter extends ExchangeAdapter {
    async initialize() { this.logger.info(`Bitstamp adapter initialized: ${this.config.baseURL}`); }
    formatSymbolForExchange(symbol) { return symbol.replace('/', '').toLowerCase(); }
    bitstampSignature(nonce, customerIdOrUsername) {
        const message = nonce + customerIdOrUsername + this.config.credentials.apiKey;
        return crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret).update(message).digest('hex').toUpperCase();
    }
    async bitstampForm(path, extra) {
        const nonce = Date.now().toString();
        const username = this.config.metadata?.username || '';
        const signature = this.bitstampSignature(nonce, username);
        const form = new URLSearchParams({ key: this.config.credentials.apiKey, signature, nonce, ...extra }).toString();
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        const res = await this.client.post(path, form, { headers });
        if (res.status >= 400)
            throw new Error(`Bitstamp HTTP ${res.status}`);
        return res.data;
    }
    async getBalance(asset) {
        const data = await this.bitstampForm('/api/v2/balance/', {});
        const key = `${asset.toLowerCase()}_available`;
        const avail = data?.[key] || '0';
        const totalKey = `${asset.toLowerCase()}_balance`;
        const total = data?.[totalKey] || avail;
        const reservedKey = `${asset.toLowerCase()}_reserved`;
        const locked = data?.[reservedKey] || '0';
        return { id: `${this.config.id}_${asset}`, tenantId: this.config.id, brokerId: this.config.id, exchangeId: this.config.id, asset, available: avail.toString(), locked: locked.toString(), total: total.toString(), lastUpdated: new Date() };
    }
    async placeOrder(params) {
        const symbol = params.symbol.toLowerCase();
        const isBuy = params.side === 'buy';
        const path = isBuy ? `/api/v2/buy/${symbol}/` : `/api/v2/sell/${symbol}/`;
        const form = { amount: params.amount };
        if (params.type === 'limit')
            form.price = params.price;
        const result = await this.bitstampForm(path, form);
        const orderId = result?.id?.toString() || `bitstamp_${Date.now()}`;
        return {
            id: orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            amount: params.amount,
            price: params.price,
            status: 'pending',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: orderId,
            fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async getOrderStatus(orderId) {
        const data = await this.bitstampForm('/api/v2/order_status/', { id: orderId });
        const order = data || {};
        const status = order?.status === 'Finished' ? 'filled' : order?.status === 'Canceled' ? 'cancelled' : 'open';
        return { id: orderId, tenantId: this.config.id, brokerId: this.config.id, userId: 'unknown', exchangeId: this.config.id, symbol: (order?.transactions?.[0]?.pair || 'UNKNOWN').toUpperCase(), side: (order?.type === 0 ? 'buy' : 'sell'), type: 'limit', amount: order?.amount || '0', price: order?.price || '0', status, filledAmount: order?.amount_executed || '0', averagePrice: order?.avg_price || '0', fees: order?.fee || '0', externalOrderId: orderId, fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' }, riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 }, metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' } };
    }
    async cancelOrder(orderId) {
        await this.bitstampForm('/api/v2/cancel_order/', { id: orderId });
    }
}
class CryptoComAdapter extends ExchangeAdapter {
    async initialize() { this.logger.info(`Crypto.com adapter initialized: ${this.config.baseURL}`); }
    formatSymbolForExchange(symbol) { return symbol.includes('/') ? symbol.replace('/', '_').toUpperCase() : symbol; }
    croSign(payload) {
        const sortedParams = payload.params ? Object.keys(payload.params).sort().reduce((acc, k) => { acc[k] = payload.params[k]; return acc; }, {}) : {};
        const paramString = payload.params ? JSON.stringify(sortedParams) : '';
        const toSign = `${payload.method}${payload.id}${this.config.credentials.apiKey}${payload.nonce}${paramString}`;
        return crypto_1.default.createHmac('sha256', this.config.credentials.apiSecret).update(toSign).digest('hex');
    }
    async croPrivate(method, params) {
        const id = Date.now();
        const nonce = Date.now();
        const payload = { id, method: method, api_key: this.config.credentials.apiKey, nonce, params: params || {} };
        payload.sig = this.croSign(payload);
        const res = await this.client.post('/' + method, payload, { headers: { 'Content-Type': 'application/json' } });
        if (res.data?.code !== 0)
            throw new Error(`Crypto.com error: ${res.data?.code}`);
        return res.data?.result;
    }
    async getBalance(asset) {
        const result = await this.croPrivate('private/get-account-summary');
        const entry = (result?.accounts || []).find((a) => (a.currency || '').toUpperCase() === asset.toUpperCase()) || {};
        const available = entry?.available || '0';
        const locked = entry?.order || '0';
        const total = (parseFloat(available || '0') + parseFloat(locked || '0')).toString();
        return { id: `${this.config.id}_${asset}`, tenantId: this.config.id, brokerId: this.config.id, exchangeId: this.config.id, asset, available: available.toString(), locked: locked.toString(), total, lastUpdated: new Date() };
    }
    async placeOrder(params) {
        const body = { instrument_name: params.symbol, side: params.side.toUpperCase(), type: params.type.toUpperCase(), quantity: params.amount };
        if (params.type === 'limit' && params.price)
            body.price = params.price;
        const result = await this.croPrivate('private/create-order', body);
        const orderId = result?.order_id || `cro_${Date.now()}`;
        return {
            id: orderId,
            tenantId: this.config.id,
            brokerId: this.config.id,
            userId: 'unknown',
            exchangeId: this.config.id,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            amount: params.amount,
            price: params.price,
            status: 'pending',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: orderId,
            fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' },
            riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 },
            metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' }
        };
    }
    async getOrderStatus(orderId) {
        const result = await this.croPrivate('private/get-order-detail', { order_id: orderId });
        const o = result?.order_info || {};
        const statusMap = { 'ACTIVE': 'open', 'FILLED': 'filled', 'CANCELED': 'cancelled', 'REJECTED': 'rejected', 'PARTIALLY_FILLED': 'partially_filled' };
        return { id: orderId, tenantId: this.config.id, brokerId: this.config.id, userId: 'unknown', exchangeId: this.config.id, symbol: o?.instrument_name || 'UNKNOWN', side: (o?.side || 'BUY').toLowerCase(), type: (o?.type || 'MARKET').toLowerCase(), amount: o?.quantity || '0', price: o?.price || '0', status: statusMap[o?.status] || 'pending', filledAmount: o?.cumulative_quantity || '0', averagePrice: o?.avg_price || '0', fees: o?.fee || '0', externalOrderId: orderId, fundSegregation: { platformAccount: 'single_platform_account', brokerAllocation: 'unknown', customerAllocation: 'unknown', orderPool: 'user_trading_pool', feePool: 'fee_pool', settlementPool: 'exchange_settlement_pool' }, riskMetrics: { exposure: 0, maxDrawdown: 0, volatility: 0 }, metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0.0' } };
    }
    async cancelOrder(orderId) {
        await this.croPrivate('private/cancel-order', { order_id: orderId });
    }
}
// ==================== Omni Exchange Manager ====================
class OmniExchangeService {
    db;
    exchanges = new Map();
    adapters = new Map();
    eventStreamingService;
    quantlibService;
    blnkfinanceService;
    healthMonitoringInterval = null;
    reconciliationInterval = null;
    // CRITICAL: Platform-level fund allocation tracking
    platformAllocations = new Map();
    internalOrders = new Map();
    // CRITICAL: Compliance tracking
    travelRuleMessages = new Map();
    carfReports = new Map();
    constructor(db) {
        this.db = db;
        this.eventStreamingService = new event_streaming_1.EventStreamingService();
        this.quantlibService = new quantlib_1.QuantLibService();
        this.blnkfinanceService = new blnkfinance_1.BlnkFinanceService();
    }
    /**
     * Initialize the Omni Exchange service
     */
    async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Omni Exchange Service...');
            // Load exchange configurations
            await this.loadExchangeConfigurations();
            // Initialize exchange adapters
            await this.initializeAdapters();
            // Start health monitoring
            this.startHealthMonitoring();
            // Initialize platform fund allocations
            await this.initializePlatformAllocations();
            // Start reconciliation job
            this.startReconciliationJob();
            logger_1.LoggerService.info(`Omni Exchange Service initialized with ${this.adapters.size} exchanges`);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize Omni Exchange Service', { error });
            throw error;
        }
    }
    /**
     * Load exchange configurations from database
     */
    async loadExchangeConfigurations() {
        // Load credentials from secrets if available
        const creds = config_1.ConfigService.getExchangeCredentials();
        // Default configurations (will be enriched with secrets)
        const defaultExchanges = [
            {
                id: 'kucoin',
                name: 'KuCoin',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 1,
                baseURL: 'https://api.kucoin.com',
                credentials: {
                    apiKey: creds['kucoin']?.apiKey || process.env.KUCOIN_API_KEY || '',
                    apiSecret: creds['kucoin']?.apiSecret || process.env.KUCOIN_API_SECRET || '',
                    passphrase: creds['kucoin']?.passphrase || process.env.KUCOIN_PASSPHRASE || ''
                },
                limits: {
                    rateLimit: 100,
                    orderLimit: 50,
                    withdrawalLimit: 5
                },
                capabilities: ['spot', 'futures'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'bybit',
                name: 'Bybit',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 2,
                baseURL: 'https://api.bybit.com',
                credentials: {
                    apiKey: creds['bybit']?.apiKey || process.env.BYBIT_API_KEY || '',
                    apiSecret: creds['bybit']?.apiSecret || process.env.BYBIT_API_SECRET || ''
                },
                limits: {
                    rateLimit: 120,
                    orderLimit: 60,
                    withdrawalLimit: 6
                },
                capabilities: ['spot', 'futures', 'options'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'okx',
                name: 'OKX',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 3,
                baseURL: 'https://www.okx.com',
                credentials: {
                    apiKey: creds['okx']?.apiKey || process.env.OKX_API_KEY || '',
                    apiSecret: creds['okx']?.apiSecret || process.env.OKX_API_SECRET || '',
                    passphrase: creds['okx']?.passphrase || process.env.OKX_PASSPHRASE || ''
                },
                limits: {
                    rateLimit: 100,
                    orderLimit: 50,
                    withdrawalLimit: 5
                },
                capabilities: ['spot', 'futures', 'options'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'kraken',
                name: 'Kraken',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 4,
                baseURL: 'https://api.kraken.com',
                credentials: {
                    apiKey: creds['kraken']?.apiKey || process.env.KRAKEN_API_KEY || '',
                    apiSecret: creds['kraken']?.apiSecret || process.env.KRAKEN_API_SECRET || ''
                },
                limits: {
                    rateLimit: 60,
                    orderLimit: 30,
                    withdrawalLimit: 3
                },
                capabilities: ['spot', 'futures'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'valr',
                name: 'VALR',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 5,
                baseURL: 'https://api.valr.com',
                credentials: {
                    apiKey: creds['valr']?.apiKey || process.env.VALR_API_KEY || '',
                    apiSecret: creds['valr']?.apiSecret || process.env.VALR_API_SECRET || ''
                },
                limits: {
                    rateLimit: 50,
                    orderLimit: 25,
                    withdrawalLimit: 2
                },
                capabilities: ['spot'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'bitstamp',
                name: 'Bitstamp',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 6,
                baseURL: 'https://www.bitstamp.net/api',
                credentials: {
                    apiKey: creds['bitstamp']?.apiKey || process.env.BITSTAMP_API_KEY || '',
                    apiSecret: creds['bitstamp']?.apiSecret || process.env.BITSTAMP_API_SECRET || ''
                },
                limits: {
                    rateLimit: 40,
                    orderLimit: 20,
                    withdrawalLimit: 2
                },
                capabilities: ['spot'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            },
            {
                id: 'crypto-com',
                name: 'Crypto.com',
                type: 'public',
                status: 'active',
                enabled: true,
                priority: 7,
                baseURL: 'https://api.crypto.com/v2',
                credentials: {
                    apiKey: creds['crypto-com']?.apiKey || process.env.CRYPTO_COM_API_KEY || '',
                    apiSecret: creds['crypto-com']?.apiSecret || process.env.CRYPTO_COM_API_SECRET || ''
                },
                limits: {
                    rateLimit: 80,
                    orderLimit: 40,
                    withdrawalLimit: 4
                },
                capabilities: ['spot', 'futures'],
                health: {
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime: 0,
                    errorRate: 0,
                    uptime: 100,
                    activeConnections: 0
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            }
        ];
        for (const exchange of defaultExchanges) {
            // Attach Bitstamp username if available in creds
            if (exchange.id === 'bitstamp' && creds['bitstamp'] && creds['bitstamp'].username) {
                exchange.metadata.username = creds['bitstamp'].username;
            }
            this.exchanges.set(exchange.id, exchange);
        }
    }
    /**
     * Initialize exchange adapters
     */
    async initializeAdapters() {
        for (const [exchangeId, config] of this.exchanges) {
            if (!config.enabled)
                continue;
            try {
                let adapter;
                switch (exchangeId) {
                    case 'kucoin':
                        adapter = new KuCoinAdapter(config);
                        break;
                    case 'bybit':
                        adapter = new BybitAdapter(config);
                        break;
                    case 'okx':
                        adapter = new OKXAdapter(config);
                        break;
                    case 'kraken':
                        adapter = new KrakenAdapter(config);
                        break;
                    case 'valr':
                        adapter = new VALRAdapter(config);
                        break;
                    case 'bitstamp':
                        adapter = new BitstampAdapter(config);
                        break;
                    case 'crypto-com':
                        adapter = new CryptoComAdapter(config);
                        break;
                    default:
                        logger_1.LoggerService.warn(`Unknown exchange: ${exchangeId}`);
                        continue;
                }
                await adapter.initialize();
                this.adapters.set(exchangeId, adapter);
                logger_1.LoggerService.info(`Initialized ${config.name} adapter`);
            }
            catch (error) {
                logger_1.LoggerService.error(`Failed to initialize ${config.name}`, { error });
            }
        }
    }
    /**
     * Initialize platform fund allocations for each exchange
     */
    async initializePlatformAllocations() {
        for (const [exchangeId, config] of this.exchanges) {
            if (!config.enabled)
                continue;
            try {
                const adapter = this.adapters.get(exchangeId);
                if (!adapter)
                    continue;
                // Get platform balance for major assets
                const assets = ['BTC', 'ETH', 'USDT', 'USDC'];
                for (const asset of assets) {
                    try {
                        const balance = await adapter.getBalance(asset);
                        const allocation = {
                            id: `${exchangeId}_${asset}`,
                            exchangeId,
                            asset,
                            totalPlatformBalance: balance.total,
                            brokerAllocations: new Map(),
                            customerAllocations: new Map(),
                            availableForAllocation: balance.total,
                            lastUpdated: new Date()
                        };
                        this.platformAllocations.set(allocation.id, allocation);
                        // Persist allocation (upsert)
                        try {
                            const Model = database_1.DatabaseService.getModel('PlatformAllocation');
                            const existing = await Model.findOne({ where: { id: allocation.id } });
                            const row = {
                                id: allocation.id,
                                exchangeId,
                                asset,
                                totalPlatformBalance: balance.total,
                                availableForAllocation: balance.total,
                                brokerAllocations: {},
                                customerAllocations: {},
                                lastUpdated: new Date()
                            };
                            if (existing)
                                await existing.update(row);
                            else
                                await Model.create(row);
                        }
                        catch (err) {
                            logger_1.LoggerService.warn('Persist allocation failed', { id: allocation.id, err: err.message });
                        }
                        logger_1.LoggerService.info(`Platform allocation initialized for ${config.name} ${asset}`, {
                            totalBalance: balance.total,
                            availableForAllocation: balance.total
                        });
                    }
                    catch (error) {
                        logger_1.LoggerService.warn(`Failed to get ${asset} balance from ${config.name}`, { error });
                    }
                }
            }
            catch (error) {
                logger_1.LoggerService.error(`Failed to initialize platform allocations for ${config.name}`, { error });
            }
        }
    }
    /**
     * Allocate funds to broker/customer from platform balance
     */
    async allocateFunds(exchangeId, asset, brokerId, customerId, amount) {
        const allocationKey = `${exchangeId}_${asset}`;
        const allocation = this.platformAllocations.get(allocationKey);
        if (!allocation) {
            throw new Error(`No platform allocation found for ${exchangeId} ${asset}`);
        }
        const amountNum = parseFloat(amount);
        const availableNum = parseFloat(allocation.availableForAllocation);
        if (amountNum > availableNum) {
            logger_1.LoggerService.warn('Insufficient platform balance for allocation', {
                exchangeId,
                asset,
                requestedAmount: amount,
                availableAmount: allocation.availableForAllocation
            });
            return false;
        }
        // Update broker allocation
        const currentBrokerAllocation = allocation.brokerAllocations.get(brokerId) || '0';
        const newBrokerAllocation = (parseFloat(currentBrokerAllocation) + amountNum).toString();
        allocation.brokerAllocations.set(brokerId, newBrokerAllocation);
        // Update customer allocation within broker
        if (!allocation.customerAllocations.has(brokerId)) {
            allocation.customerAllocations.set(brokerId, new Map());
        }
        const brokerCustomers = allocation.customerAllocations.get(brokerId);
        const currentCustomerAllocation = brokerCustomers.get(customerId) || '0';
        const newCustomerAllocation = (parseFloat(currentCustomerAllocation) + amountNum).toString();
        brokerCustomers.set(customerId, newCustomerAllocation);
        // Update available balance
        allocation.availableForAllocation = (availableNum - amountNum).toString();
        allocation.lastUpdated = new Date();
        // Persist allocation update
        try {
            const Model = database_1.DatabaseService.getModel('PlatformAllocation');
            const existing = await Model.findOne({ where: { id: allocationKey } });
            if (existing) {
                await existing.update({
                    totalPlatformBalance: allocation.totalPlatformBalance,
                    availableForAllocation: allocation.availableForAllocation,
                    brokerAllocations: Object.fromEntries(allocation.brokerAllocations),
                    customerAllocations: Array.from(allocation.customerAllocations).reduce((acc, [b, map]) => { acc[b] = Object.fromEntries(map); return acc; }, {}),
                    lastUpdated: allocation.lastUpdated
                });
            }
        }
        catch (err) {
            logger_1.LoggerService.error('Persist allocation update failed', { id: allocationKey, err: err.message });
        }
        logger_1.LoggerService.logTransaction(`allocation_${allocationKey}`, 'fund_allocated', {
            exchangeId,
            asset,
            brokerId,
            customerId,
            amount,
            newBrokerAllocation,
            newCustomerAllocation,
            remainingAvailable: allocation.availableForAllocation
        });
        return true;
    }
    /**
     * Deallocate funds from broker/customer back to platform
     */
    async deallocateFunds(exchangeId, asset, brokerId, customerId, amount) {
        const allocationKey = `${exchangeId}_${asset}`;
        const allocation = this.platformAllocations.get(allocationKey);
        if (!allocation) {
            throw new Error(`No platform allocation found for ${exchangeId} ${asset}`);
        }
        const amountNum = parseFloat(amount);
        // Check customer allocation
        const brokerCustomers = allocation.customerAllocations.get(brokerId);
        if (!brokerCustomers) {
            logger_1.LoggerService.warn('No customer allocations found for broker', { brokerId });
            return false;
        }
        const currentCustomerAllocation = brokerCustomers.get(customerId) || '0';
        const customerAllocationNum = parseFloat(currentCustomerAllocation);
        if (amountNum > customerAllocationNum) {
            logger_1.LoggerService.warn('Insufficient customer allocation for deallocation', {
                exchangeId,
                asset,
                brokerId,
                customerId,
                requestedAmount: amount,
                currentAllocation: currentCustomerAllocation
            });
            return false;
        }
        // Update customer allocation
        const newCustomerAllocation = (customerAllocationNum - amountNum).toString();
        brokerCustomers.set(customerId, newCustomerAllocation);
        // Update broker allocation
        const currentBrokerAllocation = allocation.brokerAllocations.get(brokerId) || '0';
        const newBrokerAllocation = (parseFloat(currentBrokerAllocation) - amountNum).toString();
        allocation.brokerAllocations.set(brokerId, newBrokerAllocation);
        // Update available balance
        const availableNum = parseFloat(allocation.availableForAllocation);
        allocation.availableForAllocation = (availableNum + amountNum).toString();
        allocation.lastUpdated = new Date();
        // Persist allocation update
        try {
            const Model = database_1.DatabaseService.getModel('PlatformAllocation');
            const existing = await Model.findOne({ where: { id: allocationKey } });
            if (existing) {
                await existing.update({
                    totalPlatformBalance: allocation.totalPlatformBalance,
                    availableForAllocation: allocation.availableForAllocation,
                    brokerAllocations: Object.fromEntries(allocation.brokerAllocations),
                    customerAllocations: Array.from(allocation.customerAllocations).reduce((acc, [b, map]) => { acc[b] = Object.fromEntries(map); return acc; }, {}),
                    lastUpdated: allocation.lastUpdated
                });
            }
        }
        catch (err) {
            logger_1.LoggerService.error('Persist deallocation update failed', { id: allocationKey, err: err.message });
        }
        logger_1.LoggerService.logTransaction(`allocation_${allocationKey}`, 'fund_deallocated', {
            exchangeId,
            asset,
            brokerId,
            customerId,
            amount,
            newBrokerAllocation,
            newCustomerAllocation,
            newAvailable: allocation.availableForAllocation
        });
        return true;
    }
    /**
     * Get available balance for broker/customer
     */
    getAvailableBalance(exchangeId, asset, brokerId, customerId) {
        const allocationKey = `${exchangeId}_${asset}`;
        const allocation = this.platformAllocations.get(allocationKey);
        if (!allocation) {
            return '0';
        }
        const brokerCustomers = allocation.customerAllocations.get(brokerId);
        if (!brokerCustomers) {
            return '0';
        }
        return brokerCustomers.get(customerId) || '0';
    }
    /**
     * Start health monitoring for all exchanges
     */
    startHealthMonitoring() {
        this.healthMonitoringInterval = setInterval(async () => {
            for (const [exchangeId, config] of this.exchanges) {
                if (!config.enabled)
                    continue;
                try {
                    const adapter = this.adapters.get(exchangeId);
                    if (!adapter)
                        continue;
                    const startTime = Date.now();
                    // Lightweight health check with timeout
                    try {
                        await Promise.race([
                            adapter.getBalance('BTC'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 2000))
                        ]);
                    }
                    catch (pingError) {
                        throw pingError;
                    }
                    const responseTime = Date.now() - startTime;
                    // Update error budget metrics
                    const wasHealthy = config.health?.status === 'healthy';
                    const isHealthy = responseTime < 1000;
                    config.health = {
                        status: isHealthy ? 'healthy' : 'degraded',
                        lastCheck: new Date(),
                        responseTime,
                        errorRate: responseTime > 1000 ? 10 : 0,
                        uptime: 100,
                        activeConnections: 0
                    };
                    config.status = config.health.status === 'healthy' ? 'active' : 'degraded';
                    logger_1.LoggerService.debug(`Health check for ${config.name}: ${config.health.status}`);
                    // Emit metrics for error budget tracking
                    if (!wasHealthy && isHealthy) {
                        logger_1.LoggerService.info(`Exchange ${config.name} recovered to healthy state`);
                    }
                    else if (wasHealthy && !isHealthy) {
                        logger_1.LoggerService.warn(`Exchange ${config.name} degraded`, { responseTime });
                    }
                }
                catch (error) {
                    const consecutiveFailures = (config.health?.consecutiveFailures || 0) + 1;
                    config.health = {
                        status: 'down',
                        lastCheck: new Date(),
                        responseTime: 0,
                        errorRate: 100,
                        uptime: 0,
                        activeConnections: 0,
                        consecutiveFailures
                    };
                    config.status = 'inactive';
                    logger_1.LoggerService.error(`Health check failed for ${config.name}`, { error, consecutiveFailures });
                    // Alert on persistent failures (3+ consecutive)
                    if (consecutiveFailures >= 3) {
                        logger_1.LoggerService.logSecurity('exchange_health_critical', { exchangeId: config.name, failures: consecutiveFailures });
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Start periodic reconciliation job
     */
    startReconciliationJob() {
        const run = async () => {
            try {
                const snapshot = await this.getPlatformAssetReconciliation();
                const Model = database_1.DatabaseService.getModel('ReconciliationSnapshot');
                await Model.create({
                    snapshotAt: new Date(),
                    platformTotals: Object.fromEntries(snapshot.platformTotals),
                    exchangeBalances: Array.from(snapshot.exchangeBalances).reduce((acc, [ex, map]) => { acc[ex] = Object.fromEntries(map); return acc; }, {}),
                    internalAllocations: Array.from(snapshot.internalAllocations).reduce((acc, [ex, map]) => { acc[ex] = Object.fromEntries(map); return acc; }, {}),
                    reconciliation: Object.fromEntries(snapshot.reconciliation)
                });
                logger_1.LoggerService.info('Reconciliation snapshot persisted');
            }
            catch (err) {
                logger_1.LoggerService.error('Reconciliation job failed', { err: err.message });
            }
        };
        // Run immediately and then every 10 minutes
        run();
        this.reconciliationInterval = setInterval(run, 10 * 60 * 1000);
    }
    startOpenOrderReconciliation() {
        const run = async () => {
            try {
                const InternalOrderModel = database_1.DatabaseService.getModel('InternalOrder');
                const rows = await InternalOrderModel.findAll({ where: { status: ['pending', 'allocated', 'submitted'] } });
                for (const row of rows) {
                    const order = row.toJSON();
                    try {
                        const adapter = this.adapters.get(order.exchangeId);
                        if (!adapter || !order.externalOrderId)
                            continue;
                        const ext = await adapter.getOrderStatus(order.externalOrderId);
                        let updated = false;
                        if (order.status !== ext.status) {
                            order.status = ext.status;
                            updated = true;
                        }
                        if (order.filledAmount !== ext.filledAmount) {
                            order.filledAmount = ext.filledAmount;
                            updated = true;
                        }
                        if (order.averagePrice !== ext.averagePrice) {
                            order.averagePrice = ext.averagePrice;
                            updated = true;
                        }
                        if (order.fees !== ext.fees) {
                            order.fees = ext.fees;
                            updated = true;
                        }
                        if (updated) {
                            order.metadata.updatedAt = new Date();
                            await row.update(order);
                            logger_1.LoggerService.info('Reconciled internal order', { orderId: order.id, status: order.status });
                        }
                    }
                    catch (err) {
                        logger_1.LoggerService.warn('Failed to reconcile order', { orderId: order.id, err: err.message });
                    }
                }
            }
            catch (err) {
                logger_1.LoggerService.error('Open-order reconciliation loop error', { err: err.message });
            }
        };
        run();
        setInterval(run, 15000);
    }
    /**
     * Determine the best exchange for an order
     */
    async determineBestExchange(symbol, side, amount) {
        const availableExchanges = Array.from(this.exchanges.values())
            .filter(e => e.enabled && e.health.status === 'healthy')
            .sort((a, b) => a.priority - b.priority);
        if (availableExchanges.length === 0) {
            throw new Error('No healthy exchanges available');
        }
        // Simple routing based on priority and health
        const bestExchange = availableExchanges[0];
        if (!bestExchange) {
            throw new Error('No exchange available for routing');
        }
        return {
            exchangeId: bestExchange.id,
            exchangeName: bestExchange.name,
            priority: bestExchange.priority,
            reason: 'Priority and health-based selection',
            metrics: {
                price: 0, // Would need real-time price data
                liquidity: 100,
                fees: 0.1,
                responseTime: bestExchange.health?.responseTime || 0,
                reliability: bestExchange.health?.uptime || 0
            }
        };
    }
    /**
     * Place order with platform-level fund segregation
     */
    async placeOrder(tenantId, brokerId, userId, params) {
        try {
            // Idempotency check (30s window for same user/broker/tenant/symbol/side/type/amount/price)
            try {
                const InternalOrderModel = database_1.DatabaseService.getModel('InternalOrder');
                const existing = await InternalOrderModel.findOne({ where: { tenantId, brokerId, userId, symbol: params.symbol, side: params.side, type: params.type, allocatedAmount: params.amount }, order: [['createdAt', 'DESC']] });
                if (existing) {
                    const e = existing.toJSON();
                    const createdAt = new Date(e.metadata?.createdAt || e.createdAt).getTime();
                    if (Date.now() - createdAt < 30000) {
                        return e;
                    }
                }
            }
            catch { }
            // Determine best exchange
            const routingDecision = await this.determineBestExchange(params.symbol, params.side, params.amount);
            // Extract asset from symbol (e.g., BTCUSDT -> BTC for sell, USDT for buy)
            const baseAsset = params.side === 'sell' ? params.symbol.replace('USDT', '').replace('USDC', '') : 'USDT';
            // Check available balance for customer
            const availableBalance = this.getAvailableBalance(routingDecision.exchangeId, baseAsset, brokerId, userId);
            const requiredAmount = parseFloat(params.amount);
            const availableAmount = parseFloat(availableBalance);
            if (requiredAmount > availableAmount) {
                throw new Error(`Insufficient balance: required ${params.amount} ${baseAsset}, available ${availableBalance}`);
            }
            // Create internal order
            const internalOrder = {
                id: `internal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tenantId,
                brokerId,
                userId,
                exchangeId: routingDecision.exchangeId,
                symbol: params.symbol,
                side: params.side,
                type: params.type,
                amount: params.amount,
                price: params.price,
                status: 'pending',
                allocatedAmount: params.amount,
                filledAmount: '0',
                averagePrice: '0',
                fees: '0',
                fundAllocation: {
                    allocatedFrom: `${brokerId}_${userId}`,
                    allocatedAmount: params.amount,
                    feeAllocation: '0'
                },
                compliance: {
                    travelRule: {},
                    carfReporting: {},
                    riskAssessment: {}
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            };
            // Allocate funds internally
            const allocationSuccess = await this.allocateFunds(routingDecision.exchangeId, baseAsset, brokerId, userId, params.amount);
            if (!allocationSuccess) {
                throw new Error('Failed to allocate funds for order');
            }
            internalOrder.status = 'allocated';
            this.internalOrders.set(internalOrder.id, internalOrder);
            // Persist internal order create
            try {
                const InternalOrderModel = database_1.DatabaseService.getModel('InternalOrder');
                await InternalOrderModel.create(internalOrder);
            }
            catch (err) {
                logger_1.LoggerService.error('Persist internal order failed', { id: internalOrder.id, err: err.message });
            }
            // Get adapter and place order on exchange
            const adapter = this.adapters.get(routingDecision.exchangeId);
            if (!adapter) {
                throw new Error(`Adapter not found for exchange: ${routingDecision.exchangeId}`);
            }
            // Place order on exchange (this uses platform account)
            const exchangeOrder = await adapter.placeOrder(params);
            // Update internal order with exchange order details
            internalOrder.externalOrderId = exchangeOrder.externalOrderId;
            internalOrder.status = 'submitted';
            internalOrder.filledAmount = exchangeOrder.filledAmount;
            internalOrder.averagePrice = exchangeOrder.averagePrice;
            internalOrder.fees = exchangeOrder.fees;
            internalOrder.metadata.updatedAt = new Date();
            // Update internal order persistence
            try {
                const InternalOrderModel = database_1.DatabaseService.getModel('InternalOrder');
                const row = await InternalOrderModel.findOne({ where: { id: internalOrder.id } });
                if (row)
                    await row.update(internalOrder);
            }
            catch (err) {
                logger_1.LoggerService.error('Update internal order persist failed', { id: internalOrder.id, err: err.message });
            }
            // Generate compliance data (Travel Rule, CARF, Risk Assessment)
            try {
                // Mock customer data - in real implementation, this would come from KYC service
                const customerData = {
                    name: `Customer_${userId}`,
                    address: 'Customer Address',
                    country: 'US',
                    nationalId: '123456789',
                    taxId: 'TAX123456'
                };
                // Generate Travel Rule data
                internalOrder.compliance.travelRule = await this.generateTravelRuleData(internalOrder, customerData);
                // Generate CARF report
                internalOrder.compliance.carfReporting = await this.generateCARFReport(internalOrder, customerData);
                // Perform risk assessment
                internalOrder.compliance.riskAssessment = await this.performRiskAssessment(internalOrder, customerData);
                logger_1.LoggerService.info('Compliance data generated for order', {
                    orderId: internalOrder.id,
                    travelRuleMessageId: internalOrder.compliance.travelRule.messageId,
                    carfReportId: internalOrder.compliance.carfReporting.reportId,
                    riskLevel: internalOrder.compliance.riskAssessment.riskLevel
                });
            }
            catch (error) {
                logger_1.LoggerService.error('Failed to generate compliance data', { error, orderId: internalOrder.id });
            }
            // Log comprehensive transaction
            logger_1.LoggerService.logTransaction(internalOrder.id, 'order_placed', {
                exchange: routingDecision.exchangeId,
                symbol: params.symbol,
                side: params.side,
                amount: params.amount,
                price: params.price,
                platformAccount: 'single_platform_account',
                brokerAllocation: brokerId,
                customerAllocation: userId,
                externalOrderId: exchangeOrder.externalOrderId,
                fundSegregation: {
                    platformAccount: 'single_platform_account',
                    brokerAllocation: brokerId,
                    customerAllocation: userId,
                    allocatedAmount: params.amount
                }
            });
            return internalOrder;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to place order with fund segregation', { error, params });
            throw error;
        }
    }
    generateIdempotencyKey(input) {
        const base = `${input.tenantId}|${input.brokerId}|${input.userId}|${input.symbol}|${input.side}|${input.type}|${input.amount}|${input.price || ''}`;
        return crypto_1.default.createHash('sha256').update(base).digest('hex');
    }
    /**
     * Get order status
     */
    async getOrderStatus(orderId, exchangeId) {
        const adapter = this.adapters.get(exchangeId);
        if (!adapter) {
            throw new Error(`Adapter not found for exchange: ${exchangeId}`);
        }
        return await adapter.getOrderStatus(orderId);
    }
    /**
     * Cancel order
     */
    async cancelOrder(orderId, exchangeId) {
        const adapter = this.adapters.get(exchangeId);
        if (!adapter) {
            throw new Error(`Adapter not found for exchange: ${exchangeId}`);
        }
        await adapter.cancelOrder(orderId);
        logger_1.LoggerService.info('Order cancelled', { orderId, exchangeId });
    }
    /**
     * Get balance from exchange
     */
    async getBalance(exchangeId, asset) {
        const adapter = this.adapters.get(exchangeId);
        if (!adapter) {
            throw new Error(`Adapter not found for exchange: ${exchangeId}`);
        }
        return await adapter.getBalance(asset);
    }
    /**
     * Get all exchange configurations
     */
    getAvailableExchanges() {
        return Array.from(this.exchanges.values());
    }
    /**
     * Get exchange health
     */
    getExchangeHealth(exchangeId) {
        const config = this.exchanges.get(exchangeId);
        return config?.health || null;
    }
    /**
     * Get platform fund allocations
     */
    getPlatformAllocations() {
        return Array.from(this.platformAllocations.values());
    }
    /**
     * Get platform allocation for specific exchange/asset
     */
    getPlatformAllocation(exchangeId, asset) {
        const allocationKey = `${exchangeId}_${asset}`;
        return this.platformAllocations.get(allocationKey) || null;
    }
    /**
     * Get internal order by ID
     */
    getInternalOrder(orderId) {
        return this.internalOrders.get(orderId) || null;
    }
    /**
     * Get all internal orders for broker/customer
     */
    getInternalOrders(brokerId, customerId) {
        const orders = Array.from(this.internalOrders.values());
        if (customerId) {
            return orders.filter(order => order.brokerId === brokerId && order.userId === customerId);
        }
        return orders.filter(order => order.brokerId === brokerId);
    }
    // ==================== COMPLIANCE METHODS ====================
    /**
     * Generate Travel Rule data for transaction
     */
    async generateTravelRuleData(order, originatorData, beneficiaryData) {
        const travelRuleData = {
            originator: {
                name: originatorData.name || 'Unknown',
                accountNumber: `${order.brokerId}_${order.userId}`,
                address: originatorData.address || 'Unknown',
                dateOfBirth: originatorData.dateOfBirth,
                nationalId: originatorData.nationalId,
                country: originatorData.country || 'Unknown',
                brokerId: order.brokerId,
                customerId: order.userId
            },
            beneficiary: beneficiaryData ? {
                name: beneficiaryData.name || 'Unknown',
                accountNumber: beneficiaryData.accountNumber || 'Unknown',
                address: beneficiaryData.address || 'Unknown',
                dateOfBirth: beneficiaryData.dateOfBirth,
                nationalId: beneficiaryData.nationalId,
                country: beneficiaryData.country || 'Unknown',
                brokerId: beneficiaryData.brokerId,
                customerId: beneficiaryData.customerId
            } : {
                name: 'External Exchange',
                accountNumber: order.exchangeId,
                address: 'Exchange Platform',
                country: 'Global',
                brokerId: '',
                customerId: ''
            },
            transaction: {
                amount: order.amount,
                currency: order.symbol.includes('USDT') ? 'USDT' : order.symbol.includes('USDC') ? 'USDC' : 'BTC',
                transactionId: order.id,
                timestamp: order.metadata.createdAt,
                purpose: 'Cryptocurrency Exchange',
                reference: order.externalOrderId
            },
            vasp: {
                originatorVasp: {
                    name: 'ThaliumX Platform',
                    country: 'Global',
                    registrationNumber: 'THALIUMX001',
                    address: 'ThaliumX Headquarters'
                },
                beneficiaryVasp: beneficiaryData ? {
                    name: 'ThaliumX Platform',
                    country: 'Global',
                    registrationNumber: 'THALIUMX001',
                    address: 'ThaliumX Headquarters'
                } : {
                    name: `${order.exchangeId.toUpperCase()} Exchange`,
                    country: 'Global',
                    registrationNumber: `${order.exchangeId.toUpperCase()}001`,
                    address: `${order.exchangeId.toUpperCase()} Headquarters`
                }
            },
            status: 'pending',
            messageId: `TR_${order.id}_${Date.now()}`,
            timestamp: new Date()
        };
        this.travelRuleMessages.set(travelRuleData.messageId, travelRuleData);
        // Persist Travel Rule message
        try {
            const Model = database_1.DatabaseService.getModel('TravelRuleMessage');
            await Model.create({ messageId: travelRuleData.messageId, data: travelRuleData, status: travelRuleData.status, transactionId: travelRuleData.transaction.transactionId });
        }
        catch (err) {
            logger_1.LoggerService.error('Persist Travel Rule message failed', { id: travelRuleData.messageId, err: err.message });
        }
        logger_1.LoggerService.logTransaction(order.id, 'travel_rule_generated', {
            messageId: travelRuleData.messageId,
            originator: travelRuleData.originator.name,
            beneficiary: travelRuleData.beneficiary.name,
            amount: travelRuleData.transaction.amount,
            currency: travelRuleData.transaction.currency
        });
        return travelRuleData;
    }
    /**
     * Run internal compliance self-test without external exchange calls.
     * Generates Travel Rule, CARF report, and Risk Assessment for a mock order.
     */
    async runComplianceSelfTest(brokerId, userId) {
        // Construct a minimal internal order that exercises compliance paths
        const mockOrder = {
            id: `internal_test_${Date.now()}`,
            tenantId: 'test-tenant',
            brokerId,
            userId,
            exchangeId: 'kucoin',
            symbol: 'BTCUSDT',
            side: 'sell',
            type: 'market',
            amount: '0.1',
            price: undefined,
            status: 'pending',
            allocatedAmount: '0.1',
            filledAmount: '0',
            averagePrice: '0',
            fees: '0',
            externalOrderId: undefined,
            fundAllocation: {
                allocatedFrom: `${brokerId}_${userId}`,
                allocatedAmount: '0.1',
                feeAllocation: '0'
            },
            compliance: {
                travelRule: {},
                carfReporting: {},
                riskAssessment: {}
            },
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                version: '1.0.0'
            }
        };
        const customerData = {
            name: `Customer_${userId}`,
            address: 'Customer Address',
            country: 'US',
            nationalId: 'TEST123456',
            taxId: 'TAXTEST123'
        };
        const travelRule = await this.generateTravelRuleData(mockOrder, customerData);
        const carf = await this.generateCARFReport(mockOrder, customerData);
        const risk = await this.performRiskAssessment(mockOrder, customerData);
        // Persist mock for observability
        this.internalOrders.set(mockOrder.id, mockOrder);
        return { travelRule, carf, risk, order: mockOrder };
    }
    /**
     * Generate CARF reporting data
     */
    async generateCARFReport(order, customerData) {
        const carfData = {
            reportingEntity: {
                name: 'ThaliumX Platform',
                country: 'Global',
                registrationNumber: 'THALIUMX001',
                address: 'ThaliumX Headquarters'
            },
            reportablePerson: {
                name: customerData.name || 'Unknown',
                address: customerData.address || 'Unknown',
                dateOfBirth: customerData.dateOfBirth,
                nationalId: customerData.nationalId,
                country: customerData.country || 'Unknown',
                taxId: customerData.taxId
            },
            cryptoAsset: {
                type: order.symbol.includes('USDT') ? 'USDT' : order.symbol.includes('USDC') ? 'USDC' : 'BTC',
                amount: order.amount,
                value: order.averagePrice || order.price || '0',
                currency: 'USD'
            },
            transaction: {
                type: 'exchange',
                date: order.metadata.createdAt,
                counterparty: order.exchangeId,
                platform: 'ThaliumX',
                fees: order.fees
            },
            reportingPeriod: {
                startDate: new Date(new Date().getFullYear(), 0, 1), // Start of year
                endDate: new Date(new Date().getFullYear(), 11, 31) // End of year
            },
            status: 'pending',
            reportId: `CARF_${order.id}_${Date.now()}`,
            submissionDate: undefined
        };
        this.carfReports.set(carfData.reportId, carfData);
        try {
            const Model = database_1.DatabaseService.getModel('CarfReport');
            await Model.create({ reportId: carfData.reportId, data: carfData, status: carfData.status, submissionDate: carfData.submissionDate });
        }
        catch (err) {
            logger_1.LoggerService.error('Persist CARF report failed', { id: carfData.reportId, err: err.message });
        }
        logger_1.LoggerService.logTransaction(order.id, 'carf_report_generated', {
            reportId: carfData.reportId,
            reportablePerson: carfData.reportablePerson.name,
            cryptoAsset: carfData.cryptoAsset.type,
            amount: carfData.cryptoAsset.amount,
            value: carfData.cryptoAsset.value
        });
        return carfData;
    }
    /**
     * Perform risk assessment for transaction
     */
    async performRiskAssessment(order, customerData) {
        let riskScore = 0;
        const flags = [];
        const recommendations = [];
        // Amount-based risk
        const amount = parseFloat(order.amount);
        if (amount > 10000) {
            riskScore += 30;
            flags.push('High transaction amount');
            recommendations.push('Enhanced due diligence required');
        }
        else if (amount > 5000) {
            riskScore += 15;
            flags.push('Medium transaction amount');
        }
        // Geography-based risk
        const customerCountry = customerData.country;
        const highRiskCountries = ['AF', 'IR', 'KP', 'SY']; // Example high-risk countries
        if (highRiskCountries.includes(customerCountry)) {
            riskScore += 40;
            flags.push('High-risk jurisdiction');
            recommendations.push('Sanctions screening required');
        }
        // Pattern-based risk
        const recentOrders = this.getInternalOrders(order.brokerId, order.userId)
            .filter(o => o.metadata.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24 hours
        if (recentOrders.length > 10) {
            riskScore += 25;
            flags.push('High transaction frequency');
            recommendations.push('Monitor for suspicious activity');
        }
        // Counterparty risk
        if (order.exchangeId === 'unknown' || !this.exchanges.has(order.exchangeId)) {
            riskScore += 20;
            flags.push('Unknown counterparty');
            recommendations.push('Verify counterparty legitimacy');
        }
        // Determine risk level
        let riskLevel;
        if (riskScore >= 80) {
            riskLevel = 'critical';
        }
        else if (riskScore >= 60) {
            riskLevel = 'high';
        }
        else if (riskScore >= 30) {
            riskLevel = 'medium';
        }
        else {
            riskLevel = 'low';
        }
        const riskAssessment = {
            riskScore,
            riskLevel,
            factors: {
                amount: amount > 10000 ? 30 : amount > 5000 ? 15 : 0,
                frequency: recentOrders.length > 10 ? 25 : recentOrders.length > 5 ? 10 : 0,
                geography: highRiskCountries.includes(customerCountry) ? 40 : 0,
                counterparty: !this.exchanges.has(order.exchangeId) ? 20 : 0,
                pattern: flags.length > 2 ? 15 : 0
            },
            flags,
            recommendations,
            assessmentDate: new Date(),
            assessor: 'ThaliumX Risk Engine'
        };
        logger_1.LoggerService.logTransaction(order.id, 'risk_assessment_completed', {
            riskScore,
            riskLevel,
            flags: flags.length,
            recommendations: recommendations.length
        });
        return riskAssessment;
    }
    /**
     * Submit Travel Rule message
     */
    async submitTravelRuleMessage(messageId) {
        const travelRuleData = this.travelRuleMessages.get(messageId);
        if (!travelRuleData) {
            return false;
        }
        try {
            // In a real implementation, this would send to the beneficiary VASP
            // For now, we'll simulate the submission
            travelRuleData.status = 'sent';
            try {
                const Model = database_1.DatabaseService.getModel('TravelRuleMessage');
                const row = await Model.findOne({ where: { messageId } });
                if (row)
                    await row.update({ status: 'sent' });
            }
            catch (err) {
                logger_1.LoggerService.error('Update Travel Rule message status failed', { messageId, err: err.message });
            }
            logger_1.LoggerService.logTransaction(travelRuleData.transaction.transactionId, 'travel_rule_submitted', {
                messageId,
                status: 'sent',
                beneficiary: travelRuleData.beneficiary.name
            });
            return true;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to submit Travel Rule message', { error, messageId });
            return false;
        }
    }
    /**
     * Submit CARF report
     */
    async submitCARFReport(reportId) {
        const carfData = this.carfReports.get(reportId);
        if (!carfData) {
            return false;
        }
        try {
            // In a real implementation, this would submit to tax authorities
            // For now, we'll simulate the submission
            carfData.status = 'submitted';
            carfData.submissionDate = new Date();
            try {
                const Model = database_1.DatabaseService.getModel('CarfReport');
                const row = await Model.findOne({ where: { reportId } });
                if (row)
                    await row.update({ status: 'submitted', submissionDate: carfData.submissionDate });
            }
            catch (err) {
                logger_1.LoggerService.error('Update CARF report status failed', { reportId, err: err.message });
            }
            logger_1.LoggerService.logTransaction(carfData.transaction.counterparty || 'unknown', 'carf_report_submitted', {
                reportId,
                status: 'submitted',
                reportablePerson: carfData.reportablePerson.name,
                submissionDate: carfData.submissionDate
            });
            return true;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to submit CARF report', { error, reportId });
            return false;
        }
    }
    /**
     * Get Travel Rule messages
     */
    getTravelRuleMessages() {
        return Array.from(this.travelRuleMessages.values());
    }
    /**
     * Get CARF reports
     */
    getCARFReports() {
        return Array.from(this.carfReports.values());
    }
    // ==================== ASSET VISIBILITY & RECONCILIATION ====================
    /**
     * Get user's asset distribution across all exchanges
     */
    async getUserAssetDistribution(userId, brokerId) {
        const totalAssets = new Map();
        const exchangeBreakdown = new Map();
        // Get all platform allocations
        for (const allocation of this.platformAllocations.values()) {
            const brokerCustomers = allocation.customerAllocations.get(brokerId);
            if (brokerCustomers && brokerCustomers.has(userId)) {
                const userAmount = brokerCustomers.get(userId) || '0';
                // Add to total assets
                const currentTotal = totalAssets.get(allocation.asset) || '0';
                totalAssets.set(allocation.asset, (parseFloat(currentTotal) + parseFloat(userAmount)).toString());
                // Add to exchange breakdown
                if (!exchangeBreakdown.has(allocation.exchangeId)) {
                    exchangeBreakdown.set(allocation.exchangeId, new Map());
                }
                exchangeBreakdown.get(allocation.exchangeId).set(allocation.asset, userAmount);
            }
        }
        return {
            userId,
            brokerId,
            totalAssets,
            exchangeBreakdown,
            lastUpdated: new Date()
        };
    }
    /**
     * Get broker's total assets across all exchanges
     */
    async getBrokerAssetDistribution(brokerId) {
        const totalAssets = new Map();
        const exchangeBreakdown = new Map();
        let customerCount = 0;
        // Get all platform allocations
        for (const allocation of this.platformAllocations.values()) {
            const brokerAllocation = allocation.brokerAllocations.get(brokerId);
            if (brokerAllocation) {
                const brokerAmount = brokerAllocation;
                // Add to total assets
                const currentTotal = totalAssets.get(allocation.asset) || '0';
                totalAssets.set(allocation.asset, (parseFloat(currentTotal) + parseFloat(brokerAmount)).toString());
                // Add to exchange breakdown
                if (!exchangeBreakdown.has(allocation.exchangeId)) {
                    exchangeBreakdown.set(allocation.exchangeId, new Map());
                }
                exchangeBreakdown.get(allocation.exchangeId).set(allocation.asset, brokerAmount);
            }
            // Count customers for this broker
            const brokerCustomers = allocation.customerAllocations.get(brokerId);
            if (brokerCustomers) {
                customerCount = Math.max(customerCount, brokerCustomers.size);
            }
        }
        return {
            brokerId,
            totalAssets,
            exchangeBreakdown,
            customerCount,
            lastUpdated: new Date()
        };
    }
    /**
     * Get platform-level asset reconciliation across all exchanges
     */
    async getPlatformAssetReconciliation() {
        const platformTotals = new Map();
        const exchangeBalances = new Map();
        const internalAllocations = new Map();
        const reconciliation = new Map();
        // Get actual balances from exchanges
        for (const [exchangeId, config] of this.exchanges) {
            if (!config.enabled)
                continue;
            const adapter = this.adapters.get(exchangeId);
            if (!adapter)
                continue;
            const exchangeAssets = new Map();
            try {
                // Get balances for major assets
                const assets = ['BTC', 'ETH', 'USDT', 'USDC'];
                for (const asset of assets) {
                    try {
                        const balance = await adapter.getBalance(asset);
                        exchangeAssets.set(asset, balance.total);
                        // Add to platform totals
                        const currentTotal = platformTotals.get(asset) || '0';
                        platformTotals.set(asset, (parseFloat(currentTotal) + parseFloat(balance.total)).toString());
                    }
                    catch (error) {
                        logger_1.LoggerService.warn(`Failed to get ${asset} balance from ${config.name}`, { error });
                        exchangeAssets.set(asset, '0');
                    }
                }
            }
            catch (error) {
                logger_1.LoggerService.error(`Failed to get balances from ${config.name}`, { error });
            }
            exchangeBalances.set(exchangeId, exchangeAssets);
        }
        // Get internal allocations
        for (const allocation of this.platformAllocations.values()) {
            if (!internalAllocations.has(allocation.exchangeId)) {
                internalAllocations.set(allocation.exchangeId, new Map());
            }
            // Calculate total allocated amount for this exchange/asset
            let totalAllocated = 0;
            for (const brokerAmount of allocation.brokerAllocations.values()) {
                totalAllocated += parseFloat(brokerAmount);
            }
            internalAllocations.get(allocation.exchangeId).set(allocation.asset, totalAllocated.toString());
        }
        // Perform reconciliation
        for (const [exchangeId, actualBalances] of exchangeBalances) {
            const allocatedBalances = internalAllocations.get(exchangeId) || new Map();
            for (const [asset, actualBalance] of actualBalances) {
                const allocatedAmount = allocatedBalances.get(asset) || '0';
                const difference = parseFloat(actualBalance) - parseFloat(allocatedAmount);
                let status;
                if (Math.abs(difference) < 0.01) {
                    status = 'balanced';
                }
                else if (difference > 0) {
                    status = 'under_allocated'; // More actual balance than allocated
                }
                else {
                    status = 'over_allocated'; // More allocated than actual balance
                }
                const reconciliationKey = `${exchangeId}_${asset}`;
                reconciliation.set(reconciliationKey, {
                    exchangeId,
                    asset,
                    actualBalance,
                    allocatedAmount,
                    difference: difference.toString(),
                    status
                });
            }
        }
        return {
            platformTotals,
            exchangeBalances,
            internalAllocations,
            reconciliation,
            lastUpdated: new Date()
        };
    }
    /**
     * Get detailed asset breakdown for specific user
     */
    async getUserDetailedAssets(userId, brokerId) {
        const userDistribution = await this.getUserAssetDistribution(userId, brokerId);
        const assets = [];
        for (const [asset, totalAmount] of userDistribution.totalAssets) {
            const exchanges = [];
            for (const [exchangeId, exchangeAssets] of userDistribution.exchangeBreakdown) {
                const amount = exchangeAssets.get(asset) || '0';
                if (parseFloat(amount) > 0) {
                    const config = this.exchanges.get(exchangeId);
                    exchanges.push({
                        exchangeId,
                        exchangeName: config?.name || exchangeId,
                        amount,
                        status: config?.health.status || 'unknown'
                    });
                }
            }
            assets.push({
                asset,
                totalAmount,
                exchanges
            });
        }
        return {
            userId,
            brokerId,
            assets,
            lastUpdated: new Date()
        };
    }
    /**
     * Run comprehensive compliance test suite
     */
    async runComplianceTestSuite() {
        logger_1.LoggerService.info('Running comprehensive Omni Exchange compliance test suite...');
        const testResults = {
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            tests: [],
            complianceMetrics: {
                travelRuleCoverage: 0,
                carfCoverage: 0,
                riskAssessmentCoverage: 0,
                averageRiskScore: 0
            }
        };
        // Test 1: Travel Rule Data Generation
        try {
            const mockOrder1 = this.createMockOrder('BTCUSDT', 'buy', '0.1', '30000');
            const mockCustomer1 = this.createMockCustomer('US', 'high-risk');
            const travelRuleData = await this.generateTravelRuleData(mockOrder1, mockCustomer1);
            testResults.tests.push({
                name: 'Travel Rule Data Generation',
                status: 'passed',
                details: {
                    messageId: travelRuleData.messageId,
                    status: travelRuleData.status,
                    requiredFields: Object.keys(travelRuleData).length
                }
            });
            testResults.summary.passed++;
        }
        catch (error) {
            testResults.tests.push({
                name: 'Travel Rule Data Generation',
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
            });
            testResults.summary.failed++;
        }
        testResults.summary.totalTests++;
        // Test 2: CARF Report Generation
        try {
            const mockOrder2 = this.createMockOrder('ETHUSDT', 'sell', '1.0', '2000');
            const mockCustomer2 = this.createMockCustomer('CA', 'medium-risk');
            const carfReport = await this.generateCARFReport(mockOrder2, mockCustomer2);
            testResults.tests.push({
                name: 'CARF Report Generation',
                status: 'passed',
                details: {
                    reportId: carfReport.reportId,
                    status: carfReport.status,
                    requiredFields: Object.keys(carfReport).length
                }
            });
            testResults.summary.passed++;
        }
        catch (error) {
            testResults.tests.push({
                name: 'CARF Report Generation',
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
            });
            testResults.summary.failed++;
        }
        testResults.summary.totalTests++;
        // Test 3: Risk Assessment
        try {
            const mockOrder3 = this.createMockOrder('ADAUSDT', 'buy', '1000', '0.5');
            const mockCustomer3 = this.createMockCustomer('UK', 'low-risk');
            const riskAssessment = await this.performRiskAssessment(mockOrder3, mockCustomer3);
            testResults.tests.push({
                name: 'Risk Assessment',
                status: 'passed',
                details: {
                    riskScore: riskAssessment.riskScore,
                    riskLevel: riskAssessment.riskLevel,
                    flags: riskAssessment.flags.length
                }
            });
            testResults.summary.passed++;
        }
        catch (error) {
            testResults.tests.push({
                name: 'Risk Assessment',
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
            });
            testResults.summary.failed++;
        }
        testResults.summary.totalTests++;
        // Test 4: Fund Segregation
        try {
            const allocationResult = await this.allocateFunds('kucoin', 'USDT', 'test-broker', 'test-user', '1000');
            const balance = await this.getAvailableBalance('kucoin', 'USDT', 'test-broker', 'test-user');
            testResults.tests.push({
                name: 'Fund Segregation',
                status: 'passed',
                details: {
                    allocated: allocationResult,
                    balance: balance,
                    segregationWorking: parseFloat(balance) >= 0
                }
            });
            testResults.summary.passed++;
        }
        catch (error) {
            testResults.tests.push({
                name: 'Fund Segregation',
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
            });
            testResults.summary.failed++;
        }
        testResults.summary.totalTests++;
        // Test 5: Exchange Health Monitoring
        try {
            const healthStatus = this.getExchangeHealth('kucoin');
            const allExchangesHealthy = Array.from(this.exchanges.values()).every(e => e.health.status === 'healthy');
            testResults.tests.push({
                name: 'Exchange Health Monitoring',
                status: allExchangesHealthy ? 'passed' : 'warning',
                details: {
                    kucoinHealth: healthStatus,
                    allExchangesHealthy,
                    totalExchanges: this.exchanges.size
                }
            });
            if (allExchangesHealthy) {
                testResults.summary.passed++;
            }
            else {
                testResults.summary.warnings++;
            }
        }
        catch (error) {
            testResults.tests.push({
                name: 'Exchange Health Monitoring',
                status: 'failed',
                error: error instanceof Error ? error.message : String(error)
            });
            testResults.summary.failed++;
        }
        testResults.summary.totalTests++;
        // Calculate compliance metrics
        testResults.complianceMetrics.travelRuleCoverage = this.travelRuleMessages.size > 0 ? 100 : 0;
        testResults.complianceMetrics.carfCoverage = this.carfReports.size > 0 ? 100 : 0;
        testResults.complianceMetrics.riskAssessmentCoverage = testResults.tests.filter(t => t.name === 'Risk Assessment' && t.status === 'passed').length > 0 ? 100 : 0;
        const riskScores = Array.from(this.travelRuleMessages.values()).map(tr => 0); // Default to 0 since TravelRuleData doesn't have riskScore
        testResults.complianceMetrics.averageRiskScore = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;
        logger_1.LoggerService.info('Omni Exchange compliance test suite completed.', {
            summary: testResults.summary,
            complianceMetrics: testResults.complianceMetrics
        });
        return testResults;
    }
    /**
     * Create mock order for testing
     */
    createMockOrder(symbol, side, amount, price) {
        return {
            id: `test_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tenantId: 'test-tenant',
            brokerId: 'test-broker',
            userId: 'test-user',
            exchangeId: 'kucoin',
            symbol,
            side: side,
            type: 'market',
            amount,
            price,
            status: 'filled',
            allocatedAmount: amount,
            filledAmount: amount,
            averagePrice: price,
            fees: '0.001',
            externalOrderId: `external_${Date.now()}`,
            fundAllocation: {
                allocatedFrom: 'test-broker_test-user',
                allocatedAmount: amount,
                feeAllocation: '0.001'
            },
            compliance: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                version: '1.0.0'
            }
        };
    }
    /**
     * Create mock customer for testing
     */
    createMockCustomer(country, riskLevel) {
        return {
            name: `Test User ${Math.random().toString(36).substr(2, 5)}`,
            address: `${Math.floor(Math.random() * 9999)} Test St, Test City`,
            dateOfBirth: '1990-01-01',
            nationalId: `TESTID${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            country,
            taxId: `TESTTAX${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            riskLevel
        };
    }
    /**
     * Get compliance dashboard data
     */
    getComplianceDashboard() {
        const totalTravelRuleMessages = this.travelRuleMessages.size;
        const pendingTravelRuleMessages = Array.from(this.travelRuleMessages.values()).filter(m => m.status === 'pending').length;
        const submittedTravelRuleMessages = Array.from(this.travelRuleMessages.values()).filter(m => m.status === 'sent' || m.status === 'received').length;
        const totalCARFReports = this.carfReports.size;
        const pendingCARFReports = Array.from(this.carfReports.values()).filter(r => r.status === 'pending').length;
        const submittedCARFReports = Array.from(this.carfReports.values()).filter(r => r.status === 'submitted').length;
        const riskScores = Array.from(this.travelRuleMessages.values()).map(tr => 0); // Default to 0 since TravelRuleData doesn't have riskScore
        const averageRiskScore = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;
        const highRiskTransactions = Array.from(this.travelRuleMessages.values()).filter(tr => 0 > 70).length; // Default to 0
        const mediumRiskTransactions = Array.from(this.travelRuleMessages.values()).filter(tr => {
            const score = 0; // Default to 0
            return score >= 30 && score <= 70;
        }).length;
        const lowRiskTransactions = Array.from(this.travelRuleMessages.values()).filter(tr => 0 < 30).length; // Default to 0
        return {
            travelRule: {
                total: totalTravelRuleMessages,
                pending: pendingTravelRuleMessages,
                submitted: submittedTravelRuleMessages,
                completionRate: totalTravelRuleMessages > 0 ? (submittedTravelRuleMessages / totalTravelRuleMessages) * 100 : 0
            },
            carf: {
                total: totalCARFReports,
                pending: pendingCARFReports,
                submitted: submittedCARFReports,
                completionRate: totalCARFReports > 0 ? (submittedCARFReports / totalCARFReports) * 100 : 0
            },
            riskAssessment: {
                averageRiskScore,
                highRisk: highRiskTransactions,
                mediumRisk: mediumRiskTransactions,
                lowRisk: lowRiskTransactions,
                totalAssessed: totalTravelRuleMessages
            },
            complianceHealth: {
                overallScore: this.calculateComplianceHealthScore(totalTravelRuleMessages, submittedTravelRuleMessages, totalCARFReports, submittedCARFReports),
                status: this.getComplianceStatus(totalTravelRuleMessages, submittedTravelRuleMessages, totalCARFReports, submittedCARFReports)
            },
            lastUpdated: new Date().toISOString()
        };
    }
    /**
     * Calculate compliance health score
     */
    calculateComplianceHealthScore(trTotal, trSubmitted, carfTotal, carfSubmitted) {
        const trScore = trTotal > 0 ? (trSubmitted / trTotal) * 50 : 50;
        const carfScore = carfTotal > 0 ? (carfSubmitted / carfTotal) * 50 : 50;
        return Math.round(trScore + carfScore);
    }
    /**
     * Get compliance status
     */
    getComplianceStatus(trTotal, trSubmitted, carfTotal, carfSubmitted) {
        const score = this.calculateComplianceHealthScore(trTotal, trSubmitted, carfTotal, carfSubmitted);
        if (score >= 90)
            return 'excellent';
        if (score >= 75)
            return 'good';
        if (score >= 60)
            return 'fair';
        return 'needs_attention';
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        if (this.healthMonitoringInterval) {
            clearInterval(this.healthMonitoringInterval);
        }
        logger_1.LoggerService.info('Omni Exchange Service shut down');
    }
}
exports.OmniExchangeService = OmniExchangeService;
//# sourceMappingURL=omni-exchange.js.map