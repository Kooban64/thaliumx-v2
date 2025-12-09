import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';
import { DeviceFingerprintService, DeviceFingerprintData } from '../services/device-fingerprint';
import { createError } from '../utils';

const router: Router = Router();

/**
 * POST /api/security/fingerprint
 * Submit device fingerprint for analysis
 */
router.post('/fingerprint',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)?.id;
      const tenantId = (req.user as any)?.tenantId;
      const brokerId = (req.user as any)?.brokerId;
      
      const deviceData: DeviceFingerprintData = req.body;
      
      // Validate required fields
      if (!deviceData.userAgent || !deviceData.language || !deviceData.platform) {
        throw createError('Missing required device fingerprint data', 400, 'INVALID_FINGERPRINT_DATA');
      }

      // Get IP address from request
      const ipAddress = req.ip || 
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
        req.socket.remoteAddress ||
        'unknown';

      // Analyze device
      const deviceRecord = await DeviceFingerprintService.analyzeDevice(
        deviceData,
        userId,
        tenantId,
        brokerId,
        ipAddress
      );

      res.json({
        success: true,
        data: {
          fingerprint: deviceRecord.fingerprintHash.substring(0, 16) + '...',
          riskScore: deviceRecord.riskScore,
          isTrusted: deviceRecord.isTrusted,
          isNewDevice: deviceRecord.usageCount === 1,
          suspiciousActivity: deviceRecord.suspiciousActivity
        },
        message: 'Device fingerprint analyzed successfully'
      });

    } catch (error) {
      LoggerService.error('Device fingerprint submission failed:', { error });
      next(error);
    }
  }
);

/**
 * GET /api/security/fingerprint/devices
 * Get all devices for current user
 */
router.get('/fingerprint/devices',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)?.id;
      
      if (!userId) {
        throw createError('User ID required', 400, 'USER_ID_REQUIRED');
      }

      const devices = DeviceFingerprintService.getUserDevices(userId);

      res.json({
        success: true,
        data: devices.map(d => ({
          id: d.id,
          fingerprint: d.fingerprintHash.substring(0, 16) + '...',
          riskScore: d.riskScore,
          isTrusted: d.isTrusted,
          lastSeen: d.lastSeen,
          firstSeen: d.firstSeen,
          usageCount: d.usageCount,
          suspiciousActivity: d.suspiciousActivity,
          deviceInfo: {
            platform: d.deviceInfo.platform,
            language: d.deviceInfo.language,
            screen: d.deviceInfo.screen
          }
        })),
        message: 'User devices retrieved successfully'
      });

    } catch (error) {
      LoggerService.error('Get user devices failed:', { error });
      next(error);
    }
  }
);

export default router;
