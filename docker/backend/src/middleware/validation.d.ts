import { Request, Response, NextFunction } from 'express';
/**
 * Input validation and sanitization middleware
 * Based on thaliumx shared input-validator patterns
 */
export declare const validateRequest: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Create validation middleware for specific schemas
 */
export declare function createValidationMiddleware(schema: any, options?: {
    sanitize?: boolean;
}): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map