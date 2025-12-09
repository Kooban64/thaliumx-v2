"use strict";
/**
 * Tenant Management Routes
 *
 * Express router for tenant (broker) management endpoints.
 *
 * Endpoints:
 * - GET / - List all tenants (admin/super_admin only)
 * - GET /:id - Get tenant by ID (admin/super_admin only)
 * - POST / - Create new tenant (admin/super_admin only)
 * - PUT /:id - Update tenant (admin/super_admin only)
 * - DELETE /:id - Delete tenant (admin/super_admin only)
 *
 * Security:
 * - All routes require authentication
 * - All routes require admin or super_admin role
 * - Input validation via middleware
 *
 * Operations:
 * - Tenant CRUD operations
 * - Tenant configuration management
 * - Tenant status management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const database_1 = require("../services/database");
// removed duplicate import
const router = (0, express_1.Router)();
// All routes require authentication
router.use(error_handler_1.authenticateToken);
// Tenant management routes
router.use(error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'super_admin']));
router.get('/', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const rows = await TenantModel.findAll({ order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: rows.map((r) => r.toJSON()) });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        res.json({ success: true, data: row ? row.toJSON() : null });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const created = await TenantModel.create(req.body);
        res.status(201).json({ success: true, data: created.toJSON() });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        if (!row) {
            res.status(404).json({ success: false, message: 'Tenant not found' });
            return;
        }
        await row.update(req.body);
        res.json({ success: true, data: row.toJSON() });
        return;
    }
    catch (error) {
        next(error);
        return;
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        if (!row) {
            res.status(404).json({ success: false, message: 'Tenant not found' });
            return;
        }
        await row.destroy();
        res.json({ success: true, message: 'Tenant deleted' });
        return;
    }
    catch (error) {
        next(error);
        return;
    }
});
// Tenant branding routes
router.get('/:id/branding', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        const branding = row ? { logo: row.logo, primaryColor: row.primaryColor, secondaryColor: row.secondaryColor } : null;
        res.json({ success: true, data: branding });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id/branding', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        if (!row) {
            res.status(404).json({ success: false, message: 'Tenant not found' });
            return;
        }
        await row.update({ logo: req.body.logo, primaryColor: req.body.primaryColor, secondaryColor: req.body.secondaryColor });
        res.json({ success: true, data: row.toJSON() });
        return;
    }
    catch (error) {
        next(error);
        return;
    }
});
// Tenant settings routes
router.get('/:id/settings', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        res.json({ success: true, data: row ? row.settings : null });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id/settings', async (req, res, next) => {
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const row = await TenantModel.findByPk(req.params.id);
        if (!row) {
            res.status(404).json({ success: false, message: 'Tenant not found' });
            return;
        }
        await row.update({ settings: req.body });
        res.json({ success: true, data: row.toJSON() });
        return;
    }
    catch (error) {
        next(error);
        return;
    }
});
exports.default = router;
//# sourceMappingURL=tenants.js.map