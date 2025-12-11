import { AuthService } from '../../../src/services/auth/auth.service';
import { UserRepository } from '../../../src/repositories/user.repository';
import { createTestUser } from '../../setup';

jest.mock('../../../src/repositories/user.repository');
jest.mock('../../../src/lib/auth/keycloak');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService(mockUserRepository);
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'SecurePass123!',
      };

      const expectedUser = createTestUser({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      mockUserRepository.create.mockResolvedValue(expectedUser);

      const result = await authService.registerUser(userData);

      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...userData,
        status: 'pending',
        kycStatus: 'none',
      });
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        password: 'SecurePass123!',
      };

      mockUserRepository.create.mockRejectedValue(new Error('Email already exists'));

      await expect(authService.registerUser(userData)).rejects.toThrow('Email already exists');
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecurePass123!',
      };

      await expect(authService.registerUser(userData)).rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'weak',
      };

      await expect(authService.registerUser(userData)).rejects.toThrow('Password too weak');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const user = createTestUser({ email: credentials.email });
      const expectedToken = 'jwt-token-123';

      mockUserRepository.findByEmail.mockResolvedValue(user);
      // Mock password verification and token generation

      const result = await authService.authenticateUser(credentials);

      expect(result).toEqual({
        user,
        token: expectedToken,
        refreshToken: expect.any(String),
      });
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      mockUserRepository.findByEmail.mockResolvedValue(createTestUser());

      await expect(authService.authenticateUser(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('should handle account lockout after failed attempts', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const user = createTestUser({
        failedLoginAttempts: 4,
        lockedUntil: new Date(Date.now() - 1000), // Expired lock
      });

      mockUserRepository.findByEmail.mockResolvedValue(user);

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await expect(authService.authenticateUser(credentials)).rejects.toThrow();
      }

      // Next attempt should indicate account is locked
      await expect(authService.authenticateUser(credentials)).rejects.toThrow('Account locked');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', async () => {
      const token = 'valid-jwt-token';
      const expectedPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        roles: ['user'],
      };

      const result = await authService.verifyToken(token);

      expect(result).toEqual(expectedPayload);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-jwt-token';

      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });

    it('should throw error for expired token', async () => {
      const token = 'expired-jwt-token';

      await expect(authService.verifyToken(token)).rejects.toThrow('Token expired');
    });
  });

  describe('authorizeAction', () => {
    it('should authorize user with sufficient permissions', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const action = 'trading.create_order';
      const resource = 'BTC/USDT';

      const user = createTestUser({
        id: userId,
        roles: ['trader'],
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await authService.authorizeAction(userId, action, resource);

      expect(result).toBe(true);
    });

    it('should deny authorization for insufficient permissions', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const action = 'admin.manage_users';
      const resource = 'system';

      const user = createTestUser({
        id: userId,
        roles: ['trader'], // No admin role
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await authService.authorizeAction(userId, action, resource);

      expect(result).toBe(false);
    });

    it('should handle role hierarchy correctly', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const action = 'trading.view_orders'; // Lower privilege action
      const resource = 'BTC/USDT';

      const user = createTestUser({
        id: userId,
        roles: ['admin'], // Higher privilege role
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await authService.authorizeAction(userId, action, resource);

      expect(result).toBe(true);
    });
  });
});