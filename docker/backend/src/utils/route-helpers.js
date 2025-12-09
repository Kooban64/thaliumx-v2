"use strict";
/**
 * Route Helper Utilities
 *
 * Safe parameter extraction and type guards for Express routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequiredParam = getRequiredParam;
exports.getOptionalParam = getOptionalParam;
exports.getUserId = getUserId;
exports.getTenantId = getTenantId;
exports.getOptionalTenantId = getOptionalTenantId;
exports.asyncHandler = asyncHandler;
/**
 * Safely extract a required string parameter from request
 * Throws error if parameter is missing or undefined
 */
function getRequiredParam(req, paramName) {
    const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
    if (!value || typeof value !== 'string') {
        throw new Error(`Required parameter '${paramName}' is missing or invalid`);
    }
    return value;
}
/**
 * Safely extract an optional string parameter from request
 */
function getOptionalParam(req, paramName) {
    const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
    return typeof value === 'string' ? value : undefined;
}
/**
 * Safely extract user ID from authenticated request
 */
function getUserId(req) {
    const user = req.user;
    if (!user || !user.id) {
        throw new Error('User ID not found in request');
    }
    return user.id;
}
/**
 * Safely extract tenant ID from request
 */
function getTenantId(req) {
    const user = req.user;
    const paramTenantId = req.params.tenantId;
    if (paramTenantId && typeof paramTenantId === 'string') {
        return paramTenantId;
    }
    if (user?.tenantId && typeof user.tenantId === 'string') {
        return user.tenantId;
    }
    throw new Error('Tenant ID not found in request');
}
/**
 * Safely extract optional tenant ID from request
 */
function getOptionalTenantId(req) {
    const user = req.user;
    const paramTenantId = req.params.tenantId;
    if (paramTenantId && typeof paramTenantId === 'string') {
        return paramTenantId;
    }
    return user?.tenantId && typeof user.tenantId === 'string' ? user.tenantId : undefined;
}
/**
 * Type guard to ensure all code paths return a value
 * Use this wrapper for async route handlers
 */
function asyncHandler(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=route-helpers.js.map