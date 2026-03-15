/**
 * Authentication Validation Middleware
 * 
 * Express validation middleware for authentication endpoints.
 * 
 * Validators:
 * - validateLogin - Validates email and password
 * - validateRegister - Validates registration data
 * - validateRefreshToken - Validates refresh token
 * - validateChangePassword - Validates password change request
 * - validateResetPassword - Validates password reset request
 * - validateConfirmResetPassword - Validates password reset confirmation
 * 
 * Validation Rules:
 * - Email format validation
 * - Password strength requirements
 * - Required field checks
 * - Token format validation
 * 
 * Error Handling:
 * - Returns 400 with detailed error messages
 * - Includes request ID for tracing
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { createError } from '../utils';
import { LoggerService } from '../services/logger';

// Validation middleware
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({
      success: false,
      error: 'Email and password are required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

export const validateRegister = (req: Request, res: Response, next: NextFunction): void => {
  // Username is optional: backend will derive it from email if not provided.
  // Frontend registration form does not ask for a username.
  const { email, password, firstName, lastName } = req.body;
  
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({
      success: false,
      error: 'Email, password, first name, and last name are required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters long',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

export const validateRefreshToken = (req: Request, res: Response, next: NextFunction): void => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    res.status(400).json({
      success: false,
      error: 'Refresh token is required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

export const validateChangePassword = (req: Request, res: Response, next: NextFunction): void => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Current password and new password are required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters long',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

export const validateResetPassword = (req: Request, res: Response, next: NextFunction): void => {
  const { email } = req.body;
  
  if (!email) {
    res.status(400).json({
      success: false,
      error: 'Email is required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

export const validateConfirmResetPassword = (req: Request, res: Response, next: NextFunction): void => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Token and new password are required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters long',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

// Route handlers
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, mfaCode, rememberMe } = req.body;

    const result = await AuthService.login(email, password, mfaCode, rememberMe, res);

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userData = req.body;
    
    const user = await AuthService.register(userData);
    
    res.status(201).json({
      success: true,
      data: { user },
      message: 'User registered successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    const result = await AuthService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (userId) {
      await AuthService.logout(userId, res);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { currentPassword, newPassword } = req.body;
    
    await AuthService.changePassword(userId, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    
    await AuthService.requestPasswordReset(email);
    
    res.json({
      success: true,
      message: 'Password reset email sent if account exists',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const confirmPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    
    await AuthService.confirmPasswordReset(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password reset successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const enableMFA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    const result = await AuthService.enableMFA(userId);
    
    res.json({
      success: true,
      data: result,
      message: 'MFA enabled successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const verifyMFA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;
    
    if (!code) {
      res.status(400).json({
        success: false,
        error: 'MFA code is required',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    return;
    }
    
    const result = await AuthService.verifyMFA(userId, code);
    
    res.json({
      success: true,
      data: result,
      message: result.success ? 'MFA verified successfully' : 'Invalid MFA code',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const disableMFA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { password } = req.body;
    
    if (!password) {
      res.status(400).json({
        success: false,
        error: 'Password is required to disable MFA',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    return;
    }
    
    await AuthService.disableMFA(userId, password);
    
    res.json({
      success: true,
      message: 'MFA disabled successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    const user = await UserService.getUserById(userId);
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    res.json({
      success: true,
      data: { user },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { passwordHash: _passwordHash, mfaSecret: _mfaSecret, mfaEnabled: _mfaEnabled, ...allowedUpdates } = req.body;
    
    const user = await UserService.updateUser(userId, allowedUpdates);
    
    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// EMAIL VERIFICATION HANDLERS
// =============================================================================

// Validation for email verification
const VERIFICATION_TOKEN_LENGTH = 32;

export const validateVerifyEmail = (req: Request, res: Response, next: NextFunction): void => {
  const { token, email } = req.body;
  
  if (!token && !email) {
    res.status(400).json({
      success: false,
      error: 'Token or email is required',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  // If token is provided, it should be a string
  if (token && typeof token !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Invalid token format',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  // If email is provided, validate format
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, email } = req.body;
    
    // Use token to verify (more secure)
    if (token) {
      // Look up user by verification token stored in Redis
      const { RedisService } = await import('../services/redis');
      const verificationKey = `email_verify:${token}`;
      const userId = await RedisService.getString(verificationKey);
      
      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired verification token'
          },
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Get user
      const user = await UserService.getUserById(userId);
      
      if (!user) {
        res.status(400).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Check if already verified
      if (user.isVerified) {
        res.json({
          success: true,
          message: 'Email already verified',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Mark as verified
      await UserService.updateUser(user.id, { isVerified: true });
      
      // Delete the verification token
      await RedisService.del(verificationKey);
      
      LoggerService.logAuth('email_verified', user.id, true);
      LoggerService.info('Email verified successfully', { email: user.email, userId: user.id });

      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // If no token, error
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Verification token is required'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};

// Resend verification email
export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email is required'
        }
      });
      return;
    }

    // Find user by email
    const user = await UserService.getUserByEmail(email);

    // Always return success to prevent email enumeration
    // If user exists and not verified, send email
    // If user doesn't exist or already verified, still return success
    if (user && !user.isVerified) {
      // Generate verification token
      const crypto = await import('crypto');
      const verificationToken = crypto.randomBytes(VERIFICATION_TOKEN_LENGTH).toString('hex');
      
      // Store token in Redis with 24 hour expiry
      const { RedisService } = await import('../services/redis');
      const verificationKey = `email_verify:${verificationToken}`;
      await RedisService.setString(verificationKey, user.id, 24 * 60 * 60); // 24 hours

      // Generate verification URL
      const baseUrl = process.env.FRONTEND_URL || 'https://thaliumx.com';
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

      // Send verification email
      try {
        const { EmailService } = await import('../services/email');
        await EmailService.sendVerificationEmail({
          email: user.email,
          firstName: user.firstName,
          userId: user.id,
          verificationUrl
        });
      } catch (emailError) {
        // Log but don't expose to user
        LoggerService.error('Failed to resend verification email', { 
          error: emailError instanceof Error ? emailError.message : String(emailError),
          userId: user.id 
        });
      }
    }

    // Return success regardless of whether email was sent
    // This prevents attackers from discovering valid email addresses
    res.json({
      success: true,
      message: 'If an account with that email exists and is not verified, a verification email has been sent.',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  } catch (error) {
    next(error);
  }
};
