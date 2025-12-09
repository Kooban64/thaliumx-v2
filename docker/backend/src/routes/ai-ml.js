"use strict";
/**
 * AI/ML Routes
 *
 * API endpoints for AI/ML Services Suite:
 * - Model Management
 * - Predictions
 * - Trading Signals
 * - Risk Assessment
 * - Fraud Detection
 * - Sentiment Analysis
 * - Portfolio Optimization
 * - Statistics and Monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_ml_1 = require("../services/ai-ml");
const error_handler_1 = require("../middleware/error-handler");
const error_handler_2 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const predictionRequestSchema = joi_1.default.object({
    modelId: joi_1.default.string().required(),
    inputData: joi_1.default.object().required(),
    predictionType: joi_1.default.string().valid('price_prediction', 'volatility_prediction', 'risk_score', 'fraud_probability', 'sentiment_score', 'portfolio_allocation', 'trading_signal', 'market_direction').required(),
    confidence: joi_1.default.number().min(0).max(1).optional(),
    metadata: joi_1.default.object().optional()
});
const tradingSignalSchema = joi_1.default.object({
    symbol: joi_1.default.string().required(),
    modelId: joi_1.default.string().optional()
});
const riskAssessmentSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    portfolioId: joi_1.default.string().required()
});
const fraudDetectionSchema = joi_1.default.object({
    transactionId: joi_1.default.string().required(),
    userId: joi_1.default.string().required()
});
const sentimentAnalysisSchema = joi_1.default.object({
    text: joi_1.default.string().required(),
    source: joi_1.default.string().valid('NEWS', 'SOCIAL_MEDIA', 'FORUM', 'BLOG').required()
});
const portfolioOptimizationSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    currentAllocation: joi_1.default.array().items(joi_1.default.object({
        symbol: joi_1.default.string().required(),
        weight: joi_1.default.number().min(0).max(1).required(),
        expectedReturn: joi_1.default.number().required(),
        risk: joi_1.default.number().required(),
        category: joi_1.default.string().required()
    })).required()
});
// =============================================================================
// MODEL MANAGEMENT ROUTES
// =============================================================================
/**
 * GET /api/ai-ml/models
 * Get all AI/ML models
 */
router.get('/models', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const models = await ai_ml_1.AIMLService.getAllModels();
        res.json({
            success: true,
            data: models,
            count: models.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get models:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get models'
            }
        });
    }
});
/**
 * GET /api/ai-ml/models/:modelId
 * Get specific AI/ML model
 */
router.get('/models/:modelId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { modelId } = req.params;
        if (!modelId) {
            res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
            return;
        }
        const model = await ai_ml_1.AIMLService.getModel(modelId);
        res.json({
            success: true,
            data: model
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get model:', error);
        res.status(404).json({
            success: false,
            error: {
                code: 'MODEL_NOT_FOUND',
                message: 'Model not found'
            }
        });
    }
});
// =============================================================================
// PREDICTION ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/predictions
 * Make a prediction using a specific model
 */
router.post('/predictions', error_handler_1.authenticateToken, (0, error_handler_2.validateRequest)(predictionRequestSchema), async (req, res) => {
    try {
        const prediction = await ai_ml_1.AIMLService.makePrediction(req.body);
        res.json({
            success: true,
            data: prediction
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to make prediction:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'PREDICTION_FAILED',
                message: 'Failed to make prediction'
            }
        });
    }
});
/**
 * GET /api/ai-ml/predictions
 * Get prediction history
 */
router.get('/predictions', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { modelId } = req.query;
        const predictions = await ai_ml_1.AIMLService.getPredictionHistory(modelId);
        res.json({
            success: true,
            data: predictions,
            count: predictions.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get predictions:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get predictions'
            }
        });
    }
});
// =============================================================================
// TRADING SIGNAL ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/trading-signals
 * Generate trading signal
 */
router.post('/trading-signals', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['trader', 'analyst', 'admin']), (0, error_handler_2.validateRequest)(tradingSignalSchema), async (req, res) => {
    try {
        const { symbol, modelId } = req.body;
        const signal = await ai_ml_1.AIMLService.generateTradingSignal(symbol, modelId);
        res.json({
            success: true,
            data: signal
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to generate trading signal:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'SIGNAL_GENERATION_FAILED',
                message: 'Failed to generate trading signal'
            }
        });
    }
});
/**
 * GET /api/ai-ml/trading-signals
 * Get trading signals
 */
router.get('/trading-signals', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { symbol } = req.query;
        const signals = await ai_ml_1.AIMLService.getTradingSignals(symbol);
        res.json({
            success: true,
            data: signals,
            count: signals.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get trading signals:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get trading signals'
            }
        });
    }
});
// =============================================================================
// RISK ASSESSMENT ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/risk-assessment
 * Perform risk assessment
 */
router.post('/risk-assessment', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['risk', 'analyst', 'admin']), (0, error_handler_2.validateRequest)(riskAssessmentSchema), async (req, res) => {
    try {
        const { userId, portfolioId } = req.body;
        const assessment = await ai_ml_1.AIMLService.performRiskAssessment(userId, portfolioId);
        res.json({
            success: true,
            data: assessment
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to perform risk assessment:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'RISK_ASSESSMENT_FAILED',
                message: 'Failed to perform risk assessment'
            }
        });
    }
});
/**
 * GET /api/ai-ml/risk-assessment
 * Get risk assessments
 */
router.get('/risk-assessment', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.query;
        const assessments = await ai_ml_1.AIMLService.getRiskAssessments(userId);
        res.json({
            success: true,
            data: assessments,
            count: assessments.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get risk assessments:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get risk assessments'
            }
        });
    }
});
// =============================================================================
// FRAUD DETECTION ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/fraud-detection
 * Detect fraud
 */
router.post('/fraud-detection', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['compliance', 'security', 'admin']), (0, error_handler_2.validateRequest)(fraudDetectionSchema), async (req, res) => {
    try {
        const { transactionId, userId } = req.body;
        const detection = await ai_ml_1.AIMLService.detectFraud(transactionId, userId);
        res.json({
            success: true,
            data: detection
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to detect fraud:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'FRAUD_DETECTION_FAILED',
                message: 'Failed to detect fraud'
            }
        });
    }
});
/**
 * GET /api/ai-ml/fraud-detection
 * Get fraud detections
 */
router.get('/fraud-detection', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['compliance', 'security', 'admin']), async (req, res) => {
    try {
        const { userId } = req.query;
        const detections = await ai_ml_1.AIMLService.getFraudDetections(userId);
        res.json({
            success: true,
            data: detections,
            count: detections.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get fraud detections:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get fraud detections'
            }
        });
    }
});
// =============================================================================
// SENTIMENT ANALYSIS ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/sentiment-analysis
 * Analyze sentiment
 */
router.post('/sentiment-analysis', error_handler_1.authenticateToken, (0, error_handler_2.validateRequest)(sentimentAnalysisSchema), async (req, res) => {
    try {
        const { text, source } = req.body;
        const analysis = await ai_ml_1.AIMLService.analyzeSentiment(text, source);
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to analyze sentiment:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'SENTIMENT_ANALYSIS_FAILED',
                message: 'Failed to analyze sentiment'
            }
        });
    }
});
/**
 * GET /api/ai-ml/sentiment-analysis
 * Get sentiment analyses
 */
router.get('/sentiment-analysis', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { source } = req.query;
        const analyses = await ai_ml_1.AIMLService.getSentimentAnalyses(source);
        res.json({
            success: true,
            data: analyses,
            count: analyses.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get sentiment analyses:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get sentiment analyses'
            }
        });
    }
});
// =============================================================================
// PORTFOLIO OPTIMIZATION ROUTES
// =============================================================================
/**
 * POST /api/ai-ml/portfolio-optimization
 * Optimize portfolio
 */
router.post('/portfolio-optimization', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['analyst', 'portfolio_manager', 'admin']), (0, error_handler_2.validateRequest)(portfolioOptimizationSchema), async (req, res) => {
    try {
        const { userId, currentAllocation } = req.body;
        const optimization = await ai_ml_1.AIMLService.optimizePortfolio(userId, currentAllocation);
        res.json({
            success: true,
            data: optimization
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to optimize portfolio:', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'PORTFOLIO_OPTIMIZATION_FAILED',
                message: 'Failed to optimize portfolio'
            }
        });
    }
});
/**
 * GET /api/ai-ml/portfolio-optimization
 * Get portfolio optimizations
 */
router.get('/portfolio-optimization', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.query;
        const optimizations = await ai_ml_1.AIMLService.getPortfolioOptimizations(userId);
        res.json({
            success: true,
            data: optimizations,
            count: optimizations.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get portfolio optimizations:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get portfolio optimizations'
            }
        });
    }
});
// =============================================================================
// STATISTICS ROUTES
// =============================================================================
/**
 * GET /api/ai-ml/statistics
 * Get AI/ML statistics
 */
router.get('/statistics', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'analyst']), async (req, res) => {
    try {
        const statistics = await ai_ml_1.AIMLService.getStatistics();
        res.json({
            success: true,
            data: statistics
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get AI/ML statistics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get AI/ML statistics'
            }
        });
    }
});
/**
 * GET /api/ai-ml/health
 * Get AI/ML service health
 */
router.get('/health', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const isHealthy = ai_ml_1.AIMLService.isHealthy();
        res.json({
            success: true,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get AI/ML health:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get AI/ML health'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=ai-ml.js.map