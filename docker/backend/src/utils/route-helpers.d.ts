/**
 * Route Helper Utilities
 *
 * Safe parameter extraction and type guards for Express routes
 */
import { Request } from 'express';
/**
 * Safely extract a required string parameter from request
 * Throws error if parameter is missing or undefined
 */
export declare function getRequiredParam(req: Request, paramName: string): string;
/**
 * Safely extract an optional string parameter from request
 */
export declare function getOptionalParam(req: Request, paramName: string): string | undefined;
/**
 * Safely extract user ID from authenticated request
 */
export declare function getUserId(req: Request): string;
/**
 * Safely extract tenant ID from request
 */
export declare function getTenantId(req: Request): string;
/**
 * Safely extract optional tenant ID from request
 */
export declare function getOptionalTenantId(req: Request): string | undefined;
/**
 * Type guard to ensure all code paths return a value
 * Use this wrapper for async route handlers
 */
export declare function asyncHandler(handler: (req: Request, res: any, next: any) => Promise<any>): (req: Request, res: any, next: any) => Promise<void>;
//# sourceMappingURL=route-helpers.d.ts.map