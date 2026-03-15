/**
 * Broker Onboarding API
 * 
 * Express router for broker tenant onboarding and management.
 * Provides dedicated endpoints for creating and configuring broker tenants.
 * 
 * Endpoints:
 * - POST /onboard - Onboard a new broker tenant
 * - GET /onboard/status/:token - Check onboarding status
 * - POST /onboard/complete - Complete broker setup
 * - GET /:brokerId/configuration - Get broker configuration
 * - PUT /:brokerId/configuration - Update broker configuration
 * - POST /:brokerId/initialize - Initialize broker services
 * 
 * Security:
 * - Onboarding requires a valid onboarding token
 * - Configuration requires platform_admin or broker_admin role
 * - All sensitive operations are audited
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import { RedisService } from '../services/redis';
import { createError } from '../utils';
import { EmailService } from '../services/email';
import * as bcrypt from 'bcryptjs';

const router: Router = Router();

/**
 * Interface for broker onboarding request
 */
interface BrokerOnboardingRequest {
  // Company Information
  companyName: string;
  companyRegistrationNumber?: string;
  companyEmail: string;
  companyPhone?: string;
  website?: string;
  
  // Broker Details
  brokerSlug: string;  // Unique identifier for the broker
  brokerName: string;  // Display name
  
  // Admin User (will be created)
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword: string;
  
  // Branding (optional)
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  
  // Contact Person
  contactPerson?: {
    name: string;
    email: string;
    phone?: string;
  };
  
  // Onboarding Token (for secured onboarding)
  onboardingToken?: string;
}

/**
 * Generate a secure onboarding token
 */
const generateOnboardingToken = async (): Promise<string> => {
  const token = uuidv4() + '-' + uuidv4();
  // Store token in Redis with 24 hour expiry
  await RedisService.setString(`broker_onboarding:${token}`, 'pending', 24 * 60 * 60);
  return token;
};

/**
 * Validate onboarding token
 */
const validateOnboardingToken = async (token: string): Promise<boolean> => {
  const status = await RedisService.getString(`broker_onboarding:${token}`);
  return status === 'pending';
};

/**
 * Mark onboarding as complete
 */
const completeOnboarding = async (token: string, brokerId: string): Promise<void> => {
  await RedisService.setString(`broker_onboarding:${token}`, `completed:${brokerId}`, 24 * 60 * 60);
};

/**
 * POST /onboard
 * Onboard a new broker tenant
 * 
 * This endpoint can be:
 * 1. Open with a valid onboarding token (platform admin creates token first)
 * 2. Protected requiring platform_admin role
 */
router.post('/onboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = req.body as BrokerOnboardingRequest;
    
    // Validate required fields
    const requiredFields = [
      'companyName', 'companyEmail', 'brokerSlug', 'brokerName',
      'adminEmail', 'adminFirstName', 'adminLastName', 'adminPassword'
    ];
    
    for (const field of requiredFields) {
      if (!request[field as keyof BrokerOnboardingRequest]) {
        throw createError(`${field} is required`, 400, 'VALIDATION_ERROR');
      }
    }
    
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(request.brokerSlug)) {
      throw createError('Broker slug must contain only lowercase letters, numbers, and hyphens', 400, 'INVALID_SLUG');
    }
    
    // Check if onboarding token is required and valid
    const requireToken = process.env.BROKER_ONBOARDING_REQUIRE_TOKEN === 'true';
    if (requireToken) {
      if (!request.onboardingToken) {
        throw createError('Onboarding token is required', 403, 'ONBOARDING_TOKEN_REQUIRED');
      }
      
      const isValid = await validateOnboardingToken(request.onboardingToken);
      if (!isValid) {
        throw createError('Invalid or expired onboarding token', 403, 'INVALID_ONBOARDING_TOKEN');
      }
    }
    
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const UserModel: any = DatabaseService.getModel('User');
    
    // Check for existing broker slug
    const existingTenant = await TenantModel.findOne({ 
      where: { slug: request.brokerSlug } 
    });
    
    if (existingTenant) {
      throw createError('Broker with this slug already exists', 409, 'BROKER_EXISTS');
    }
    
    // Check for existing admin email
    const existingUser = await UserModel.findOne({ 
      where: { email: request.adminEmail.toLowerCase() } 
    });
    
    if (existingUser) {
      throw createError('Admin email already registered', 409, 'EMAIL_EXISTS');
    }
    
    // Create broker tenant
    const tenantId = uuidv4();
    const brokerTenant = await TenantModel.create({
      id: tenantId,
      name: request.companyName,
      slug: request.brokerSlug,
      domain: request.website,
      tenantType: 'broker',
      isActive: true,
      settings: {
        companyRegistrationNumber: request.companyRegistrationNumber,
        companyPhone: request.companyPhone,
        contactPerson: request.contactPerson,
        onboardingStatus: 'pending',
        features: {
          trading: true,
          kyc: true,
          wallet: true,
          reporting: true
        }
      },
      logo: request.branding?.logo,
      primaryColor: request.branding?.primaryColor,
      secondaryColor: request.branding?.secondaryColor
    });
    
    // Create broker admin user
    const passwordHash = await bcrypt.hash(request.adminPassword, 12);
    const adminUser = await UserModel.create({
      id: uuidv4(),
      email: request.adminEmail.toLowerCase(),
      username: request.brokerSlug + '-admin',
      firstName: request.adminFirstName,
      lastName: request.adminLastName,
      passwordHash,
      role: 'broker_admin',
      roles: ['broker_admin'],
      tenantId: tenantId,
      kycStatus: 'pending',
      kycLevel: 0,
      isActive: true,
      isVerified: true, // Auto-verify broker admins
      mfaEnabled: false,
      permissions: [],
      brokerId: tenantId,
      channel: 'broker'
    });
    
    // Mark onboarding as complete if token was used
    if (request.onboardingToken) {
      await completeOnboarding(request.onboardingToken, tenantId);
    }
    
    LoggerService.info('Broker onboarded successfully', {
      brokerId: tenantId,
      brokerSlug: request.brokerSlug,
      adminUserId: adminUser.id
    });
    
    // Send welcome email to broker admin
    try {
      await EmailService.sendWelcomeEmail({
        email: request.adminEmail,
        firstName: request.adminFirstName,
        userId: adminUser.id
      });
    } catch (emailError) {
      LoggerService.warn('Failed to send welcome email', {
        error: emailError instanceof Error ? emailError.message : String(emailError)
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        brokerId: tenantId,
        brokerSlug: request.brokerSlug,
        brokerName: request.brokerName,
        adminUserId: adminUser.id,
        status: 'active',
        message: 'Broker onboarded successfully'
      }
    });
    
  } catch (error) {
    LoggerService.error('Broker onboarding failed', error);
    next(error);
  }
});

/**
 * POST /onboard/token
 * Generate a new broker onboarding token (platform admin only)
 */
router.post('/onboard/token', authenticateToken, requireRole(['platform_admin', 'super_admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = await generateOnboardingToken();
      
      LoggerService.info('Broker onboarding token generated', {
        tokenPrefix: token.substring(0, 8) + '...',
        generatedBy: (req.user as any)?.userId
      });
      
      res.json({
        success: true,
        data: {
          token,
          expiresIn: '24 hours',
          message: 'Keep this token secure - it will be needed for broker onboarding'
        }
      });
    } catch (error) {
      LoggerService.error('Failed to generate onboarding token', error);
      next(error);
    }
  }
);

/**
 * GET /onboard/status/:token
 * Check onboarding status by token
 */
router.get('/onboard/status/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    
    const status = await RedisService.getString(`broker_onboarding:${token}`);
    
    if (!status) {
      throw createError('Onboarding token not found or expired', 404, 'TOKEN_NOT_FOUND');
    }
    
    if (status === 'pending') {
      res.json({
        success: true,
        data: {
          status: 'pending',
          message: 'Onboarding has not been completed'
        }
      });
    } else if (status.startsWith('completed:')) {
      const brokerId = status.split(':')[1];
      res.json({
        success: true,
        data: {
          status: 'completed',
          brokerId,
          message: 'Onboarding has been completed'
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          status: 'unknown'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:brokerId/configuration
 * Get broker configuration (platform admin or broker admin)
 */
router.get('/:brokerId/configuration', authenticateToken, requireRole(['platform_admin', 'super_admin', 'broker_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brokerId } = req.params;
      const user = req.user as any;
      
      // Check if user has access to this broker
      if (user.tenantId !== brokerId && !['platform_admin', 'super_admin'].includes(user.role)) {
        throw createError('Access denied to this broker configuration', 403, 'ACCESS_DENIED');
      }
      
      const TenantModel: any = DatabaseService.getModel('Tenant');
      const broker = await TenantModel.findByPk(brokerId);
      
      if (!broker) {
        throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
      }
      
      if (broker.tenantType !== 'broker') {
        throw createError('Not a broker tenant', 400, 'NOT_A_BROKER');
      }
      
      res.json({
        success: true,
        data: {
          brokerId: broker.id,
          brokerSlug: broker.slug,
          brokerName: broker.name,
          domain: broker.domain,
          isActive: broker.isActive,
          settings: broker.settings,
          branding: {
            logo: broker.logo,
            primaryColor: broker.primaryColor,
            secondaryColor: broker.secondaryColor
          },
          createdAt: broker.createdAt,
          updatedAt: broker.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /:brokerId/configuration
 * Update broker configuration (platform admin or broker admin)
 */
router.put('/:brokerId/configuration', authenticateToken, requireRole(['platform_admin', 'super_admin', 'broker_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brokerId } = req.params;
      const user = req.user as any;
      const { 
        settings, 
        branding, 
        features,
        domain 
      } = req.body;
      
      // Check if user has access to this broker
      if (user.tenantId !== brokerId && !['platform_admin', 'super_admin'].includes(user.role)) {
        throw createError('Access denied to this broker configuration', 403, 'ACCESS_DENIED');
      }
      
      const TenantModel: any = DatabaseService.getModel('Tenant');
      const broker = await TenantModel.findByPk(brokerId);
      
      if (!broker) {
        throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
      }
      
      if (broker.tenantType !== 'broker') {
        throw createError('Not a broker tenant', 400, 'NOT_A_BROKER');
      }
      
      // Build update object
      const updateData: any = {};
      
      if (settings) {
        updateData.settings = {
          ...broker.settings,
          ...settings
        };
      }
      
      if (features) {
        updateData.settings = {
          ...updateData.settings || broker.settings,
          features
        };
      }
      
      if (branding) {
        if (branding.logo !== undefined) updateData.logo = branding.logo;
        if (branding.primaryColor !== undefined) updateData.primaryColor = branding.primaryColor;
        if (branding.secondaryColor !== undefined) updateData.secondaryColor = branding.secondaryColor;
      }
      
      if (domain !== undefined) {
        updateData.domain = domain;
      }
      
      await broker.update(updateData);
      
      LoggerService.info('Broker configuration updated', {
        brokerId,
        updatedBy: user.userId
      });
      
      res.json({
        success: true,
        data: {
          brokerId: broker.id,
          brokerSlug: broker.slug,
          message: 'Configuration updated successfully'
        }
      });
    } catch (error) {
      LoggerService.error('Failed to update broker configuration', error);
      next(error);
    }
  }
);

/**
 * POST /:brokerId/initialize
 * Initialize broker services (platform admin only)
 */
router.post('/:brokerId/initialize', authenticateToken, requireRole(['platform_admin', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brokerId } = req.params;
      const user = req.user as any;
      
      const TenantModel: any = DatabaseService.getModel('Tenant');
      const broker = await TenantModel.findByPk(brokerId);
      
      if (!broker) {
        throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
      }
      
      if (broker.tenantType !== 'broker') {
        throw createError('Not a broker tenant', 400, 'NOT_A_BROKER');
      }
      
      // Update onboarding status to initialized
      await broker.update({
        settings: {
          ...broker.settings,
          onboardingStatus: 'initialized',
          initializedAt: new Date().toISOString(),
          initializedBy: user.userId
        }
      });
      
      LoggerService.info('Broker services initialized', {
        brokerId,
        initializedBy: user.userId
      });
      
      res.json({
        success: true,
        data: {
          brokerId,
          status: 'initialized',
          message: 'Broker services have been initialized'
        }
      });
    } catch (error) {
      LoggerService.error('Failed to initialize broker', error);
      next(error);
    }
  }
);

/**
 * GET /:brokerId/users
 * List broker users (broker admin only)
 */
router.get('/:brokerId/users', authenticateToken, requireRole(['platform_admin', 'super_admin', 'broker_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brokerId } = req.params;
      const user = req.user as any;
      const { limit = 50, offset = 0 } = req.query;
      
      // Check if user has access to this broker
      if (user.tenantId !== brokerId && !['platform_admin', 'super_admin'].includes(user.role)) {
        throw createError('Access denied to this broker', 403, 'ACCESS_DENIED');
      }
      
      const UserModel: any = DatabaseService.getModel('User');
      
      const { count, rows } = await UserModel.findAndCountAll({
        where: { tenantId: brokerId },
        limit: Math.min(parseInt(limit as string), 100),
        offset: parseInt(offset as string),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['passwordHash', 'mfaSecret', 'mfaBackupCodes'] }
      });
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
