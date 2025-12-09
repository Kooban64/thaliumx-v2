import request from 'supertest';
import express from 'express';
import { ThaliumXBackend } from '../../index';
import { TestDatabaseHelper } from '../../../tests/integration-setup';

describe('Authentication API Integration Tests', () => {
  let app: express.Application;
  let backend: ThaliumXBackend;

  beforeAll(async () => {
    await TestDatabaseHelper.cleanDatabase();
    await TestDatabaseHelper.seedTestData();
    
    // Create backend instance for testing
    backend = new ThaliumXBackend();
    app = backend.getApp();
  });

  afterAll(async () => {
    await TestDatabaseHelper.cleanDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'integration-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Integration',
        lastName: 'Test',
        tenantId: 'test-tenant'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'TestPassword123!',
        firstName: 'Duplicate',
        lastName: 'Test'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/already exists/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!',
          firstName: 'Login',
          lastName: 'Test'
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('login-test@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('should handle MFA when enabled', async () => {
      // First enable MFA for the user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        });

      const token = loginResponse.body.data.accessToken;

      // Enable MFA
      await request(app)
        .post('/api/auth/enable-mfa')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try login again - should require MFA
      const mfaResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        })
        .expect(400);

      expect(mfaResponse.body.error).toMatch(/MFA code required/i);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Get refresh token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        });

      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid refresh token/i);
    });
  });

  describe('Protected Routes', () => {
    let token: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        });

      token = response.body.data.accessToken;
    });

    describe('GET /api/auth/profile', () => {
      it('should return user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe('login-test@example.com');
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/auth/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name'
        };

        const response = await request(app)
          .put('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.firstName).toBe('Updated');
        expect(response.body.data.user.lastName).toBe('Name');
      });

      it('should prevent updating sensitive fields', async () => {
        const updateData = {
          passwordHash: 'hacked',
          mfaSecret: 'hacked'
        };

        const response = await request(app)
          .put('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .send(updateData)
          .expect(200);

        // Sensitive fields should not be updated
        expect(response.body.data.user.passwordHash).toBeUndefined();
        expect(response.body.data.user.mfaSecret).toBeUndefined();
      });
    });

    describe('POST /api/auth/change-password', () => {
      it('should change password successfully', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'LoginTest123!',
            newPassword: 'NewPassword123!'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/password changed/i);
      });

      it('should reject incorrect current password', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'WrongPassword!',
            newPassword: 'NewPassword123!'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/incorrect/i);
      });
    });
  });
});