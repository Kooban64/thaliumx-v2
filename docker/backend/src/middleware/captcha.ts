/**
 * CAPTCHA Middleware
 * 
 * Optional Google reCAPTCHA v3 verification middleware for public endpoints.
 * Can be enabled/disabled via environment variable.
 * 
 * Usage:
 * - Set ENABLE_CAPTCHA=true to enable
 * - Set RECAPTCHA_SECRET_KEY to your Google reCAPTCHA secret key
 * - Frontend should include RECAPTCHA_SITE_KEY and call grecaptcha.execute()
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';

const ENABLE_CAPTCHA = process.env.ENABLE_CAPTCHA === 'true';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5; // Minimum score for reCAPTCHA v3 (0.0 to 1.0)

/**
 * Verify reCAPTCHA token
 */
async function verifyRecaptcha(token: string, ip?: string): Promise<{ success: boolean; score?: number; reason?: string }> {
  if (!ENABLE_CAPTCHA || !RECAPTCHA_SECRET_KEY) {
    // CAPTCHA disabled - allow request
    return { success: true };
  }

  if (!token) {
    return {
      success: false,
      reason: 'CAPTCHA token is required',
    };
  }

  try {
    const response = await axios.post(RECAPTCHA_VERIFY_URL, null, {
      params: {
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: ip,
      },
      timeout: 5000,
    });

    const data = response.data;

    if (!data.success) {
      LoggerService.warn('reCAPTCHA verification failed', {
        errors: data['error-codes'],
        ip,
      });
      return {
        success: false,
        reason: 'CAPTCHA verification failed',
      };
    }

    // Check score for v3
    if (data.score !== undefined) {
      if (data.score < MIN_SCORE) {
        LoggerService.warn('reCAPTCHA score too low', {
          score: data.score,
          minScore: MIN_SCORE,
          ip,
        });
        return {
          success: false,
          score: data.score,
          reason: 'CAPTCHA score too low',
        };
      }
      return {
        success: true,
        score: data.score,
      };
    }

    return { success: true };
  } catch (error: any) {
    LoggerService.error('reCAPTCHA verification error', {
      error: error.message,
      ip,
    });
    // Fail open if CAPTCHA service is unavailable
    // In production, you might want to fail closed
    return {
      success: false,
      reason: 'CAPTCHA service unavailable',
    };
  }
}

/**
 * CAPTCHA verification middleware
 * Extracts token from request body or headers
 */
export const verifyCaptcha = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip if CAPTCHA is disabled
  if (!ENABLE_CAPTCHA) {
    return next();
  }

  // Extract token from body or header
  const token = req.body?.captchaToken || req.headers['x-captcha-token'] as string;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

  const result = await verifyRecaptcha(token, ip);

  if (!result.success) {
    LoggerService.logSecurity('captcha_verification_failed', {
      ip,
      path: req.path,
      method: req.method,
      reason: result.reason,
      score: result.score,
    });

    return next(createError(
      result.reason || 'CAPTCHA verification failed',
      400,
      'CAPTCHA_VERIFICATION_FAILED'
    ));
  }

  // Add score to request for logging
  if (result.score !== undefined) {
    (req as any).captchaScore = result.score;
  }

  return next();
};

/**
 * Optional CAPTCHA middleware - only verifies if token is provided
 * Useful for endpoints where CAPTCHA is optional but recommended
 */
export const optionalCaptcha = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip if CAPTCHA is disabled
  if (!ENABLE_CAPTCHA) {
    return next();
  }

  const token = req.body?.captchaToken || req.headers['x-captcha-token'] as string;

  // If no token provided, allow request (optional)
  if (!token) {
    LoggerService.info('Optional CAPTCHA: no token provided, allowing request', {
      ip: req.ip,
      path: req.path,
    });
    return next();
  }

  // If token provided, verify it
  return verifyCaptcha(req, res, next);
};
