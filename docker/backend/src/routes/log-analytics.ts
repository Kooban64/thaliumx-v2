/**
 * Log Analytics API Routes
 * 
 * Provides API endpoints for log analytics and pattern detection.
 */

import { Router, type Request, type Response } from 'express';
import { LogAnalyticsService } from '../services/log-analytics';
import { LoggerService } from '../services/logger';

const router: ReturnType<typeof Router> = Router();

/**
 * Get log trends
 * GET /api/log-analytics/trends
 * Query params: startDate, endDate, logDir
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, logDir } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: startDate, endDate',
      });
      return;
    }

    const logDirPath: string | undefined = logDir ? (logDir as string) : undefined;
    const trends = await LogAnalyticsService.getTrends(
      logDirPath,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    LoggerService.error('Failed to get log trends', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get log trends',
    });
  }
});

/**
 * Get pattern statistics
 * GET /api/log-analytics/patterns
 */
router.get('/patterns', (_req: Request, res: Response) => {
  try {
    LogAnalyticsService.initialize();
    const stats = LogAnalyticsService.getPatternStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    LoggerService.error('Failed to get pattern statistics', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get pattern statistics',
    });
  }
});

export default router;