"use strict";
/**
 * Broker Management Routes
 *
 * API endpoints for complete broker management:
 * - Broker onboarding and registration
 * - Broker configuration management
 * - White-label branding system
 * - Broker analytics and reporting
 * - Broker financial controls
 * - Broker compliance monitoring
 * - Broker user management
 * - Broker status management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const broker_management_1 = require("../services/broker-management");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
// =============================================================================
// BROKER ONBOARDING
// =============================================================================
/**
 * @swagger
 * /api/brokers/onboard:
 *   post:
 *     summary: Onboard new broker
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - domain
 *               - tier
 *               - contactInfo
 *               - businessInfo
 *             properties:
 *               name:
 *                 type: string
 *                 description: Broker name
 *               slug:
 *                 type: string
 *                 description: Unique broker slug
 *               domain:
 *                 type: string
 *                 description: Broker domain
 *               tier:
 *                 type: string
 *                 enum: [starter, professional, enterprise, custom]
 *                 description: Broker tier
 *               features:
 *                 type: object
 *                 properties:
 *                   trading:
 *                     type: boolean
 *                   margin:
 *                     type: boolean
 *                   nft:
 *                     type: boolean
 *                   dex:
 *                     type: boolean
 *                   presale:
 *                     type: boolean
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                   primaryColor:
 *                     type: string
 *                   secondaryColor:
 *                     type: string
 *               limits:
 *                 type: object
 *                 properties:
 *                   maxUsers:
 *                     type: number
 *                   maxTradingVolume:
 *                     type: number
 *               contactInfo:
 *                 type: object
 *                 required:
 *                   - email
 *                   - phone
 *                   - address
 *                   - country
 *                   - jurisdiction
 *                 properties:
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   address:
 *                     type: string
 *                   country:
 *                     type: string
 *                   jurisdiction:
 *                     type: string
 *               businessInfo:
 *                 type: object
 *                 required:
 *                   - type
 *                   - registrationNumber
 *                   - taxId
 *                   - licenseNumber
 *                   - regulatoryBody
 *                 properties:
 *                   type:
 *                     type: string
 *                   registrationNumber:
 *                     type: string
 *                   taxId:
 *                     type: string
 *                   licenseNumber:
 *                     type: string
 *                   regulatoryBody:
 *                     type: string
 *               technicalInfo:
 *                 type: object
 *                 properties:
 *                   expectedUsers:
 *                     type: number
 *                   expectedVolume:
 *                     type: number
 *                   expectedTradingPairs:
 *                     type: number
 *     responses:
 *       201:
 *         description: Broker onboarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 brokerId:
 *                   type: string
 *                 brokerName:
 *                   type: string
 *                 realmName:
 *                   type: string
 *                 adminUrl:
 *                   type: string
 *                 clientId:
 *                   type: string
 *                 clientSecret:
 *                   type: string
 *                 apiKey:
 *                   type: string
 *                 webhookSecret:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/onboard', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const onboardingRequest = req.body;
        // Validate required fields
        if (!onboardingRequest.name || !onboardingRequest.slug || !onboardingRequest.domain || !onboardingRequest.tier) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: name, slug, domain, tier'
            });
            return;
        }
        if (!onboardingRequest.contactInfo || !onboardingRequest.businessInfo) {
            res.status(400).json({
                success: false,
                error: 'Missing required sections: contactInfo, businessInfo'
            });
            return;
        }
        const result = await broker_management_1.BrokerManagementService.onboardBroker(onboardingRequest);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error || 'Broker onboarding failed'
            });
            return;
        }
        logger_1.LoggerService.info(`Broker onboarded successfully: ${result.brokerName}`, {
            brokerId: result.brokerId,
            realm: result.realmName
        });
        res.status(201).json(result);
    }
    catch (error) {
        logger_1.LoggerService.error('Broker onboarding failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to onboard broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// BROKER MANAGEMENT
// =============================================================================
/**
 * @swagger
 * /api/brokers:
 *   get:
 *     summary: Get all brokers
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of brokers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 brokers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       domain:
 *                         type: string
 *                       status:
 *                         type: string
 *                       tier:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const brokers = broker_management_1.BrokerManagementService.getAllBrokers();
        res.json({
            success: true,
            brokers: brokers.map(broker => ({
                id: broker.id,
                name: broker.name,
                slug: broker.slug,
                domain: broker.domain,
                status: broker.status,
                tier: broker.tier,
                features: broker.features,
                limits: broker.limits,
                branding: broker.branding,
                compliance: broker.compliance,
                financial: broker.financial,
                analytics: broker.analytics,
                createdAt: broker.createdAt,
                updatedAt: broker.updatedAt,
                lastActivityAt: broker.lastActivityAt
            }))
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get brokers failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get brokers',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/brokers/{brokerId}:
 *   get:
 *     summary: Get broker by ID
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Broker ID
 *     responses:
 *       200:
 *         description: Broker details
 *       404:
 *         description: Broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:brokerId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { brokerId } = req.params;
        if (!brokerId) {
            res.status(400).json({
                success: false,
                error: 'Broker ID is required'
            });
            return;
        }
        const broker = broker_management_1.BrokerManagementService.getBroker(brokerId);
        if (!broker) {
            res.status(404).json({
                success: false,
                error: 'Broker not found'
            });
            return;
        }
        res.json({
            success: true,
            broker: {
                id: broker.id,
                name: broker.name,
                slug: broker.slug,
                domain: broker.domain,
                status: broker.status,
                tier: broker.tier,
                features: broker.features,
                limits: broker.limits,
                branding: broker.branding,
                compliance: broker.compliance,
                financial: broker.financial,
                analytics: broker.analytics,
                createdAt: broker.createdAt,
                updatedAt: broker.updatedAt,
                createdBy: broker.createdBy,
                lastActivityAt: broker.lastActivityAt
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get broker failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/brokers/{brokerId}:
 *   put:
 *     summary: Update broker configuration
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Broker ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               domain:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, active, suspended, terminated, maintenance]
 *               tier:
 *                 type: string
 *                 enum: [starter, professional, enterprise, custom]
 *               features:
 *                 type: object
 *               branding:
 *                 type: object
 *               limits:
 *                 type: object
 *               compliance:
 *                 type: object
 *               financial:
 *                 type: object
 *     responses:
 *       200:
 *         description: Broker updated successfully
 *       404:
 *         description: Broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:brokerId', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { brokerId } = req.params;
        const updates = req.body;
        if (!brokerId) {
            res.status(400).json({
                success: false,
                error: 'Broker ID is required'
            });
            return;
        }
        const success = await broker_management_1.BrokerManagementService.updateBroker(brokerId, updates);
        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Broker not found'
            });
        }
        logger_1.LoggerService.info(`Broker updated: ${brokerId}`, {
            updates: Object.keys(updates)
        });
        res.json({
            success: true,
            message: 'Broker updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Update broker failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// BROKER STATUS MANAGEMENT
// =============================================================================
/**
 * @swagger
 * /api/brokers/{brokerId}/suspend:
 *   post:
 *     summary: Suspend broker
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Broker ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension
 *     responses:
 *       200:
 *         description: Broker suspended successfully
 *       404:
 *         description: Broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:brokerId/suspend', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { brokerId } = req.params;
        const { reason } = req.body;
        if (!brokerId) {
            res.status(400).json({
                success: false,
                error: 'Broker ID is required'
            });
            return;
        }
        if (!reason) {
            res.status(400).json({
                success: false,
                error: 'Suspension reason is required'
            });
            return;
        }
        const success = await broker_management_1.BrokerManagementService.suspendBroker(brokerId, reason);
        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Broker not found'
            });
        }
        logger_1.LoggerService.info(`Broker suspended: ${brokerId}`, {
            reason: reason
        });
        res.json({
            success: true,
            message: 'Broker suspended successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Suspend broker failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to suspend broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/brokers/{brokerId}/activate:
 *   post:
 *     summary: Activate broker
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Broker ID
 *     responses:
 *       200:
 *         description: Broker activated successfully
 *       404:
 *         description: Broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:brokerId/activate', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { brokerId } = req.params;
        if (!brokerId) {
            res.status(400).json({
                success: false,
                error: 'Broker ID is required'
            });
            return;
        }
        const success = await broker_management_1.BrokerManagementService.activateBroker(brokerId);
        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Broker not found'
            });
        }
        logger_1.LoggerService.info(`Broker activated: ${brokerId}`);
        res.json({
            success: true,
            message: 'Broker activated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Activate broker failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to activate broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// BROKER ANALYTICS
// =============================================================================
/**
 * @swagger
 * /api/brokers/{brokerId}/analytics:
 *   get:
 *     summary: Get broker analytics
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Broker ID
 *     responses:
 *       200:
 *         description: Broker analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         active:
 *                           type: number
 *                         new:
 *                           type: number
 *                         churn:
 *                           type: number
 *                         retention:
 *                           type: number
 *                     trading:
 *                       type: object
 *                       properties:
 *                         volume:
 *                           type: number
 *                         trades:
 *                           type: number
 *                         revenue:
 *                           type: number
 *                         fees:
 *                           type: number
 *                     financial:
 *                       type: object
 *                       properties:
 *                         deposits:
 *                           type: number
 *                         withdrawals:
 *                           type: number
 *                         netFlow:
 *                           type: number
 *                         balance:
 *                           type: number
 *                     compliance:
 *                       type: object
 *                       properties:
 *                         kycCompleted:
 *                           type: number
 *                         amlChecks:
 *                           type: number
 *                         ofacChecks:
 *                           type: number
 *                         violations:
 *                           type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: number
 *                         latency:
 *                           type: number
 *                         errors:
 *                           type: number
 *                         satisfaction:
 *                           type: number
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:brokerId/analytics', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { brokerId } = req.params;
        if (!brokerId) {
            res.status(400).json({
                success: false,
                error: 'Broker ID is required'
            });
            return;
        }
        const analytics = await broker_management_1.BrokerManagementService.getBrokerAnalytics(brokerId);
        if (!analytics) {
            res.status(404).json({
                success: false,
                error: 'Broker not found'
            });
        }
        res.json({
            success: true,
            analytics
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get broker analytics failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get broker analytics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// APZHEX BROKER MANAGEMENT
// =============================================================================
/**
 * @swagger
 * /api/brokers/apzhex:
 *   get:
 *     summary: Get APZHEX broker details
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: APZHEX broker details
 *       404:
 *         description: APZHEX broker not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/apzhex', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const apzhexBroker = broker_management_1.BrokerManagementService.getApzhexBroker();
        if (!apzhexBroker) {
            res.status(404).json({
                success: false,
                error: 'APZHEX broker not found'
            });
            return;
        }
        res.json({
            success: true,
            broker: {
                id: apzhexBroker.id,
                name: apzhexBroker.name,
                slug: apzhexBroker.slug,
                domain: apzhexBroker.domain,
                status: apzhexBroker.status,
                tier: apzhexBroker.tier,
                features: apzhexBroker.features,
                limits: apzhexBroker.limits,
                branding: apzhexBroker.branding,
                compliance: apzhexBroker.compliance,
                financial: apzhexBroker.financial,
                analytics: apzhexBroker.analytics,
                createdAt: apzhexBroker.createdAt,
                updatedAt: apzhexBroker.updatedAt,
                lastActivityAt: apzhexBroker.lastActivityAt
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get APZHEX broker failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get APZHEX broker',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// BROKER SEARCH
// =============================================================================
/**
 * @swagger
 * /api/brokers/search:
 *   get:
 *     summary: Search brokers
 *     tags: [Broker Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, suspended, terminated, maintenance]
 *         description: Filter by status
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [starter, professional, enterprise, custom]
 *         description: Filter by tier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Search results
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/search', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { q, status, tier, limit = 10, offset = 0 } = req.query;
        let brokers = broker_management_1.BrokerManagementService.getAllBrokers();
        // Apply filters
        if (status) {
            brokers = brokers.filter(broker => broker.status === status);
        }
        if (tier) {
            brokers = brokers.filter(broker => broker.tier === tier);
        }
        if (q) {
            const query = q.toLowerCase();
            brokers = brokers.filter(broker => broker.name.toLowerCase().includes(query) ||
                broker.slug.toLowerCase().includes(query) ||
                broker.domain.toLowerCase().includes(query));
        }
        // Apply pagination
        const total = brokers.length;
        const paginatedBrokers = brokers.slice(Number(offset), Number(offset) + Number(limit));
        res.json({
            success: true,
            brokers: paginatedBrokers.map(broker => ({
                id: broker.id,
                name: broker.name,
                slug: broker.slug,
                domain: broker.domain,
                status: broker.status,
                tier: broker.tier,
                createdAt: broker.createdAt,
                lastActivityAt: broker.lastActivityAt
            })),
            pagination: {
                total,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + Number(limit) < total
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Search brokers failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search brokers',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * @swagger
 * /api/brokers/health:
 *   get:
 *     summary: Get broker management service health status
 *     tags: [Broker Management]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 service:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 details:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                     brokersCount:
 *                       type: number
 *                     apzhexBroker:
 *                       type: string
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = broker_management_1.BrokerManagementService.isHealthy();
        const brokers = broker_management_1.BrokerManagementService.getAllBrokers();
        const apzhexBroker = broker_management_1.BrokerManagementService.getApzhexBroker();
        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            service: 'broker-management',
            timestamp: new Date().toISOString(),
            details: {
                initialized: broker_management_1.BrokerManagementService.isHealthy(),
                brokersCount: brokers.length,
                apzhexBroker: apzhexBroker?.id || null,
                brokers: brokers.map(broker => ({
                    id: broker.id,
                    name: broker.name,
                    slug: broker.slug,
                    status: broker.status,
                    tier: broker.tier
                }))
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Broker management health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            service: 'broker-management',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=broker-management.js.map