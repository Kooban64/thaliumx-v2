import request from 'supertest';
import { ThaliumXBackend } from '../src/index';
import { TestDatabaseHelper } from './integration-setup';

describe('Authentication Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Clean database before tests
    await TestDatabaseHelper.cleanDatabase();
    await TestDatabaseHelper.seedTestData();

    // Initialize the backend (don't start the server)
    const backend = new ThaliumXBackend();
    app = backend.getApp();

    // Create and start a test server
    const http = require('http');
    server = http.createServer(app);
    server.listen(0); // Listen on ephemeral port
  }, 60000);

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await TestDatabaseHelper.cleanDatabase();
  }, 10000);

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        username: 'testuser2',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should return 400 for missing required fields', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'password123'
        // missing username, firstName, lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Email, password, first name, and last name are required');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Register a user for login tests
      const userData = {
        email: 'login-test@example.com',
        password: 'password123',
        username: 'logintest',
        firstName: 'Login',
        lastName: 'Test'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
    });

    it('should return 401 for incorrect password', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      if (typeof response.body.error === 'string') {
        expect(response.body.error).toContain('Invalid credentials');
      } else {
        expect(response.body.error?.message).toContain('Login failed');
      }
    });

    it('should return 400 for missing email or password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login-test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Email and password are required');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Login to get a refresh token
      const loginData = {
        email: 'login-test@example.com',
        password: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      if (typeof response.body.error === 'string') {
        expect(response.body.error.length).toBeGreaterThan(0);
      } else {
        expect(response.body.error?.code).toBeDefined();
      }
    });
  });
});
