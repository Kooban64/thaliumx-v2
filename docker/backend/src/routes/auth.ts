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

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { MFAService } from '../services/mfa';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';
import { AuthRequest, RefreshTokenRequest } from '../types';

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
  const { email, password, username, firstName, lastName } = req.body;
  
  if (!email || !password || !username || !firstName || !lastName) {
    res.status(400).json({
      success: false,
      error: 'All fields are required',
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
    const { email, password, mfaCode, rememberMe } = req.body as AuthRequest;

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
    const { refreshToken } = req.body as RefreshTokenRequest;
    
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
    const updateData = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { passwordHash, mfaSecret, mfaEnabled, ...allowedUpdates } = updateData;
    
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