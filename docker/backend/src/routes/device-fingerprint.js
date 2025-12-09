"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const device_fingerprint_1 = require("../services/device-fingerprint");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
/**
 * POST /api/security/fingerprint
 * Submit device fingerprint for analysis
 */
router.post('/fingerprint', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        const deviceData = req.body;
        // Validate required fields
        if (!deviceData.userAgent || !deviceData.language || !deviceData.platform) {
            throw (0, utils_1.createError)('Missing required device fingerprint data', 400, 'INVALID_FINGERPRINT_DATA');
        }
        // Get IP address from request
        const ipAddress = req.ip ||
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket.remoteAddress ||
            'unknown';
        // Analyze device
        const deviceRecord = await device_fingerprint_1.DeviceFingerprintService.analyzeDevice(deviceData, userId, tenantId, brokerId, ipAddress);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Device fingerprint submission failed:', { error });
        next(error);
    }
});
/**
 * GET /api/security/fingerprint/devices
 * Get all devices for current user
 */
router.get('/fingerprint/devices', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw (0, utils_1.createError)('User ID required', 400, 'USER_ID_REQUIRED');
        }
        const devices = device_fingerprint_1.DeviceFingerprintService.getUserDevices(userId);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Get user devices failed:', { error });
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=device-fingerprint.js.map