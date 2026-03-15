/**
 * Tenant Management Routes
 * 
 * Express router for tenant (broker) management endpoints.
 * Provides comprehensive CRUD operations for platform administrators.
 * 
 * Endpoints:
 * - GET / - List all tenants (platform_admin only)
 * - GET /:id - Get tenant by ID (platform_admin only)
 * - POST / - Create new tenant (platform_admin only)
 * - PUT /:id - Update tenant (platform_admin only)
 * - DELETE /:id - Delete tenant (platform_admin only)
 * - GET /:id/stats - Get tenant statistics (platform_admin only)
 * - POST /:id/activate - Activate tenant (platform_admin only)
 * - POST /:id/deactivate - Deactivate tenant (platform_admin only)
 * - GET /brokers - List all broker tenants (platform_admin only)
 * - GET /platform - Get platform tenant (platform_admin only)
 * 
 * Security:
 * - All routes require authentication
 * - All routes require platform_admin or super_admin role
 * - Input validation via middleware
 * 
 * Operations:
 * - Tenant CRUD operations
 * - Tenant configuration management
 * - Tenant status management
 * - Tenant statistics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';
import { v4 as uuidv4 } from 'uuid';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

// Tenant management routes - platform admin only
router.use(requireRole(['platform_admin', 'super_admin']));

/**
 * GET /
 * List all tenants with optional filtering
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      tenantType,  // 'regular' | 'broker' | 'platform'
      isActive,    // true | false
      limit = 50,  
      offset = 0 
    } = req.query;

    const TenantModel: any = DatabaseService.getModel('Tenant');
    
    const where: any = {};
    if (tenantType) {
      where.tenantType = tenantType;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { count, rows } = await TenantModel.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
      order: [['createdAt', 'DESC']]
    });

    res.json({ 
      success: true, 
      data: rows.map((r: any) => r.toJSON()),
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) { 
    LoggerService.error('Failed to list tenants', error);
    next(error); 
  }
});

/**
 * GET /brokers
 * List all broker tenants
 */
router.get('/brokers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive, limit = 50, offset = 0 } = req.query;

    const TenantModel: any = DatabaseService.getModel('Tenant');
    
    const where: any = { tenantType: 'broker' };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { count, rows } = await TenantModel.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
      order: [['createdAt', 'DESC']]
    });

    res.json({ 
      success: true, 
      data: rows.map((r: any) => r.toJSON()),
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) { 
    LoggerService.error('Failed to list brokers', error);
    next(error); 
  }
});

/**
 * GET /platform
 * Get the platform tenant
 */
router.get('/platform', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    
    const platformTenant = await TenantModel.findOne({
      where: { tenantType: 'platform' }
    });

    if (!platformTenant) {
      throw createError('Platform tenant not found', 404, 'PLATFORM_NOT_FOUND');
    }

    res.json({ success: true, data: platformTenant.toJSON() });
  } catch (error) { 
    LoggerService.error('Failed to get platform tenant', error);
    next(error); 
  }
});

/**
 * GET /:id
 * Get tenant by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    
    res.json({ success: true, data: row.toJSON() });
  } catch (error) { next(error); }
});

/**
 * GET /:id/stats
 * Get tenant statistics
 */
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id;
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const UserModel: any = DatabaseService.getModel('User');
    
    const tenant = await TenantModel.findByPk(tenantId);
    if (!tenant) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    // Get user count for this tenant
    const userCount = await UserModel.count({ where: { tenantId } });

    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUserCount = await UserModel.count({
      where: {
        tenantId,
        lastLoginAt: { $gte: thirtyDaysAgo }
      }
    });

    res.json({ 
      success: true, 
      data: {
        tenantId,
        tenantType: tenant.tenantType,
        isActive: tenant.isActive,
        userCount,
        activeUserCount,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      }
    });
  } catch (error) { 
    LoggerService.error('Failed to get tenant stats', error);
    next(error); 
  }
});

/**
 * POST /
 * Create new tenant
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      name,
      slug,
      domain,
      tenantType = 'regular', // 'regular' | 'broker' | 'platform'
      settings = {},
      logo,
      primaryColor,
      secondaryColor
    } = req.body;

    // Validate required fields
    if (!name || !slug) {
      throw createError('Name and slug are required', 400, 'VALIDATION_ERROR');
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw createError('Slug must contain only lowercase letters, numbers, and hyphens', 400, 'INVALID_SLUG');
    }

    const TenantModel: any = DatabaseService.getModel('Tenant');

    // Check for existing slug
    const existing = await TenantModel.findOne({ where: { slug } });
    if (existing) {
      throw createError('Tenant with this slug already exists', 409, 'TENANT_EXISTS');
    }

    const created = await TenantModel.create({
      id: uuidv4(),
      name,
      slug,
      domain,
      tenantType,
      isActive: true,
      settings,
      logo,
      primaryColor,
      secondaryColor
    });

    LoggerService.info('Tenant created', { 
      tenantId: created.id, 
      tenantType, 
      slug 
    });

    res.status(201).json({ success: true, data: created.toJSON() });
  } catch (error) { 
    LoggerService.error('Failed to create tenant', error);
    next(error); 
  }
});

/**
 * PUT /:id
 * Update tenant
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name,
      domain,
      settings,
      logo,
      primaryColor,
      secondaryColor
    } = req.body;

    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    // Prevent changing tenantType through API (requires migration)
    const { tenantType, ...updateData } = req.body;

    await row.update(updateData);

    LoggerService.info('Tenant updated', { tenantId: row.id });

    res.json({ success: true, data: row.toJSON() });
    return;
  } catch (error) { 
    LoggerService.error('Failed to update tenant', error);
    next(error);
    return;
  }
});

/**
 * POST /:id/activate
 * Activate tenant
 */
router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    await row.update({ isActive: true });

    LoggerService.info('Tenant activated', { tenantId: row.id });

    res.json({ success: true, data: row.toJSON() });
  } catch (error) { 
    LoggerService.error('Failed to activate tenant', error);
    next(error); 
  }
});

/**
 * POST /:id/deactivate
 * Deactivate tenant
 */
router.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    await row.update({ isActive: false });

    LoggerService.info('Tenant deactivated', { tenantId: row.id });

    res.json({ success: true, data: row.toJSON() });
  } catch (error) { 
    LoggerService.error('Failed to deactivate tenant', error);
    next(error); 
  }
});

/**
 * DELETE /:id
 * Delete tenant (soft delete via isActive=false, or hard delete)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hardDelete } = req.query;
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    if (hardDelete === 'true') {
      await row.destroy();
      LoggerService.info('Tenant hard deleted', { tenantId: req.params.id });
    } else {
      await row.update({ isActive: false });
      LoggerService.info('Tenant deactivated (soft delete)', { tenantId: req.params.id });
    }

    res.json({ success: true, message: 'Tenant deleted' });
    return;
  } catch (error) { 
    LoggerService.error('Failed to delete tenant', error);
    next(error);
    return;
  }
});

// Tenant branding routes
router.get('/:id/branding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    const branding = row ? { 
      logo: row.logo, 
      primaryColor: row.primaryColor, 
      secondaryColor: row.secondaryColor 
    } : null;
    res.json({ success: true, data: branding });
  } catch (error) { next(error); }
});

router.put('/:id/branding', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    await row.update({ 
      logo: req.body.logo, 
      primaryColor: req.body.primaryColor, 
      secondaryColor: req.body.secondaryColor 
    });
    res.json({ success: true, data: row.toJSON() });
    return;
  } catch (error) { 
    LoggerService.error('Failed to update tenant branding', error);
    next(error);
    return;
  }
});

// Tenant settings routes
router.get('/:id/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    res.json({ success: true, data: row ? row.settings : null });
  } catch (error) { next(error); }
});

router.put('/:id/settings', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const TenantModel: any = DatabaseService.getModel('Tenant');
    const row = await TenantModel.findByPk(req.params.id);
    if (!row) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    await row.update({ settings: req.body });
    res.json({ success: true, data: row.toJSON() });
    return;
  } catch (error) { 
    LoggerService.error('Failed to update tenant settings', error);
    next(error);
    return;
  }
});

export default router;
