/**
 * Keycloak Routes
 * 
 * API endpoints for Keycloak integration:
 * - Broker realm management
 * - User management across realms
 * - User migration between brokers
 * - Token validation
 * - Role and group management
 * - Realm provisioning
 */

import { Router, Request, Response } from 'express';
import { KeycloakService } from '../services/keycloak';
import { authenticateToken, validateRequest } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';
import { EventStreamingService } from '../services/event-streaming';
import { AppError, createError } from '../utils';

const router: Router = Router();

// =============================================================================
// BROKER REALM MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/keycloak/brokers:
 *   post:
 *     summary: Create new broker realm
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brokerId
 *               - brokerName
 *               - domain
 *             properties:
 *               brokerId:
 *                 type: string
 *                 description: Unique broker identifier
 *               brokerName:
 *                 type: string
 *                 description: Display name for the broker
 *               domain:
 *                 type: string
 *                 description: Broker domain
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                   favicon:
 *                     type: string
 *                   primaryColor:
 *                     type: string
 *                   secondaryColor:
 *                     type: string
 *                   customCss:
 *                     type: string
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
 *               limits:
 *                 type: object
 *                 properties:
 *                   maxUsers:
 *                     type: number
 *                   maxTradingVolume:
 *                     type: number
 *                   maxMarginLeverage:
 *                     type: number
 *     responses:
 *       201:
 *         description: Broker realm created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 realmName:
 *                   type: string
 *                 brokerId:
 *                   type: string
 *                 adminUrl:
 *                   type: string
 *                 clientId:
 *                   type: string
 *                 clientSecret:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/brokers', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const brokerConfig = req.body;
    
    // Validate required fields
    if (!brokerConfig.brokerId || !brokerConfig.brokerName || !brokerConfig.domain) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: brokerId, brokerName, domain'
      });
      return;
    }

    // Set default values
    const defaultConfig = {
      realm: `${brokerConfig.brokerId}-broker`,
      displayName: brokerConfig.brokerName,
      enabled: true,
      branding: {
        logo: '/assets/logos/default-logo.png',
        favicon: '/assets/favicons/default-favicon.ico',
        primaryColor: '#1e40af',
        secondaryColor: '#3b82f6',
        customCss: ''
      },
      features: {
        trading: true,
        margin: true,
        nft: false,
        dex: false,
        presale: false
      },
      limits: {
        maxUsers: 10000,
        maxTradingVolume: 10000000,
        maxMarginLeverage: 5
      },
      apzhexIntegration: false,
      accessTokenLifespan: 300,
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 36000,
      offlineSessionIdleTimeout: 2592000,
      offlineSessionMaxLifespan: 5184000,
      accessCodeLifespan: 60,
      accessCodeLifespanUserAction: 300,
      accessCodeLifespanLogin: 1800,
      actionTokenGeneratedByAdminLifespan: 43200,
      actionTokenGeneratedByUserLifespan: 300,
      oauth2DeviceCodeLifespan: 600,
      oauth2DevicePollingInterval: 5,
      internationalizationEnabled: true,
      supportedLocales: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
      defaultLocale: 'en',
      passwordPolicy: 'length(8) and digits(2) and lowerCase(2) and upperCase(2) and specialChars(1)',
      browserFlow: 'browser',
      directGrantFlow: 'direct grant',
      clientAuthenticationFlow: 'clients',
      dockerAuthenticationFlow: 'docker auth',
      resetCredentialsFlow: 'reset credentials',
      loginFlow: 'browser',
      firstBrokerLoginFlow: 'first broker login',
      registrationFlow: 'registration',
      registrationPageFlow: 'registration page',
      browserFlowSelection: 'browser',
      otpPolicyType: 'totp',
      otpPolicyAlgorithm: 'HmacSHA1',
      otpPolicyInitialCounter: 0,
      otpPolicyDigits: 6,
      otpPolicyLookAheadWindow: 1,
      otpPolicyPeriod: 30,
      webAuthnPolicyRpEntityName: `${brokerConfig.brokerName} Broker`,
      webAuthnPolicySignatureAlgorithms: ['ES256'],
      webAuthnPolicyRpId: brokerConfig.domain,
      webAuthnPolicyAttestationConveyancePreference: 'not specified',
      webAuthnPolicyAuthenticatorAttachment: 'not specified',
      webAuthnPolicyRequireResidentKey: 'not specified',
      webAuthnPolicyUserVerificationRequirement: 'not specified',
      webAuthnPolicyCreateTimeout: 0,
      webAuthnPolicyAvoidSameAuthenticatorRegister: false,
      webAuthnPolicyAcceptableAaguids: [],
      webAuthnPolicyPasswordlessRpEntityName: `${brokerConfig.brokerName} Broker`,
      webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256'],
      webAuthnPolicyPasswordlessRpId: brokerConfig.domain,
      webAuthnPolicyPasswordlessAttestationConveyancePreference: 'not specified',
      webAuthnPolicyPasswordlessAuthenticatorAttachment: 'not specified',
      webAuthnPolicyPasswordlessRequireResidentKey: 'not specified',
      webAuthnPolicyPasswordlessUserVerificationRequirement: 'not specified',
      webAuthnPolicyPasswordlessCreateTimeout: 0,
      webAuthnPolicyPasswordlessAvoidSameAuthenticatorRegister: false,
      webAuthnPolicyPasswordlessAcceptableAaguids: [],
      otpSupportedApplications: ['FreeOTP', 'Google Authenticator'],
      webAuthnSupportedApplications: ['Chrome', 'Firefox', 'Safari'],
      attributes: {
        'broker.realm': ['true'],
        'broker.id': [brokerConfig.brokerId],
        'broker.version': ['1.0.0']
      },
      ...brokerConfig
    };

    const result = await KeycloakService.createBrokerRealm(defaultConfig);

    LoggerService.info(`Broker realm created: ${brokerConfig.brokerId}`, {
      brokerId: brokerConfig.brokerId,
      brokerName: brokerConfig.brokerName,
      realm: result.realmName
    });

    res.status(201).json(result);

  } catch (error) {
    LoggerService.error('Create broker realm failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create broker realm',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/keycloak/brokers:
 *   get:
 *     summary: Get all broker realms
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of broker realms
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
 *                       realm:
 *                         type: string
 *                       brokerId:
 *                         type: string
 *                       brokerName:
 *                         type: string
 *                       domain:
 *                         type: string
 *                       enabled:
 *                         type: boolean
 *                       features:
 *                         type: object
 *                       limits:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/brokers', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const brokers = KeycloakService.getBrokerRealms();

    res.json({
      success: true,
      brokers: brokers.map(broker => ({
        realm: broker.realm,
        brokerId: broker.brokerId,
        brokerName: broker.brokerName,
        domain: broker.domain,
        enabled: broker.enabled,
        features: broker.features,
        limits: broker.limits,
        apzhexIntegration: broker.apzhexIntegration
      }))
    });

  } catch (error) {
    LoggerService.error('Get broker realms failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get broker realms',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/keycloak/users:
 *   post:
 *     summary: Create user in specific realm
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - realmName
 *               - username
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               realmName:
 *                 type: string
 *                 description: Target realm name
 *               username:
 *                 type: string
 *                 description: Username
 *               email:
 *                 type: string
 *                 description: Email address
 *               firstName:
 *                 type: string
 *                 description: First name
 *               lastName:
 *                 type: string
 *                 description: Last name
 *               enabled:
 *                 type: boolean
 *                 default: true
 *               emailVerified:
 *                 type: boolean
 *                 default: false
 *               brokerId:
 *                 type: string
 *                 description: Broker ID
 *               tenantId:
 *                 type: string
 *                 description: Tenant ID
 *               kycLevel:
 *                 type: string
 *                 default: basic
 *               kycStatus:
 *                 type: string
 *                 default: not_started
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/users', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName, ...userData } = req.body;

    if (!realmName || !userData.username || !userData.email || !userData.firstName || !userData.lastName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: realmName, username, email, firstName, lastName'
      });
      return;
    }

    const user = await KeycloakService.createUser(realmName, {
      ...userData,
      enabled: userData.enabled !== false,
      emailVerified: userData.emailVerified === true,
      kycLevel: userData.kycLevel || 'basic',
      kycStatus: userData.kycStatus || 'not_started'
    });

    LoggerService.info(`User created in realm ${realmName}: ${userData.username}`, {
      userId: user.id,
      realm: realmName,
      brokerId: userData.brokerId
    });

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        emailVerified: user.emailVerified,
        brokerId: userData.brokerId,
        tenantId: userData.tenantId,
        kycLevel: userData.kycLevel,
        kycStatus: userData.kycStatus
      }
    });

  } catch (error) {
    LoggerService.error('Create user failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/keycloak/users/{realmName}/{userId}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: realmName
 *         required: true
 *         schema:
 *           type: string
 *         description: Realm name
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/users/:realmName/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName, userId } = req.params;

    if (!realmName || !userId) {
      res.status(400).json({
        success: false,
        error: 'Realm name and User ID are required'
      });
      return;
    }

    const user = await KeycloakService.getUser(realmName, userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        emailVerified: user.emailVerified,
        attributes: user.attributes,
        groups: user.groups,
        roles: user.roles
      }
    });

  } catch (error) {
    LoggerService.error('Get user failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/keycloak/users/{realmName}/{userId}:
 *   put:
 *     summary: Update user
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: realmName
 *         required: true
 *         schema:
 *           type: string
 *         description: Realm name
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               emailVerified:
 *                 type: boolean
 *               attributes:
 *                 type: object
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/users/:realmName/:userId', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName, userId } = req.params;
    const updates = req.body;

    if (!realmName || !userId) {
      res.status(400).json({
        success: false,
        error: 'Realm name and User ID are required'
      });
      return;
    }

    await KeycloakService.updateUser(realmName, userId, updates);

    LoggerService.info(`User updated in realm ${realmName}: ${userId}`);

    res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error) {
    LoggerService.error('Update user failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// USER MIGRATION
// =============================================================================

/**
 * @swagger
 * /api/keycloak/migrate:
 *   post:
 *     summary: Migrate user between brokers
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fromBrokerId
 *               - toBrokerId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to migrate
 *               fromBrokerId:
 *                 type: string
 *                 description: Source broker ID
 *               toBrokerId:
 *                 type: string
 *                 description: Target broker ID
 *               preserveRoles:
 *                 type: boolean
 *                 default: true
 *                 description: Preserve user roles
 *               preserveGroups:
 *                 type: boolean
 *                 default: true
 *                 description: Preserve user groups
 *               notifyUser:
 *                 type: boolean
 *                 default: true
 *                 description: Notify user of migration
 *     responses:
 *       200:
 *         description: User migrated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/migrate', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const migrationRequest = req.body;

    if (!migrationRequest.userId || !migrationRequest.fromBrokerId || !migrationRequest.toBrokerId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, fromBrokerId, toBrokerId'
      });
      return;
    }

    const result = await KeycloakService.migrateUser({
      userId: migrationRequest.userId,
      fromBrokerId: migrationRequest.fromBrokerId,
      toBrokerId: migrationRequest.toBrokerId,
      preserveRoles: migrationRequest.preserveRoles !== false,
      preserveGroups: migrationRequest.preserveGroups !== false,
      notifyUser: migrationRequest.notifyUser !== false
    });

    LoggerService.info('User migration completed', {
      userId: migrationRequest.userId,
      fromBroker: migrationRequest.fromBrokerId,
      toBroker: migrationRequest.toBrokerId
    });

    res.json({
      success: true,
      message: 'User migrated successfully',
      migration: {
        userId: migrationRequest.userId,
        fromBroker: migrationRequest.fromBrokerId,
        toBroker: migrationRequest.toBrokerId,
        preserveRoles: migrationRequest.preserveRoles,
        preserveGroups: migrationRequest.preserveGroups,
        notifyUser: migrationRequest.notifyUser
      }
    });

  } catch (error) {
    LoggerService.error('User migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to migrate user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

/**
 * @swagger
 * /api/keycloak/validate:
 *   post:
 *     summary: Validate token
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - realmName
 *               - token
 *             properties:
 *               realmName:
 *                 type: string
 *                 description: Realm name
 *               token:
 *                 type: string
 *                 description: Token to validate
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 userInfo:
 *                   type: object
 *       401:
 *         description: Invalid token
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post('/validate', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName, token } = req.body;

    if (!realmName || !token) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: realmName, token'
      });
      return;
    }

    const userInfo = await KeycloakService.validateToken(realmName, token);

    res.json({
      success: true,
      valid: true,
      userInfo
    });

  } catch (error) {
    LoggerService.error('Token validation failed:', error);
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/keycloak/roles/{realmName}:
 *   get:
 *     summary: Get realm roles
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: realmName
 *         required: true
 *         schema:
 *           type: string
 *         description: Realm name
 *     responses:
 *       200:
 *         description: List of realm roles
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/roles/:realmName', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName } = req.params;

    if (!realmName) {
      res.status(400).json({
        success: false,
        error: 'Realm name is required'
      });
      return;
    }

    const roles = await KeycloakService.getRealmRoles(realmName);

    res.json({
      success: true,
      roles: roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        composite: role.composite,
        clientRole: role.clientRole
      }))
    });

  } catch (error) {
    LoggerService.error('Get realm roles failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get realm roles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/keycloak/users/{realmName}/{userId}/roles:
 *   post:
 *     summary: Assign roles to user
 *     tags: [Keycloak]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: realmName
 *         required: true
 *         schema:
 *           type: string
 *         description: Realm name
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roles
 *             properties:
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role names to assign
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/users/:realmName/:userId/roles', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { realmName, userId } = req.params;
    const { roles } = req.body;

    if (!roles || !Array.isArray(roles)) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid roles array'
      });
      return;
    }

    if (!realmName || !userId) {
      res.status(400).json({
        success: false,
        error: 'Realm name and User ID are required'
      });
      return;
    }

    await KeycloakService.assignRolesToUser(realmName, userId, roles);

    LoggerService.info(`Roles assigned to user ${userId} in realm ${realmName}`, {
      roles
    });

    res.json({
      success: true,
      message: 'Roles assigned successfully',
      roles
    });

  } catch (error) {
    LoggerService.error('Assign roles failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign roles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * @swagger
 * /api/keycloak/health:
 *   get:
 *     summary: Get Keycloak service health status
 *     tags: [Keycloak]
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
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = KeycloakService.isHealthy();
    const brokers = KeycloakService.getBrokerRealms();

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'keycloak',
      timestamp: new Date().toISOString(),
      details: {
        initialized: KeycloakService.isHealthy(),
        brokerRealmsCount: brokers.length,
        brokerRealms: brokers.map(broker => ({
          realm: broker.realm,
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          enabled: broker.enabled
        }))
      }
    });

  } catch (error) {
    LoggerService.error('Keycloak health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      service: 'keycloak',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
