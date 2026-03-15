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
    it('should return 410 for legacy registration', async () => {
      const userData = {
        email: 'integration-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Integration',
        lastName: 'Test'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('LEGACY_AUTH_DISABLED');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 410 for legacy login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginTest123!'
        })
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('LEGACY_AUTH_DISABLED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 410 for legacy refresh', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('LEGACY_AUTH_DISABLED');
    });
  });

  describe('Protected Routes', () => {
    describe('GET /api/auth/profile', () => {
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
      it('should reject update without token', async () => {
        const response = await request(app)
          .put('/api/auth/profile')
          .send({ firstName: 'Updated' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/change-password', () => {
      it('should return 410 for legacy change password', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .send({
            currentPassword: 'LoginTest123!',
            newPassword: 'NewPassword123!'
          })
          .expect(410);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('LEGACY_AUTH_DISABLED');
      });
    });
  });
});
