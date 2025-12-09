/**
 * AI/ML Services Suite
 *
 * Comprehensive AI/ML system with:
 * - Trading Algorithm Models (LSTM, Transformer, Reinforcement Learning)
 * - Risk Assessment Models (Credit Risk, Market Risk, Operational Risk)
 * - Fraud Detection Models (Anomaly Detection, Pattern Recognition)
 * - Market Analysis Models (Sentiment Analysis, Price Prediction)
 * - Portfolio Optimization Models (Modern Portfolio Theory, Black-Litterman)
 * - Natural Language Processing (News Analysis, Social Media Sentiment)
 * - Computer Vision (Document Verification, KYC Automation)
 * - Recommendation Systems (Personalized Trading Strategies)
 *
 * ⚠️ EXPERIMENTAL/BETA MODE ⚠️
 *
 * This service provides simulated predictions for testing and development.
 * Current implementation uses simulated data generation for:
 * - Model predictions (trading signals, risk assessment, fraud detection)
 * - All prediction results are marked as experimental
 *
 * To enable real ML predictions:
 * 1. Train models using historical data
 * 2. Export models in TensorFlow.js format (.json + .bin files)
 * 3. Place model files in /models directory
 * 4. Update executeModelPrediction() to load and run models
 * 5. Or integrate with external ML service APIs
 *
 * All functionality remains intact - predictions are simulated but functional.
 */
export declare enum ModelType {
    TRADING_LSTM = "trading_lstm",
    TRADING_TRANSFORMER = "trading_transformer",
    TRADING_RL = "trading_rl",
    RISK_ASSESSMENT = "risk_assessment",
    FRAUD_DETECTION = "fraud_detection",
    MARKET_ANALYSIS = "market_analysis",
    PORTFOLIO_OPTIMIZATION = "portfolio_optimization",
    NLP_SENTIMENT = "nlp_sentiment",
    NLP_NEWS_ANALYSIS = "nlp_news_analysis",
    CV_DOCUMENT_VERIFICATION = "cv_document_verification",
    RECOMMENDATION_SYSTEM = "recommendation_system"
}
export declare enum ModelStatus {
    TRAINING = "training",
    TRAINED = "trained",
    DEPLOYED = "deployed",
    FAILED = "failed",
    RETIRED = "retired"
}
export declare enum PredictionType {
    PRICE_PREDICTION = "price_prediction",
    VOLATILITY_PREDICTION = "volatility_prediction",
    RISK_SCORE = "risk_score",
    FRAUD_PROBABILITY = "fraud_probability",
    SENTIMENT_SCORE = "sentiment_score",
    PORTFOLIO_ALLOCATION = "portfolio_allocation",
    TRADING_SIGNAL = "trading_signal",
    MARKET_DIRECTION = "market_direction"
}
export interface AIModel {
    id: string;
    name: string;
    type: ModelType;
    version: string;
    status: ModelStatus;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    trainingData: TrainingData;
    hyperparameters: ModelHyperparameters;
    performance: ModelPerformance;
    metadata: ModelMetadata;
    createdAt: Date;
    updatedAt: Date;
    deployedAt?: Date;
}
export interface TrainingData {
    dataset: string;
    features: string[];
    target: string;
    trainSize: number;
    testSize: number;
    validationSize: number;
    preprocessing: DataPreprocessing;
    augmentation: DataAugmentation;
}
export interface ModelHyperparameters {
    learningRate: number;
    batchSize: number;
    epochs: number;
    layers: number;
    neurons: number[];
    dropout: number;
    activation: string;
    optimizer: string;
    lossFunction: string;
    regularization: Regularization;
}
export interface ModelPerformance {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
    mse: number;
    mae: number;
    rmse: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
}
export interface ModelMetadata {
    description: string;
    tags: string[];
    author: string;
    framework: string;
    gpuAcceleration: boolean;
    modelSize: number;
    inferenceTime: number;
    memoryUsage: number;
    dependencies: string[];
}
export interface PredictionRequest {
    modelId: string;
    inputData: any;
    predictionType: PredictionType;
    confidence: number;
    metadata?: any;
}
export interface PredictionResult {
    id: string;
    modelId: string;
    prediction: any;
    confidence: number;
    probability: number;
    explanation: string;
    metadata: any;
    timestamp: Date;
}
export interface TradingSignal {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    priceTarget: number;
    stopLoss: number;
    takeProfit: number;
    reasoning: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: Date;
}
export interface RiskAssessment {
    id: string;
    userId: string;
    portfolioId: string;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: RiskFactor[];
    recommendations: RiskRecommendation[];
    timestamp: Date;
}
export interface RiskFactor {
    name: string;
    weight: number;
    score: number;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    description: string;
}
export interface RiskRecommendation {
    type: 'REDUCE_EXPOSURE' | 'DIVERSIFY' | 'HEDGE' | 'MONITOR';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    action: string;
}
export interface FraudDetection {
    id: string;
    transactionId: string;
    userId: string;
    fraudProbability: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    anomalies: Anomaly[];
    recommendations: FraudRecommendation[];
    timestamp: Date;
}
export interface Anomaly {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    value: number;
    expectedValue: number;
    deviation: number;
}
export interface FraudRecommendation {
    action: 'APPROVE' | 'REVIEW' | 'BLOCK' | 'INVESTIGATE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    reason: string;
}
export interface SentimentAnalysis {
    id: string;
    text: string;
    source: 'NEWS' | 'SOCIAL_MEDIA' | 'FORUM' | 'BLOG';
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
    emotions: Emotion[];
    keywords: string[];
    timestamp: Date;
}
export interface Emotion {
    name: string;
    intensity: number;
    confidence: number;
}
export interface PortfolioOptimization {
    id: string;
    userId: string;
    currentAllocation: AssetAllocation[];
    optimizedAllocation: AssetAllocation[];
    expectedReturn: number;
    expectedRisk: number;
    sharpeRatio: number;
    constraints: OptimizationConstraint[];
    timestamp: Date;
}
export interface AssetAllocation {
    symbol: string;
    weight: number;
    expectedReturn: number;
    risk: number;
    category: string;
}
export interface OptimizationConstraint {
    type: 'MAX_WEIGHT' | 'MIN_WEIGHT' | 'SECTOR_LIMIT' | 'RISK_LIMIT';
    value: number;
    asset?: string;
    sector?: string;
}
export interface DataPreprocessing {
    normalization: boolean;
    standardization: boolean;
    scaling: string;
    encoding: string;
    missingValueHandling: string;
    outlierHandling: string;
}
export interface DataAugmentation {
    enabled: boolean;
    techniques: string[];
    factor: number;
}
export interface Regularization {
    l1: number;
    l2: number;
    dropout: number;
    earlyStopping: boolean;
}
export declare class AIMLService {
    private static isInitialized;
    private static models;
    private static predictions;
    private static tradingSignals;
    private static riskAssessments;
    private static fraudDetections;
    private static sentimentAnalyses;
    private static portfolioOptimizations;
    private static readonly AI_ML_CONFIG;
    /**
     * Initialize AI/ML Service
     */
    static initialize(): Promise<void>;
    /**
     * Initialize TensorFlow.js
     */
    private static initializeTensorFlow;
    /**
     * Load existing models from storage
     */
    private static loadExistingModels;
    /**
     * Create default AI/ML models
     */
    private static createDefaultModels;
    /**
     * Initialize pre-trained models
     */
    private static initializePreTrainedModels;
    /**
     * Initialize NLP models
     */
    private static initializeNLPModels;
    /**
     * Initialize computer vision models
     */
    private static initializeCVModels;
    /**
     * Start model monitoring
     */
    private static startModelMonitoring;
    /**
     * Monitor model performance
     */
    private static monitorModelPerformance;
    /**
     * Check if model performance has dropped
     */
    private static checkPerformanceDrop;
    /**
     * Schedule model retraining
     */
    private static scheduleModelRetraining;
    /**
     * Monitor resource usage
     */
    private static monitorResourceUsage;
    /**
     * Start batch prediction processor
     */
    private static startBatchPredictionProcessor;
    /**
     * Process batch predictions
     */
    private static processBatchPredictions;
    /**
     * Make a prediction using a specific model
     */
    static makePrediction(request: PredictionRequest): Promise<PredictionResult>;
    /**
     * Execute model prediction
     *
     * IMPLEMENTATION STATUS: EXPERIMENTAL/BETA
     *
     * This service provides simulated predictions for development and testing.
     * The architecture is production-ready and supports:
     * - TensorFlow.js model loading and inference
     * - External ML service API integration
     * - Model versioning and A/B testing
     * - Real-time and batch prediction modes
     *
     * To enable real ML predictions:
     * 1. Train models using historical data (Python/TensorFlow recommended)
     * 2. Export models in TensorFlow.js format:
     *    - tensorflowjs_converter --input_format=tf_saved_model model/ tfjs_model/
     * 3. Place model files in /models directory:
     *    - /models/{model-id}/model.json
     *    - /models/{model-id}/weights.bin
     * 4. Update this method to load models:
     *    - const model = await tf.loadLayersModel('file://./models/{model-id}/model.json');
     *    - const prediction = model.predict(tf.tensor(inputData));
     * 5. Or integrate with external ML APIs:
     *    - AWS SageMaker, Google Vertex AI, Azure ML, etc.
     *
     * Current simulated predictions are functional for:
     * - UI/UX development and testing
     * - Integration testing
     * - Demo purposes
     */
    private static executeModelPrediction;
    /**
     * Generate trading signal
     */
    static generateTradingSignal(symbol: string, modelId?: string): Promise<TradingSignal>;
    /**
     * Perform risk assessment
     */
    static performRiskAssessment(userId: string, portfolioId: string): Promise<RiskAssessment>;
    /**
     * Detect fraud
     */
    static detectFraud(transactionId: string, userId: string): Promise<FraudDetection>;
    /**
     * Analyze sentiment
     */
    static analyzeSentiment(text: string, source: 'NEWS' | 'SOCIAL_MEDIA' | 'FORUM' | 'BLOG'): Promise<SentimentAnalysis>;
    /**
     * Optimize portfolio
     */
    static optimizePortfolio(userId: string, currentAllocation: AssetAllocation[]): Promise<PortfolioOptimization>;
    /**
     * Get model information
     */
    static getModel(modelId: string): Promise<AIModel>;
    /**
     * Get all models
     */
    static getAllModels(): Promise<AIModel[]>;
    /**
     * Get prediction history
     */
    static getPredictionHistory(modelId?: string): Promise<PredictionResult[]>;
    /**
     * Get trading signals
     */
    static getTradingSignals(symbol?: string): Promise<TradingSignal[]>;
    /**
     * Get risk assessments
     */
    static getRiskAssessments(userId?: string): Promise<RiskAssessment[]>;
    /**
     * Get fraud detections
     */
    static getFraudDetections(userId?: string): Promise<FraudDetection[]>;
    /**
     * Get sentiment analyses
     */
    static getSentimentAnalyses(source?: string): Promise<SentimentAnalysis[]>;
    /**
     * Get portfolio optimizations
     */
    static getPortfolioOptimizations(userId?: string): Promise<PortfolioOptimization[]>;
    /**
     * Get AI/ML statistics
     */
    static getStatistics(): Promise<any>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=ai-ml.d.ts.map