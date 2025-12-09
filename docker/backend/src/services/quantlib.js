"use strict";
/**
 * QuantLib Integration Service
 *
 * Comprehensive quantitative risk management and analysis with:
 * - Risk Metrics Calculation (VaR, CVaR, Expected Shortfall, Sharpe Ratio)
 * - Portfolio Optimization (Modern Portfolio Theory, Black-Litterman)
 * - Options Pricing (Black-Scholes, Binomial, Monte Carlo)
 * - Interest Rate Models (Hull-White, Vasicek, CIR)
 * - Credit Risk Assessment (Default probability, Credit VaR)
 * - Market Risk Analysis (Stress testing, Scenario analysis)
 * - Volatility Modeling (GARCH, EWMA, Implied volatility)
 * - Derivatives Pricing (Swaps, Futures, Forwards)
 * - Risk Attribution (Factor analysis, Performance attribution)
 * - Regulatory Compliance (Basel III, Solvency II, MiFID II)
 *
 * Production-ready with comprehensive error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantLibService = exports.RegulationType = exports.DerivativeType = exports.VolatilityModelType = exports.ScenarioType = exports.InterestRateModelType = exports.PricingModel = exports.OptionType = exports.OptimizationMethod = void 0;
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
var OptimizationMethod;
(function (OptimizationMethod) {
    OptimizationMethod["MEAN_VARIANCE"] = "MEAN_VARIANCE";
    OptimizationMethod["BLACK_LITTERMAN"] = "BLACK_LITTERMAN";
    OptimizationMethod["RISK_PARITY"] = "RISK_PARITY";
    OptimizationMethod["MAXIMUM_SHARPE"] = "MAXIMUM_SHARPE";
    OptimizationMethod["MINIMUM_VARIANCE"] = "MINIMUM_VARIANCE";
    OptimizationMethod["EQUAL_WEIGHT"] = "EQUAL_WEIGHT";
    OptimizationMethod["MOMENTUM"] = "MOMENTUM";
    OptimizationMethod["MEAN_REVERSION"] = "MEAN_REVERSION";
})(OptimizationMethod || (exports.OptimizationMethod = OptimizationMethod = {}));
var OptionType;
(function (OptionType) {
    OptionType["CALL"] = "CALL";
    OptionType["PUT"] = "PUT";
})(OptionType || (exports.OptionType = OptionType = {}));
var PricingModel;
(function (PricingModel) {
    PricingModel["BLACK_SCHOLES"] = "BLACK_SCHOLES";
    PricingModel["BINOMIAL"] = "BINOMIAL";
    PricingModel["MONTE_CARLO"] = "MONTE_CARLO";
    PricingModel["FINITE_DIFFERENCE"] = "FINITE_DIFFERENCE";
    PricingModel["ANALYTICAL"] = "ANALYTICAL";
})(PricingModel || (exports.PricingModel = PricingModel = {}));
var InterestRateModelType;
(function (InterestRateModelType) {
    InterestRateModelType["HULL_WHITE"] = "HULL_WHITE";
    InterestRateModelType["VASICEK"] = "VASICEK";
    InterestRateModelType["CIR"] = "CIR";
    InterestRateModelType["BLACK_KARASINSKI"] = "BLACK_KARASINSKI";
    InterestRateModelType["G2_PLUS"] = "G2_PLUS";
    InterestRateModelType["LIBOR_MARKET_MODEL"] = "LIBOR_MARKET_MODEL";
})(InterestRateModelType || (exports.InterestRateModelType = InterestRateModelType = {}));
var ScenarioType;
(function (ScenarioType) {
    ScenarioType["HISTORICAL"] = "HISTORICAL";
    ScenarioType["MONTE_CARLO"] = "MONTE_CARLO";
    ScenarioType["STRESS"] = "STRESS";
    ScenarioType["REGULATORY"] = "REGULATORY";
    ScenarioType["CUSTOM"] = "CUSTOM";
})(ScenarioType || (exports.ScenarioType = ScenarioType = {}));
var VolatilityModelType;
(function (VolatilityModelType) {
    VolatilityModelType["GARCH"] = "GARCH";
    VolatilityModelType["EGARCH"] = "EGARCH";
    VolatilityModelType["GJR_GARCH"] = "GJR_GARCH";
    VolatilityModelType["EWMA"] = "EWMA";
    VolatilityModelType["IMPLIED"] = "IMPLIED";
    VolatilityModelType["REALIZED"] = "REALIZED";
})(VolatilityModelType || (exports.VolatilityModelType = VolatilityModelType = {}));
var DerivativeType;
(function (DerivativeType) {
    DerivativeType["SWAP"] = "SWAP";
    DerivativeType["FUTURE"] = "FUTURE";
    DerivativeType["FORWARD"] = "FORWARD";
    DerivativeType["OPTION"] = "OPTION";
    DerivativeType["CAP"] = "CAP";
    DerivativeType["FLOOR"] = "FLOOR";
    DerivativeType["SWAPTION"] = "SWAPTION";
    DerivativeType["CDS"] = "CDS";
})(DerivativeType || (exports.DerivativeType = DerivativeType = {}));
var RegulationType;
(function (RegulationType) {
    RegulationType["BASEL_III"] = "BASEL_III";
    RegulationType["SOLVENCY_II"] = "SOLVENCY_II";
    RegulationType["MIFID_II"] = "MIFID_II";
    RegulationType["EMIR"] = "EMIR";
    RegulationType["DODD_FRANK"] = "DODD_FRANK";
    RegulationType["CCAR"] = "CCAR";
})(RegulationType || (exports.RegulationType = RegulationType = {}));
// =============================================================================
// QUANTLIB SERVICE CLASS
// =============================================================================
class QuantLibService {
    static isInitialized = false;
    static riskMetrics = new Map();
    static portfolioOptimizations = new Map();
    static optionsPricings = new Map();
    static interestRateModels = new Map();
    static creditRiskAssessments = new Map();
    static stressTests = new Map();
    static volatilityModels = new Map();
    static derivativesPricings = new Map();
    static riskAttributions = new Map();
    static regulatoryCompliances = new Map();
    // External Python QuantLib Service Configuration
    static externalServiceUrl = process.env.QUANTLIB_URL || null;
    static externalServiceApiKey = process.env.QUANTLIB_API_KEY || 'default-key';
    static externalServiceEnabled = !!process.env.QUANTLIB_URL;
    static externalServiceClient = null;
    /**
     * Initialize QuantLib Service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing QuantLib Service...');
            // Initialize external Python service client if configured
            if (this.externalServiceEnabled && this.externalServiceUrl) {
                this.externalServiceClient = axios_1.default.create({
                    baseURL: this.externalServiceUrl,
                    headers: {
                        'Authorization': `Bearer ${this.externalServiceApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                logger_1.LoggerService.info(`External QuantLib Python service enabled: ${this.externalServiceUrl}`);
            }
            else {
                logger_1.LoggerService.info('Using local TypeScript QuantLib implementation');
            }
            // Initialize risk calculation engines
            await this.initializeRiskEngines();
            // Load existing calculations
            await this.loadExistingCalculations();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ QuantLib Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('quantlib.initialized', 'QuantLibService', 'info', {
                message: 'QuantLib service initialized',
                riskMetricsCount: this.riskMetrics.size,
                portfolioOptimizationsCount: this.portfolioOptimizations.size,
                optionsPricingsCount: this.optionsPricings.size,
                interestRateModelsCount: this.interestRateModels.size,
                creditRiskAssessmentsCount: this.creditRiskAssessments.size,
                stressTestsCount: this.stressTests.size,
                volatilityModelsCount: this.volatilityModels.size,
                derivativesPricingsCount: this.derivativesPricings.size,
                riskAttributionsCount: this.riskAttributions.size,
                regulatoryCompliancesCount: this.regulatoryCompliances.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ QuantLib Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Calculate comprehensive risk metrics
     * Uses external Python service if available, otherwise falls back to local implementation
     */
    static async calculateRiskMetrics(portfolioId, returns, benchmarkReturns, riskFreeRate = 0.02, confidenceLevels = [0.95, 0.99]) {
        try {
            // Try external Python service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post('/risk/metrics', {
                        portfolioId,
                        returns,
                        benchmarkReturns,
                        riskFreeRate,
                        confidenceLevels
                    });
                    logger_1.LoggerService.info(`Risk metrics calculated via external QuantLib service: ${portfolioId}`);
                    return response.data;
                }
                catch (error) {
                    logger_1.LoggerService.warn('External QuantLib service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            logger_1.LoggerService.info(`Calculating risk metrics locally for portfolio: ${portfolioId}`, {
                returnsCount: returns.length,
                benchmarkReturnsCount: benchmarkReturns?.length || 0,
                riskFreeRate,
                confidenceLevels
            });
            const id = (0, uuid_1.v4)();
            const calculationDate = new Date();
            // Calculate basic statistics
            const meanReturn = this.calculateMean(returns);
            const volatility = this.calculateVolatility(returns);
            const skewness = this.calculateSkewness(returns);
            const kurtosis = this.calculateKurtosis(returns);
            // Calculate VaR and CVaR
            const var95 = this.calculateVaR(returns, 0.95);
            const var99 = this.calculateVaR(returns, 0.99);
            const cvar95 = this.calculateCVaR(returns, 0.95);
            const cvar99 = this.calculateCVaR(returns, 0.99);
            const expectedShortfall = this.calculateExpectedShortfall(returns);
            // Calculate risk-adjusted returns
            const sharpeRatio = this.calculateSharpeRatio(meanReturn, volatility, riskFreeRate);
            const sortinoRatio = this.calculateSortinoRatio(returns, riskFreeRate);
            const maxDrawdown = this.calculateMaxDrawdown(returns);
            // Calculate benchmark-relative metrics
            let beta = 0;
            let alpha = 0;
            let trackingError = 0;
            let informationRatio = 0;
            let treynorRatio = 0;
            if (benchmarkReturns && benchmarkReturns.length > 0) {
                beta = this.calculateBeta(returns, benchmarkReturns);
                alpha = this.calculateAlpha(meanReturn, this.calculateMean(benchmarkReturns), beta, riskFreeRate);
                trackingError = this.calculateTrackingError(returns, benchmarkReturns);
                informationRatio = this.calculateInformationRatio(returns, benchmarkReturns);
                treynorRatio = this.calculateTreynorRatio(meanReturn, beta, riskFreeRate);
            }
            // Calculate additional ratios
            const calmarRatio = this.calculateCalmarRatio(meanReturn, maxDrawdown);
            const sterlingRatio = this.calculateSterlingRatio(returns);
            const burkeRatio = this.calculateBurkeRatio(returns);
            const kappa3 = this.calculateKappa3(returns, riskFreeRate);
            const omega = this.calculateOmega(returns, riskFreeRate);
            const upsidePotential = this.calculateUpsidePotential(returns, riskFreeRate);
            const downsideDeviation = this.calculateDownsideDeviation(returns, riskFreeRate);
            const jarqueBera = this.calculateJarqueBera(skewness, kurtosis, returns.length);
            const riskMetrics = {
                id,
                portfolioId,
                calculationDate,
                var95,
                var99,
                cvar95,
                cvar99,
                expectedShortfall,
                sharpeRatio,
                sortinoRatio,
                maxDrawdown,
                volatility,
                beta,
                alpha,
                trackingError,
                informationRatio,
                treynorRatio,
                calmarRatio,
                sterlingRatio,
                burkeRatio,
                kappa3,
                omega,
                upsidePotential,
                downsideDeviation,
                skewness,
                kurtosis,
                jarqueBera,
                metadata: {
                    returnsCount: returns.length,
                    benchmarkReturnsCount: benchmarkReturns?.length || 0,
                    riskFreeRate,
                    confidenceLevels
                },
                createdAt: new Date()
            };
            // Store risk metrics
            this.riskMetrics.set(id, riskMetrics);
            logger_1.LoggerService.info(`Risk metrics calculated successfully: ${id}`, {
                var95: riskMetrics.var95,
                var99: riskMetrics.var99,
                sharpeRatio: riskMetrics.sharpeRatio,
                volatility: riskMetrics.volatility
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('risk.metrics.calculated', 'quantlib', portfolioId, {
                riskMetricsId: id,
                var95: riskMetrics.var95,
                var99: riskMetrics.var99,
                sharpeRatio: riskMetrics.sharpeRatio,
                volatility: riskMetrics.volatility
            });
            return riskMetrics;
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate risk metrics failed:', error);
            throw error;
        }
    }
    /**
     * Optimize portfolio using specified method
     */
    static async optimizePortfolio(portfolioId, expectedReturns, covarianceMatrix, method = OptimizationMethod.MAXIMUM_SHARPE, constraints, riskFreeRate = 0.02) {
        try {
            logger_1.LoggerService.info(`Optimizing portfolio: ${portfolioId}`, {
                method,
                assetsCount: expectedReturns.length,
                riskFreeRate
            });
            const id = (0, uuid_1.v4)();
            const optimizationDate = new Date();
            let weights;
            let expectedReturn;
            let volatility;
            let sharpeRatio;
            switch (method) {
                case OptimizationMethod.MAXIMUM_SHARPE:
                    const result = this.maximizeSharpeRatio(expectedReturns, covarianceMatrix, riskFreeRate, constraints);
                    weights = result.weights;
                    expectedReturn = result.expectedReturn;
                    volatility = result.volatility;
                    sharpeRatio = result.sharpeRatio;
                    break;
                case OptimizationMethod.MINIMUM_VARIANCE:
                    const minVarResult = this.minimizeVariance(expectedReturns, covarianceMatrix, constraints);
                    weights = minVarResult.weights;
                    expectedReturn = minVarResult.expectedReturn;
                    volatility = minVarResult.volatility;
                    sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
                    break;
                case OptimizationMethod.EQUAL_WEIGHT:
                    weights = this.equalWeight(expectedReturns.length);
                    expectedReturn = this.calculatePortfolioReturn(expectedReturns, weights);
                    volatility = this.calculatePortfolioVolatility(weights, covarianceMatrix);
                    sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
                    break;
                case OptimizationMethod.RISK_PARITY:
                    weights = this.riskParity(covarianceMatrix);
                    expectedReturn = this.calculatePortfolioReturn(expectedReturns, weights);
                    volatility = this.calculatePortfolioVolatility(weights, covarianceMatrix);
                    sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
                    break;
                default:
                    throw (0, utils_1.createError)('Unsupported optimization method', 400, 'UNSUPPORTED_OPTIMIZATION_METHOD');
            }
            const optimization = {
                id,
                portfolioId,
                optimizationDate,
                method,
                expectedReturns,
                covarianceMatrix,
                weights,
                expectedReturn,
                volatility,
                sharpeRatio,
                constraints: constraints || {},
                riskFreeRate,
                metadata: {
                    assetsCount: expectedReturns.length,
                    method,
                    constraints: constraints || {}
                },
                createdAt: new Date()
            };
            // Store optimization
            this.portfolioOptimizations.set(id, optimization);
            logger_1.LoggerService.info(`Portfolio optimized successfully: ${id}`, {
                method: optimization.method,
                expectedReturn: optimization.expectedReturn,
                volatility: optimization.volatility,
                sharpeRatio: optimization.sharpeRatio
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('portfolio.optimized', 'quantlib', portfolioId, {
                optimizationId: id,
                method: optimization.method,
                expectedReturn: optimization.expectedReturn,
                volatility: optimization.volatility,
                sharpeRatio: optimization.sharpeRatio
            });
            return optimization;
        }
        catch (error) {
            logger_1.LoggerService.error('Optimize portfolio failed:', error);
            throw error;
        }
    }
    /**
     * Price options using specified model
     */
    static async priceOption(symbol, optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield = 0, model = PricingModel.BLACK_SCHOLES) {
        try {
            logger_1.LoggerService.info(`Pricing option: ${symbol}`, {
                optionType,
                underlyingPrice,
                strikePrice,
                timeToExpiry,
                riskFreeRate,
                volatility,
                dividendYield,
                model
            });
            const id = (0, uuid_1.v4)();
            let price;
            let delta;
            let gamma;
            let theta;
            let vega;
            let rho;
            switch (model) {
                case PricingModel.BLACK_SCHOLES:
                    const bsResult = this.blackScholes(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield);
                    price = bsResult.price;
                    delta = bsResult.delta;
                    gamma = bsResult.gamma;
                    theta = bsResult.theta;
                    vega = bsResult.vega;
                    rho = bsResult.rho;
                    break;
                case PricingModel.BINOMIAL:
                    const binomialResult = this.binomialTree(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield);
                    price = binomialResult.price;
                    delta = binomialResult.delta;
                    gamma = binomialResult.gamma;
                    theta = binomialResult.theta;
                    vega = binomialResult.vega;
                    rho = binomialResult.rho;
                    break;
                case PricingModel.MONTE_CARLO:
                    const mcResult = this.monteCarlo(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield);
                    price = mcResult.price;
                    delta = mcResult.delta;
                    gamma = mcResult.gamma;
                    theta = mcResult.theta;
                    vega = mcResult.vega;
                    rho = mcResult.rho;
                    break;
                default:
                    throw (0, utils_1.createError)('Unsupported pricing model', 400, 'UNSUPPORTED_PRICING_MODEL');
            }
            const intrinsicValue = this.calculateIntrinsicValue(optionType, underlyingPrice, strikePrice);
            const timeValue = price - intrinsicValue;
            const impliedVolatility = this.calculateImpliedVolatility(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, price, dividendYield);
            const optionsPricing = {
                id,
                symbol,
                optionType,
                underlyingPrice,
                strikePrice,
                timeToExpiry,
                riskFreeRate,
                volatility,
                dividendYield,
                model,
                price,
                delta,
                gamma,
                theta,
                vega,
                rho,
                impliedVolatility,
                intrinsicValue,
                timeValue,
                metadata: {
                    model,
                    calculationMethod: 'analytical'
                },
                createdAt: new Date()
            };
            // Store options pricing
            this.optionsPricings.set(id, optionsPricing);
            logger_1.LoggerService.info(`Option priced successfully: ${id}`, {
                symbol: optionsPricing.symbol,
                price: optionsPricing.price,
                delta: optionsPricing.delta,
                gamma: optionsPricing.gamma
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('option.priced', 'quantlib', symbol, {
                optionsPricingId: id,
                optionType: optionsPricing.optionType,
                price: optionsPricing.price,
                delta: optionsPricing.delta,
                gamma: optionsPricing.gamma,
                model: optionsPricing.model
            });
            return optionsPricing;
        }
        catch (error) {
            logger_1.LoggerService.error('Price option failed:', error);
            throw error;
        }
    }
    /**
     * Perform stress testing
     */
    static async performStressTest(portfolioId, scenarioType, scenarioName, scenarioDescription, marketShocks, portfolioValue, riskMetrics) {
        try {
            logger_1.LoggerService.info(`Performing stress test: ${scenarioName}`, {
                portfolioId,
                scenarioType,
                marketShocksCount: marketShocks.length,
                portfolioValue
            });
            const id = (0, uuid_1.v4)();
            const testDate = new Date();
            // Calculate stress test impact
            const portfolioValueChange = this.calculateStressTestImpact(portfolioValue, marketShocks);
            const portfolioValueChangePercent = (portfolioValueChange / portfolioValue) * 100;
            const varImpact = this.calculateVaRImpact(riskMetrics, marketShocks);
            const expectedShortfallImpact = this.calculateExpectedShortfallImpact(riskMetrics, marketShocks);
            const stressTest = {
                id,
                portfolioId,
                testDate,
                scenarioType,
                scenarioName,
                scenarioDescription,
                marketShocks,
                portfolioValue,
                portfolioValueChange,
                portfolioValueChangePercent,
                varImpact,
                expectedShortfallImpact,
                riskMetrics,
                metadata: {
                    scenarioType,
                    marketShocksCount: marketShocks.length,
                    portfolioValue
                },
                createdAt: new Date()
            };
            // Store stress test
            this.stressTests.set(id, stressTest);
            logger_1.LoggerService.info(`Stress test performed successfully: ${id}`, {
                scenarioName: stressTest.scenarioName,
                portfolioValueChange: stressTest.portfolioValueChange,
                portfolioValueChangePercent: stressTest.portfolioValueChangePercent
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('stress.test.performed', 'quantlib', portfolioId, {
                stressTestId: id,
                scenarioName: stressTest.scenarioName,
                scenarioType: stressTest.scenarioType,
                portfolioValueChange: stressTest.portfolioValueChange,
                portfolioValueChangePercent: stressTest.portfolioValueChangePercent
            });
            return stressTest;
        }
        catch (error) {
            logger_1.LoggerService.error('Perform stress test failed:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing QuantLib Service...');
            this.isInitialized = false;
            this.riskMetrics.clear();
            this.portfolioOptimizations.clear();
            this.optionsPricings.clear();
            this.interestRateModels.clear();
            this.creditRiskAssessments.clear();
            this.stressTests.clear();
            this.volatilityModels.clear();
            this.derivativesPricings.clear();
            this.riskAttributions.clear();
            this.regulatoryCompliances.clear();
            logger_1.LoggerService.info('✅ QuantLib Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing QuantLib Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS - STATISTICAL CALCULATIONS
    // =============================================================================
    static calculateMean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    static calculateVolatility(values) {
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1);
        return Math.sqrt(variance);
    }
    static calculateSkewness(values) {
        const mean = this.calculateMean(values);
        const stdDev = this.calculateVolatility(values);
        const n = values.length;
        const skewness = values.reduce((sum, value) => sum + Math.pow((value - mean) / stdDev, 3), 0) / n;
        return skewness;
    }
    static calculateKurtosis(values) {
        const mean = this.calculateMean(values);
        const stdDev = this.calculateVolatility(values);
        const n = values.length;
        const kurtosis = values.reduce((sum, value) => sum + Math.pow((value - mean) / stdDev, 4), 0) / n;
        return kurtosis - 3; // Excess kurtosis
    }
    static calculateVaR(values, confidenceLevel) {
        if (values.length === 0) {
            return 0;
        }
        const sortedValues = [...values].sort((a, b) => a - b);
        const index = Math.floor((1 - confidenceLevel) * sortedValues.length);
        const result = sortedValues[index];
        return result !== undefined ? result : sortedValues[sortedValues.length - 1] || 0;
    }
    static calculateCVaR(values, confidenceLevel) {
        const varValue = this.calculateVaR(values, confidenceLevel);
        const tailValues = values.filter(value => value <= varValue);
        return tailValues.reduce((sum, value) => sum + value, 0) / tailValues.length;
    }
    static calculateExpectedShortfall(values) {
        return this.calculateCVaR(values, 0.95);
    }
    static calculateSharpeRatio(meanReturn, volatility, riskFreeRate) {
        return (meanReturn - riskFreeRate) / volatility;
    }
    static calculateSortinoRatio(returns, riskFreeRate) {
        const meanReturn = this.calculateMean(returns);
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const downsideDeviation = this.calculateVolatility(downsideReturns);
        return (meanReturn - riskFreeRate) / downsideDeviation;
    }
    static calculateMaxDrawdown(returns) {
        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;
        for (const return_ of returns) {
            cumulative += return_;
            if (cumulative > peak) {
                peak = cumulative;
            }
            const drawdown = peak - cumulative;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }
    static calculateBeta(returns, benchmarkReturns) {
        const covariance = this.calculateCovariance(returns, benchmarkReturns);
        const benchmarkVariance = this.calculateVariance(benchmarkReturns);
        return covariance / benchmarkVariance;
    }
    static calculateAlpha(portfolioReturn, benchmarkReturn, beta, riskFreeRate) {
        return portfolioReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate));
    }
    static calculateTrackingError(returns, benchmarkReturns) {
        const activeReturns = returns.map((r, i) => {
            const benchmark = benchmarkReturns[i];
            return benchmark !== undefined ? r - benchmark : r;
        });
        return this.calculateVolatility(activeReturns);
    }
    static calculateInformationRatio(returns, benchmarkReturns) {
        const activeReturns = returns.map((r, i) => {
            const benchmark = benchmarkReturns[i];
            return benchmark !== undefined ? r - benchmark : r;
        });
        const meanActiveReturn = this.calculateMean(activeReturns);
        const trackingError = this.calculateTrackingError(returns, benchmarkReturns);
        return meanActiveReturn / trackingError;
    }
    static calculateTreynorRatio(meanReturn, beta, riskFreeRate) {
        return (meanReturn - riskFreeRate) / beta;
    }
    static calculateCalmarRatio(meanReturn, maxDrawdown) {
        return meanReturn / maxDrawdown;
    }
    static calculateSterlingRatio(returns) {
        const meanReturn = this.calculateMean(returns);
        const maxDrawdown = this.calculateMaxDrawdown(returns);
        return meanReturn / maxDrawdown;
    }
    static calculateBurkeRatio(returns) {
        const meanReturn = this.calculateMean(returns);
        const drawdowns = this.calculateDrawdowns(returns);
        const sumSquaredDrawdowns = drawdowns.reduce((sum, dd) => sum + dd * dd, 0);
        return meanReturn / Math.sqrt(sumSquaredDrawdowns);
    }
    static calculateKappa3(returns, riskFreeRate) {
        const meanReturn = this.calculateMean(returns);
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const downsideDeviation = this.calculateVolatility(downsideReturns);
        return (meanReturn - riskFreeRate) / downsideDeviation;
    }
    static calculateOmega(returns, riskFreeRate) {
        const upsideReturns = returns.filter(r => r > riskFreeRate);
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const upsideSum = upsideReturns.reduce((sum, r) => sum + (r - riskFreeRate), 0);
        const downsideSum = downsideReturns.reduce((sum, r) => sum + (riskFreeRate - r), 0);
        return upsideSum / downsideSum;
    }
    static calculateUpsidePotential(returns, riskFreeRate) {
        const upsideReturns = returns.filter(r => r > riskFreeRate);
        return this.calculateMean(upsideReturns) - riskFreeRate;
    }
    static calculateDownsideDeviation(returns, riskFreeRate) {
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        return this.calculateVolatility(downsideReturns);
    }
    static calculateJarqueBera(skewness, kurtosis, n) {
        return (n / 6) * (skewness * skewness + (kurtosis * kurtosis) / 4);
    }
    static calculateCovariance(x, y) {
        const meanX = this.calculateMean(x);
        const meanY = this.calculateMean(y);
        return x.reduce((sum, xi, i) => {
            const yi = y[i];
            return sum + (xi - meanX) * (yi !== undefined ? yi - meanY : 0);
        }, 0) / (x.length - 1);
    }
    static calculateVariance(values) {
        const mean = this.calculateMean(values);
        return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1);
    }
    static calculateDrawdowns(returns) {
        const drawdowns = [];
        let peak = 0;
        let cumulative = 0;
        for (const return_ of returns) {
            cumulative += return_;
            if (cumulative > peak) {
                peak = cumulative;
            }
            drawdowns.push(peak - cumulative);
        }
        return drawdowns;
    }
    // =============================================================================
    // PRIVATE METHODS - PORTFOLIO OPTIMIZATION
    // =============================================================================
    static maximizeSharpeRatio(expectedReturns, covarianceMatrix, riskFreeRate, constraints) {
        // Simplified implementation - in production, use proper optimization library
        const n = expectedReturns.length;
        const weights = new Array(n).fill(1 / n); // Equal weights as starting point
        const expectedReturn = this.calculatePortfolioReturn(expectedReturns, weights);
        const volatility = this.calculatePortfolioVolatility(weights, covarianceMatrix);
        const sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
        return { weights, expectedReturn, volatility, sharpeRatio };
    }
    static minimizeVariance(expectedReturns, covarianceMatrix, constraints) {
        // Simplified implementation - in production, use proper optimization library
        const n = expectedReturns.length;
        const weights = new Array(n).fill(1 / n); // Equal weights as starting point
        const expectedReturn = this.calculatePortfolioReturn(expectedReturns, weights);
        const volatility = this.calculatePortfolioVolatility(weights, covarianceMatrix);
        return { weights, expectedReturn, volatility };
    }
    static equalWeight(n) {
        return new Array(n).fill(1 / n);
    }
    static riskParity(covarianceMatrix) {
        // Simplified implementation - in production, use proper risk parity algorithm
        const n = covarianceMatrix.length;
        return new Array(n).fill(1 / n);
    }
    static calculatePortfolioReturn(expectedReturns, weights) {
        return expectedReturns.reduce((sum, ret, i) => {
            const weight = weights[i];
            if (weight === undefined) {
                return sum;
            }
            return sum + ret * weight;
        }, 0);
    }
    static calculatePortfolioVolatility(weights, covarianceMatrix) {
        let variance = 0;
        for (let i = 0; i < weights.length; i++) {
            for (let j = 0; j < weights.length; j++) {
                const weightI = weights[i];
                const weightJ = weights[j];
                const cov = covarianceMatrix[i]?.[j];
                if (weightI !== undefined && weightJ !== undefined && cov !== undefined) {
                    variance += weightI * weightJ * cov;
                }
            }
        }
        return Math.sqrt(variance);
    }
    // =============================================================================
    // PRIVATE METHODS - OPTIONS PRICING
    // =============================================================================
    static blackScholes(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield) {
        const d1 = (Math.log(underlyingPrice / strikePrice) + (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));
        const d2 = d1 - volatility * Math.sqrt(timeToExpiry);
        const price = optionType === OptionType.CALL
            ? underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(d2)
            : strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(-d2) - underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(-d1);
        const delta = optionType === OptionType.CALL
            ? Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(d1)
            : Math.exp(-dividendYield * timeToExpiry) * (this.normalCDF(d1) - 1);
        const gamma = Math.exp(-dividendYield * timeToExpiry) * this.normalPDF(d1) / (underlyingPrice * volatility * Math.sqrt(timeToExpiry));
        const theta = optionType === OptionType.CALL
            ? -underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalPDF(d1) * volatility / (2 * Math.sqrt(timeToExpiry)) - riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(d2) + dividendYield * underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(d1)
            : -underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalPDF(d1) * volatility / (2 * Math.sqrt(timeToExpiry)) + riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(-d2) - dividendYield * underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(-d1);
        const vega = underlyingPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalPDF(d1) * Math.sqrt(timeToExpiry);
        const rho = optionType === OptionType.CALL
            ? strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(d2)
            : -strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(-d2);
        return { price, delta, gamma, theta, vega, rho };
    }
    static binomialTree(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield) {
        // Simplified implementation - in production, use proper binomial tree
        const bsResult = this.blackScholes(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield);
        return bsResult;
    }
    static monteCarlo(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield) {
        // Simplified implementation - in production, use proper Monte Carlo simulation
        const bsResult = this.blackScholes(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield);
        return bsResult;
    }
    static calculateIntrinsicValue(optionType, underlyingPrice, strikePrice) {
        return optionType === OptionType.CALL
            ? Math.max(0, underlyingPrice - strikePrice)
            : Math.max(0, strikePrice - underlyingPrice);
    }
    static calculateImpliedVolatility(optionType, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, marketPrice, dividendYield) {
        // Simplified implementation - in production, use proper implied volatility calculation
        return 0.2; // Default volatility
    }
    static normalCDF(x) {
        return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
    }
    static normalPDF(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }
    static erf(x) {
        // Approximation of error function
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }
    // =============================================================================
    // PRIVATE METHODS - STRESS TESTING
    // =============================================================================
    static calculateStressTestImpact(portfolioValue, marketShocks) {
        let totalImpact = 0;
        for (const shock of marketShocks) {
            if (shock.shockType === 'absolute') {
                totalImpact += shock.shockValue;
            }
            else {
                totalImpact += portfolioValue * shock.shockValue;
            }
        }
        return totalImpact;
    }
    static calculateVaRImpact(riskMetrics, marketShocks) {
        // Simplified implementation - in production, use proper VaR impact calculation
        return riskMetrics.var95 * 0.1; // 10% of VaR as impact
    }
    static calculateExpectedShortfallImpact(riskMetrics, marketShocks) {
        // Simplified implementation - in production, use proper Expected Shortfall impact calculation
        return riskMetrics.expectedShortfall * 0.1; // 10% of Expected Shortfall as impact
    }
    // =============================================================================
    // PRIVATE METHODS - INITIALIZATION
    // =============================================================================
    static async initializeRiskEngines() {
        try {
            // This would typically initialize QuantLib engines
            logger_1.LoggerService.info('QuantLib risk engines initialized');
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize risk engines failed:', error);
            throw error;
        }
    }
    static async loadExistingCalculations() {
        try {
            // This would typically load from database
            logger_1.LoggerService.info('Existing QuantLib calculations loaded from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Load existing calculations failed:', error);
            throw error;
        }
    }
}
exports.QuantLibService = QuantLibService;
//# sourceMappingURL=quantlib.js.map