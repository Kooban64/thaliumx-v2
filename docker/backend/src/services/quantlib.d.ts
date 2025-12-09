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
export interface RiskMetrics {
    id: string;
    portfolioId: string;
    calculationDate: Date;
    var95: number;
    var99: number;
    cvar95: number;
    cvar99: number;
    expectedShortfall: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    volatility: number;
    beta: number;
    alpha: number;
    trackingError: number;
    informationRatio: number;
    treynorRatio: number;
    calmarRatio: number;
    sterlingRatio: number;
    burkeRatio: number;
    kappa3: number;
    omega: number;
    upsidePotential: number;
    downsideDeviation: number;
    skewness: number;
    kurtosis: number;
    jarqueBera: number;
    metadata?: any;
    createdAt: Date;
}
export interface PortfolioOptimization {
    id: string;
    portfolioId: string;
    optimizationDate: Date;
    method: OptimizationMethod;
    expectedReturns: number[];
    covarianceMatrix: number[][];
    weights: number[];
    expectedReturn: number;
    volatility: number;
    sharpeRatio: number;
    constraints: OptimizationConstraints;
    riskFreeRate: number;
    metadata?: any;
    createdAt: Date;
}
export interface OptionsPricing {
    id: string;
    symbol: string;
    optionType: OptionType;
    underlyingPrice: number;
    strikePrice: number;
    timeToExpiry: number;
    riskFreeRate: number;
    volatility: number;
    dividendYield: number;
    model: PricingModel;
    price: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    impliedVolatility: number;
    intrinsicValue: number;
    timeValue: number;
    metadata?: any;
    createdAt: Date;
}
export interface InterestRateModel {
    id: string;
    modelType: InterestRateModelType;
    parameters: InterestRateParameters;
    calibrationDate: Date;
    calibrationData: number[];
    fittedParameters: number[];
    goodnessOfFit: number;
    aic: number;
    bic: number;
    metadata?: any;
    createdAt: Date;
}
export interface CreditRiskAssessment {
    id: string;
    entityId: string;
    assessmentDate: Date;
    defaultProbability: number;
    creditVaR: number;
    expectedLoss: number;
    unexpectedLoss: number;
    economicCapital: number;
    creditRating: string;
    pdModel: string;
    lgdModel: string;
    eadModel: string;
    correlation: number;
    metadata?: any;
    createdAt: Date;
}
export interface StressTest {
    id: string;
    portfolioId: string;
    testDate: Date;
    scenarioType: ScenarioType;
    scenarioName: string;
    scenarioDescription: string;
    marketShocks: MarketShock[];
    portfolioValue: number;
    portfolioValueChange: number;
    portfolioValueChangePercent: number;
    varImpact: number;
    expectedShortfallImpact: number;
    riskMetrics: RiskMetrics;
    metadata?: any;
    createdAt: Date;
}
export interface VolatilityModel {
    id: string;
    symbol: string;
    modelType: VolatilityModelType;
    parameters: VolatilityParameters;
    calibrationDate: Date;
    calibrationData: number[];
    fittedParameters: number[];
    forecastHorizon: number;
    volatilityForecast: number[];
    goodnessOfFit: number;
    metadata?: any;
    createdAt: Date;
}
export interface DerivativesPricing {
    id: string;
    instrumentType: DerivativeType;
    symbol: string;
    pricingDate: Date;
    maturity: Date;
    notional: number;
    price: number;
    fairValue: number;
    pv01: number;
    duration: number;
    convexity: number;
    model: PricingModel;
    parameters: any;
    metadata?: any;
    createdAt: Date;
}
export interface RiskAttribution {
    id: string;
    portfolioId: string;
    attributionDate: Date;
    totalReturn: number;
    benchmarkReturn: number;
    activeReturn: number;
    allocationEffect: number;
    selectionEffect: number;
    interactionEffect: number;
    factorExposures: FactorExposure[];
    factorReturns: FactorReturn[];
    factorContributions: FactorContribution[];
    metadata?: any;
    createdAt: Date;
}
export interface RegulatoryCompliance {
    id: string;
    entityId: string;
    reportDate: Date;
    regulation: RegulationType;
    capitalRequirement: number;
    riskWeightedAssets: number;
    tier1Capital: number;
    tier2Capital: number;
    leverageRatio: number;
    liquidityCoverageRatio: number;
    netStableFundingRatio: number;
    stressTestResults: StressTest[];
    metadata?: any;
    createdAt: Date;
}
export declare enum OptimizationMethod {
    MEAN_VARIANCE = "MEAN_VARIANCE",
    BLACK_LITTERMAN = "BLACK_LITTERMAN",
    RISK_PARITY = "RISK_PARITY",
    MAXIMUM_SHARPE = "MAXIMUM_SHARPE",
    MINIMUM_VARIANCE = "MINIMUM_VARIANCE",
    EQUAL_WEIGHT = "EQUAL_WEIGHT",
    MOMENTUM = "MOMENTUM",
    MEAN_REVERSION = "MEAN_REVERSION"
}
export declare enum OptionType {
    CALL = "CALL",
    PUT = "PUT"
}
export declare enum PricingModel {
    BLACK_SCHOLES = "BLACK_SCHOLES",
    BINOMIAL = "BINOMIAL",
    MONTE_CARLO = "MONTE_CARLO",
    FINITE_DIFFERENCE = "FINITE_DIFFERENCE",
    ANALYTICAL = "ANALYTICAL"
}
export declare enum InterestRateModelType {
    HULL_WHITE = "HULL_WHITE",
    VASICEK = "VASICEK",
    CIR = "CIR",
    BLACK_KARASINSKI = "BLACK_KARASINSKI",
    G2_PLUS = "G2_PLUS",
    LIBOR_MARKET_MODEL = "LIBOR_MARKET_MODEL"
}
export declare enum ScenarioType {
    HISTORICAL = "HISTORICAL",
    MONTE_CARLO = "MONTE_CARLO",
    STRESS = "STRESS",
    REGULATORY = "REGULATORY",
    CUSTOM = "CUSTOM"
}
export declare enum VolatilityModelType {
    GARCH = "GARCH",
    EGARCH = "EGARCH",
    GJR_GARCH = "GJR_GARCH",
    EWMA = "EWMA",
    IMPLIED = "IMPLIED",
    REALIZED = "REALIZED"
}
export declare enum DerivativeType {
    SWAP = "SWAP",
    FUTURE = "FUTURE",
    FORWARD = "FORWARD",
    OPTION = "OPTION",
    CAP = "CAP",
    FLOOR = "FLOOR",
    SWAPTION = "SWAPTION",
    CDS = "CDS"
}
export declare enum RegulationType {
    BASEL_III = "BASEL_III",
    SOLVENCY_II = "SOLVENCY_II",
    MIFID_II = "MIFID_II",
    EMIR = "EMIR",
    DODD_FRANK = "DODD_FRANK",
    CCAR = "CCAR"
}
export interface OptimizationConstraints {
    minWeight?: number;
    maxWeight?: number;
    maxTurnover?: number;
    longOnly?: boolean;
    sectorLimits?: {
        [sector: string]: number;
    };
    countryLimits?: {
        [country: string]: number;
    };
    currencyLimits?: {
        [currency: string]: number;
    };
}
export interface InterestRateParameters {
    meanReversion: number;
    volatility: number;
    longTermRate: number;
    initialRate: number;
}
export interface MarketShock {
    assetClass: string;
    shockType: 'absolute' | 'relative';
    shockValue: number;
    correlation: number;
}
export interface VolatilityParameters {
    alpha: number;
    beta: number;
    gamma: number;
    omega: number;
    lambda: number;
}
export interface FactorExposure {
    factorName: string;
    exposure: number;
    contribution: number;
}
export interface FactorReturn {
    factorName: string;
    return: number;
    volatility: number;
}
export interface FactorContribution {
    factorName: string;
    contribution: number;
    attribution: number;
}
export declare class QuantLibService {
    private static isInitialized;
    private static riskMetrics;
    private static portfolioOptimizations;
    private static optionsPricings;
    private static interestRateModels;
    private static creditRiskAssessments;
    private static stressTests;
    private static volatilityModels;
    private static derivativesPricings;
    private static riskAttributions;
    private static regulatoryCompliances;
    private static externalServiceUrl;
    private static externalServiceApiKey;
    private static externalServiceEnabled;
    private static externalServiceClient;
    /**
     * Initialize QuantLib Service
     */
    static initialize(): Promise<void>;
    /**
     * Calculate comprehensive risk metrics
     * Uses external Python service if available, otherwise falls back to local implementation
     */
    static calculateRiskMetrics(portfolioId: string, returns: number[], benchmarkReturns?: number[], riskFreeRate?: number, confidenceLevels?: number[]): Promise<RiskMetrics>;
    /**
     * Optimize portfolio using specified method
     */
    static optimizePortfolio(portfolioId: string, expectedReturns: number[], covarianceMatrix: number[][], method?: OptimizationMethod, constraints?: OptimizationConstraints, riskFreeRate?: number): Promise<PortfolioOptimization>;
    /**
     * Price options using specified model
     */
    static priceOption(symbol: string, optionType: OptionType, underlyingPrice: number, strikePrice: number, timeToExpiry: number, riskFreeRate: number, volatility: number, dividendYield?: number, model?: PricingModel): Promise<OptionsPricing>;
    /**
     * Perform stress testing
     */
    static performStressTest(portfolioId: string, scenarioType: ScenarioType, scenarioName: string, scenarioDescription: string, marketShocks: MarketShock[], portfolioValue: number, riskMetrics: RiskMetrics): Promise<StressTest>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static calculateMean;
    private static calculateVolatility;
    private static calculateSkewness;
    private static calculateKurtosis;
    private static calculateVaR;
    private static calculateCVaR;
    private static calculateExpectedShortfall;
    private static calculateSharpeRatio;
    private static calculateSortinoRatio;
    private static calculateMaxDrawdown;
    private static calculateBeta;
    private static calculateAlpha;
    private static calculateTrackingError;
    private static calculateInformationRatio;
    private static calculateTreynorRatio;
    private static calculateCalmarRatio;
    private static calculateSterlingRatio;
    private static calculateBurkeRatio;
    private static calculateKappa3;
    private static calculateOmega;
    private static calculateUpsidePotential;
    private static calculateDownsideDeviation;
    private static calculateJarqueBera;
    private static calculateCovariance;
    private static calculateVariance;
    private static calculateDrawdowns;
    private static maximizeSharpeRatio;
    private static minimizeVariance;
    private static equalWeight;
    private static riskParity;
    private static calculatePortfolioReturn;
    private static calculatePortfolioVolatility;
    private static blackScholes;
    private static binomialTree;
    private static monteCarlo;
    private static calculateIntrinsicValue;
    private static calculateImpliedVolatility;
    private static normalCDF;
    private static normalPDF;
    private static erf;
    private static calculateStressTestImpact;
    private static calculateVaRImpact;
    private static calculateExpectedShortfallImpact;
    private static initializeRiskEngines;
    private static loadExistingCalculations;
}
//# sourceMappingURL=quantlib.d.ts.map