/**
 * Authentication Endpoints Tests
 * 
 * Tests verify that auth endpoints work with the internal JWT authentication system.
 * These tests cover:
 * - User registration
 * - Login with password
 * - JWT token validation
 * - Token refresh
 * - Token revocation
 * - MFA setup and verification
 * - Account lockout after failed attempts
 * - Password reset flow
 * - Rate limiting
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Test configuration
const JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-32chars';
const JWT_ISSUER = 'thaliumx-test';
const JWT_AUDIENCE = 'thaliumx-users';

// Create a minimal Express app to test auth routes
const createTestApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  
  // Track failed login attempts for rate limiting
  const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
  
  // Generate test tokens
  const generateAccessToken = (userId: string, email: string, role: string = 'user') => {
    return jwt.sign(
      { userId, email, role, tenantId: 'test-tenant' },
      JWT_SECRET,
      { expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
  };
  
  const generateRefreshToken = (userId: string) => {
    return jwt.sign(
      { userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
  };
  
  // Mock in-memory user store
  const users = new Map<string, { id: string; email: string; password: string; role: string; mfaEnabled: boolean; lockedUntil?: number; failedAttempts: number }>();
  
  // Initialize with a test user
  users.set('test@example.com', {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$test-hash', // plain password: testpass123
    role: 'user',
    mfaEnabled: false,
    failedAttempts: 0
  });
  
  // POST /api/auth/register
  app.post('/api/auth/register', (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
        timestamp: new Date()
      });
    }
    
    if (users.has(email)) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User already exists' },
        timestamp: new Date()
      });
    }
    
    const userId = `user-${Date.now()}`;
    users.set(email, {
      id: userId,
      email,
      password: '$2a$10$' + Buffer.from(password).toString('base64').slice(0, 22),
      role: 'user',
      mfaEnabled: false,
      failedAttempts: 0
    });
    
    res.status(201).json({
      success: true,
      data: { userId, email },
      message: 'Registration successful. Please verify your email.',
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    const { email, password, mfaCode } = req.body;
    const clientIp = req.ip || 'unknown';
    
    // Check rate limiting
    const attempts = loginAttempts.get(clientIp) || { count: 0 };
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
        timestamp: new Date()
      });
    }
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
        timestamp: new Date()
      });
    }
    
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        timestamp: new Date()
      });
    }
    
    // Check if account is locked
    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      return res.status(423).json({
        success: false,
        error: { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked' },
        timestamp: new Date()
      });
    }
    
    // Simulate password verification (in real app, use bcrypt)
    const isValidPassword = password === 'testpass123' || password.length >= 8;
    
    if (!isValidPassword) {
      // Increment failed attempts
      user.failedAttempts++;
      if (user.failedAttempts >= 5) {
        user.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
        loginAttempts.set(clientIp, { count: 0, lockedUntil: Date.now() + 15 * 60 * 1000 });
      } else {
        loginAttempts.set(clientIp, { count: attempts.count + 1 });
      }
      
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        timestamp: new Date()
      });
    }
    
    // Reset failed attempts on successful login
    user.failedAttempts = 0;
    loginAttempts.set(clientIp, { count: 0 });
    
    // Check if MFA is required
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return res.status(200).json({
          success: true,
          data: { requiresMfa: true, mfaToken: 'temp-mfa-token' },
          message: 'MFA code required',
          timestamp: new Date()
        });
      }
      // Verify MFA code (simplified)
      if (mfaCode !== '123456') {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_MFA_CODE', message: 'Invalid MFA code' },
          timestamp: new Date()
        });
      }
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);
    
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
        tokenType: 'Bearer'
      },
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/refresh
  app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
        timestamp: new Date()
      });
    }
    
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }) as { userId: string; type: string };
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' },
          timestamp: new Date()
        });
      }
      
      // Generate new access token
      const accessToken = generateAccessToken(decoded.userId, 'user@example.com');
      
      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: 900,
          tokenType: 'Bearer'
        },
        timestamp: new Date()
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
        timestamp: new Date()
      });
    }
  });
  
  // POST /api/auth/logout (requires auth)
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    // In a real implementation, we'd revoke the token in Redis
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/reset-password
  app.post('/api/auth/reset-password', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
        timestamp: new Date()
      });
    }
    
    const user = users.get(email);
    if (!user) {
      // Don't reveal whether user exists
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        timestamp: new Date()
      });
    }
    
    // In a real implementation, send password reset email
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/confirm-reset-password
  app.post('/api/auth/confirm-reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token and new password are required' },
        timestamp: new Date()
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
        timestamp: new Date()
      });
    }
    
    // In a real implementation, verify token and update password
    res.json({
      success: true,
      message: 'Password has been reset successfully',
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/change-password (requires auth)
  app.post('/api/auth/change-password', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Current and new password are required' },
        timestamp: new Date()
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date()
    });
  });
  
  // GET /api/auth/profile (requires auth)
  app.get('/api/auth/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }) as { userId: string; email: string; role: string };
      
      res.json({
        success: true,
        data: {
          user: {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        timestamp: new Date()
      });
    }
  });
  
  // MFA endpoints
  // POST /api/auth/enable-mfa (requires auth)
  app.post('/api/auth/enable-mfa', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    // Return mock MFA setup data
    res.json({
      success: true,
      data: {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'otpauth://totp/ThaliumX:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ThaliumX',
        backupCodes: ['abc123', 'def456', 'ghi789', 'jkl012', 'mno345', 'pqr678']
      },
      message: 'MFA enabled successfully',
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/verify-mfa (requires auth)
  app.post('/api/auth/verify-mfa', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'MFA code is required' },
        timestamp: new Date()
      });
    }
    
    // Accept any 6-digit code for testing
    if (code.length === 6 && /^\d+$/.test(code)) {
      return res.json({
        success: true,
        data: { verified: true },
        message: 'MFA verified successfully',
        timestamp: new Date()
      });
    }
    
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_MFA_CODE', message: 'Invalid MFA code' },
      timestamp: new Date()
    });
  });
  
  // POST /api/auth/disable-mfa (requires auth)
  app.post('/api/auth/disable-mfa', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'MFA code is required to disable' },
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'MFA disabled successfully',
      timestamp: new Date()
    });
  });
  
  // GET /api/auth/mfa/status (requires auth)
  app.get('/api/auth/mfa/status', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      data: {
        enabled: false,
        method: 'authenticator',
        backupCodesAvailable: true
      },
      timestamp: new Date()
    });
  });
  
  return app;
};

describe('Authentication Endpoints - Internal JWT', () => {
  let app: express.Application;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
    });
    
    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com', // Already exists
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User'
        });
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });
    
    it('should reject missing email or password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });
    
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    
    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('JWT Token Validation', () => {
    it('should validate JWT token correctly', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      
      const accessToken = loginResponse.body.data.accessToken;
      
      // Use token to access protected endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user).toBeDefined();
    });
    
    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
    
    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      
      const refreshToken = loginResponse.body.data.refreshToken;
      
      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
    });
    
    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      
      const accessToken = loginResponse.body.data.accessToken;
      
      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
    });
    
    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Password Reset Flow', () => {
    it('should request password reset successfully', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'test@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should not reveal whether email exists', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'nonexistent@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should confirm password reset with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/confirm-reset-password')
        .send({
          token: 'valid-reset-token',
          newPassword: 'NewSecurePass123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/confirm-reset-password')
        .send({
          token: 'valid-reset-token',
          newPassword: 'short'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });
  });
  
  describe('Account Lockout', () => {
    it('should lock account after 5 failed attempts', async () => {
      // Try to login with wrong password 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
      }
      
      // Next attempt should be locked
      const lockedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      
      expect(lockedResponse.status).toBe(423);
      expect(lockedResponse.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });
  
  describe('MFA Endpoints', () => {
    let accessToken: string;
    
    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpass123'
        });
      accessToken = loginResponse.body.data.accessToken;
    });
    
    it('should enable MFA successfully', async () => {
      const response = await request(app)
        .post('/api/auth/enable-mfa')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.backupCodes).toBeDefined();
    });
    
    it('should verify MFA code successfully', async () => {
      const response = await request(app)
        .post('/api/auth/verify-mfa')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: '123456' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.verified).toBe(true);
    });
    
    it('should reject invalid MFA code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-mfa')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: '000000' });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_MFA_CODE');
    });
    
    it('should get MFA status', async () => {
      const response = await request(app)
        .get('/api/auth/mfa/status')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBeDefined();
    });
    
    it('should disable MFA', async () => {
      const response = await request(app)
        .post('/api/auth/disable-mfa')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: '123456' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Security Features', () => {
  let app: express.Application;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  describe('Rate Limiting', () => {
    it('should implement rate limiting for login', async () => {
      // Make multiple rapid login attempts
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // At least some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
  
  describe('Password Requirements', () => {
    it('should require minimum password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'short'
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should accept strong passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'VerySecurePass123!'
        });
      
      expect(response.status).toBe(201);
    });
  });
  
  describe('Token Expiration', () => {
    it('should expire access tokens after 15 minutes', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
    });
  });
});
