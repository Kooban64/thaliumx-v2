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

import { Router } from 'express';
import { AIMLService } from '../services/ai-ml';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { validateRequest } from '../middleware/error-handler';
import Joi from 'joi';
import { LoggerService } from '../services/logger';

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const predictionRequestSchema = Joi.object({
  modelId: Joi.string().required(),
  inputData: Joi.object().required(),
  predictionType: Joi.string().valid('price_prediction', 'volatility_prediction', 'risk_score', 'fraud_probability', 'sentiment_score', 'portfolio_allocation', 'trading_signal', 'market_direction').required(),
  confidence: Joi.number().min(0).max(1).optional(),
  metadata: Joi.object().optional()
});

const tradingSignalSchema = Joi.object({
  symbol: Joi.string().required(),
  modelId: Joi.string().optional()
});

const riskAssessmentSchema = Joi.object({
  userId: Joi.string().required(),
  portfolioId: Joi.string().required()
});

const fraudDetectionSchema = Joi.object({
  transactionId: Joi.string().required(),
  userId: Joi.string().required()
});

const sentimentAnalysisSchema = Joi.object({
  text: Joi.string().required(),
  source: Joi.string().valid('NEWS', 'SOCIAL_MEDIA', 'FORUM', 'BLOG').required()
});

const portfolioOptimizationSchema = Joi.object({
  userId: Joi.string().required(),
  currentAllocation: Joi.array().items(Joi.object({
    symbol: Joi.string().required(),
    weight: Joi.number().min(0).max(1).required(),
    expectedReturn: Joi.number().required(),
    risk: Joi.number().required(),
    category: Joi.string().required()
  })).required()
});

// =============================================================================
// MODEL MANAGEMENT ROUTES
// =============================================================================

/**
 * GET /api/ai-ml/models
 * Get all AI/ML models
 */
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const models = await AIMLService.getAllModels();
    
    res.json({
      success: true,
      data: models,
      count: models.length
    });
  } catch (error) {
    LoggerService.error('Failed to get models:', error);
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
router.get('/models/:modelId', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { modelId } = req.params;
    
    if (!modelId) {
      res.status(400).json({
        success: false,
        error: 'Model ID is required'
      });
      return;
    }
    
    const model = await AIMLService.getModel(modelId);
    
    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    LoggerService.error('Failed to get model:', error);
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
router.post('/predictions', authenticateToken, validateRequest(predictionRequestSchema), async (req, res) => {
  try {
    const prediction = await AIMLService.makePrediction(req.body);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    LoggerService.error('Failed to make prediction:', error);
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
router.get('/predictions', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.query;
    const predictions = await AIMLService.getPredictionHistory(modelId as string);
    
    res.json({
      success: true,
      data: predictions,
      count: predictions.length
    });
  } catch (error) {
    LoggerService.error('Failed to get predictions:', error);
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
router.post('/trading-signals', authenticateToken, requireRole(['trader', 'analyst', 'admin']), validateRequest(tradingSignalSchema), async (req, res) => {
  try {
    const { symbol, modelId } = req.body;
    const signal = await AIMLService.generateTradingSignal(symbol, modelId);
    
    res.json({
      success: true,
      data: signal
    });
  } catch (error) {
    LoggerService.error('Failed to generate trading signal:', error);
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
router.get('/trading-signals', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.query;
    const signals = await AIMLService.getTradingSignals(symbol as string);
    
    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    LoggerService.error('Failed to get trading signals:', error);
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
router.post('/risk-assessment', authenticateToken, requireRole(['risk', 'analyst', 'admin']), validateRequest(riskAssessmentSchema), async (req, res) => {
  try {
    const { userId, portfolioId } = req.body;
    const assessment = await AIMLService.performRiskAssessment(userId, portfolioId);
    
    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    LoggerService.error('Failed to perform risk assessment:', error);
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
router.get('/risk-assessment', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const assessments = await AIMLService.getRiskAssessments(userId as string);
    
    res.json({
      success: true,
      data: assessments,
      count: assessments.length
    });
  } catch (error) {
    LoggerService.error('Failed to get risk assessments:', error);
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
router.post('/fraud-detection', authenticateToken, requireRole(['compliance', 'security', 'admin']), validateRequest(fraudDetectionSchema), async (req, res) => {
  try {
    const { transactionId, userId } = req.body;
    const detection = await AIMLService.detectFraud(transactionId, userId);
    
    res.json({
      success: true,
      data: detection
    });
  } catch (error) {
    LoggerService.error('Failed to detect fraud:', error);
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
router.get('/fraud-detection', authenticateToken, requireRole(['compliance', 'security', 'admin']), async (req, res) => {
  try {
    const { userId } = req.query;
    const detections = await AIMLService.getFraudDetections(userId as string);
    
    res.json({
      success: true,
      data: detections,
      count: detections.length
    });
  } catch (error) {
    LoggerService.error('Failed to get fraud detections:', error);
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
router.post('/sentiment-analysis', authenticateToken, validateRequest(sentimentAnalysisSchema), async (req, res) => {
  try {
    const { text, source } = req.body;
    const analysis = await AIMLService.analyzeSentiment(text, source);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    LoggerService.error('Failed to analyze sentiment:', error);
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
router.get('/sentiment-analysis', authenticateToken, async (req, res) => {
  try {
    const { source } = req.query;
    const analyses = await AIMLService.getSentimentAnalyses(source as string);
    
    res.json({
      success: true,
      data: analyses,
      count: analyses.length
    });
  } catch (error) {
    LoggerService.error('Failed to get sentiment analyses:', error);
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
router.post('/portfolio-optimization', authenticateToken, requireRole(['analyst', 'portfolio_manager', 'admin']), validateRequest(portfolioOptimizationSchema), async (req, res) => {
  try {
    const { userId, currentAllocation } = req.body;
    const optimization = await AIMLService.optimizePortfolio(userId, currentAllocation);
    
    res.json({
      success: true,
      data: optimization
    });
  } catch (error) {
    LoggerService.error('Failed to optimize portfolio:', error);
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
router.get('/portfolio-optimization', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const optimizations = await AIMLService.getPortfolioOptimizations(userId as string);
    
    res.json({
      success: true,
      data: optimizations,
      count: optimizations.length
    });
  } catch (error) {
    LoggerService.error('Failed to get portfolio optimizations:', error);
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
router.get('/statistics', authenticateToken, requireRole(['admin', 'analyst']), async (req, res) => {
  try {
    const statistics = await AIMLService.getStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    LoggerService.error('Failed to get AI/ML statistics:', error);
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
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const isHealthy = AIMLService.isHealthy();
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get AI/ML health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get AI/ML health'
      }
    });
  }
});

export default router;
