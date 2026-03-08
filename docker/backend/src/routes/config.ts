/**
 * Configuration API Routes
 * 
 * Exposes configurable settings to the frontend including:
 * - Feature flags
 * - Currency configuration (symbol, code, locale)
 * - KYC level limits
 * - Role transaction limits
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { LoggerService } from '../services/logger';

const router: Router = Router();

/**
 * GET /api/config/features
 * Returns feature flags configuration
 */
router.get('/features', async (req: Request, res: Response): Promise<void> => {
  try {
    // Return default feature flags
    // These can be overridden by admin via settings
    const features = {
      trading: true,
      staking: true,
      nft: true,
      dex: true,
      presale: true,
      omniExchange: true,
      marginTrading: true,
      kyc: true,
      compliance: true,
      multiTenant: true,
    };

    res.json({
      success: true,
      data: features,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    LoggerService.error('Failed to get features config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve features configuration',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
