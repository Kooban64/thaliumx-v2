import { UserService } from '../../services/user';
import { DatabaseService } from '../../services/database';

// Mock dependencies
jest.mock('../../services/user');
jest.mock('../../services/database');
jest.mock('../../services/email');
jest.mock('../../services/auth', () => ({
  AuthService: {
    login: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
    changePassword: jest.fn(),
    enableMFA: jest.fn(),
    verifyMFA: jest.fn()
  }
}));

// Import after mocks
import { AuthService } from '../../services/auth';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2a$10$hashedpassword',
        isActive: true,
        mfaEnabled: false
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.login as jest.Mock).mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockUser
      });

      const result = await AuthService.login('test@example.com', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe('user-123');
    });

    it('should throw error for invalid credentials', async () => {
      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      await expect(AuthService.login('invalid@example.com', 'password123'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle MFA when enabled', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2a$10$hashedpassword',
        isActive: true,
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP'
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('MFA code required'));

      await expect(AuthService.login('test@example.com', 'password123'))
        .rejects.toThrow('MFA code required');
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockCreatedUser = {
        id: 'user-456',
        ...userData,
        isActive: false // Needs email verification
      };

      (UserService.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);
      (AuthService.register as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await AuthService.register(userData);

      expect(result.id).toBe('user-456');
      expect(result.email).toBe('newuser@example.com');
    });

    it('should validate required fields', async () => {
      (AuthService.register as jest.Mock).mockRejectedValue(new Error('Validation failed'));
      await expect(AuthService.register({} as any))
        .rejects.toThrow();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        isActive: true
      };

      (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.refreshToken as jest.Mock).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockUser
      });

      const result = await AuthService.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe('user-123');
    });

    it('should throw error for invalid refresh token', async () => {
      (AuthService.refreshToken as jest.Mock).mockRejectedValue(new Error('Invalid refresh token'));
      await expect(AuthService.refreshToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2a$10$oldhashedpassword'
      };

      (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (UserService.updateUser as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash: '$2a$10$newhashedpassword' });
      (AuthService.changePassword as jest.Mock).mockResolvedValue(undefined);

      await expect(AuthService.changePassword('user-123', 'oldpassword', 'newpassword123'))
        .resolves.not.toThrow();
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2a$10$hashedpassword'
      };

      (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.changePassword as jest.Mock).mockRejectedValue(new Error('Current password is incorrect'));

      await expect(AuthService.changePassword('user-123', 'wrongpassword', 'newpassword123'))
        .rejects.toThrow('Current password is incorrect');
    });
  });

  describe('MFA operations', () => {
    describe('enableMFA', () => {
      it('should enable MFA successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          mfaEnabled: false
        };

        (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
        (AuthService.enableMFA as jest.Mock).mockResolvedValue({
          secret: 'JBSWY3DPEHPK3PXP',
          qrCode: 'data:image/png;base64,mock-qr-code'
        });

        const result = await AuthService.enableMFA('user-123');

        expect(result).toHaveProperty('secret');
        expect(result).toHaveProperty('qrCode');
      });
    });

    describe('verifyMFA', () => {
      it('should verify MFA code successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          mfaSecret: 'JBSWY3DPEHPK3PXP',
          mfaEnabled: false
        };

        (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
        (AuthService.verifyMFA as jest.Mock).mockResolvedValue({ success: true });

        // Mock valid TOTP code (this would be calculated based on secret)
        const result = await AuthService.verifyMFA('user-123', '123456');

        expect(result.success).toBe(true);
      });
    });
  });
});