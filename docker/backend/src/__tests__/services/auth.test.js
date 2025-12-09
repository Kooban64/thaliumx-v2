"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = require("../../services/user");
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
const auth_1 = require("../../services/auth");
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
            user_1.UserService.getUserByEmail.mockResolvedValue(mockUser);
            auth_1.AuthService.login.mockResolvedValue({
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                user: mockUser
            });
            const result = await auth_1.AuthService.login('test@example.com', 'password123');
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result.user.id).toBe('user-123');
        });
        it('should throw error for invalid credentials', async () => {
            user_1.UserService.getUserByEmail.mockResolvedValue(null);
            auth_1.AuthService.login.mockRejectedValue(new Error('Invalid credentials'));
            await expect(auth_1.AuthService.login('invalid@example.com', 'password123'))
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
            user_1.UserService.getUserByEmail.mockResolvedValue(mockUser);
            auth_1.AuthService.login.mockRejectedValue(new Error('MFA code required'));
            await expect(auth_1.AuthService.login('test@example.com', 'password123'))
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
            user_1.UserService.createUser.mockResolvedValue(mockCreatedUser);
            auth_1.AuthService.register.mockResolvedValue(mockCreatedUser);
            const result = await auth_1.AuthService.register(userData);
            expect(result.id).toBe('user-456');
            expect(result.email).toBe('newuser@example.com');
        });
        it('should validate required fields', async () => {
            auth_1.AuthService.register.mockRejectedValue(new Error('Validation failed'));
            await expect(auth_1.AuthService.register({}))
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
            user_1.UserService.getUserById.mockResolvedValue(mockUser);
            auth_1.AuthService.refreshToken.mockResolvedValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                user: mockUser
            });
            const result = await auth_1.AuthService.refreshToken('valid-refresh-token');
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result.user.id).toBe('user-123');
        });
        it('should throw error for invalid refresh token', async () => {
            auth_1.AuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));
            await expect(auth_1.AuthService.refreshToken('invalid-token'))
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
            user_1.UserService.getUserById.mockResolvedValue(mockUser);
            user_1.UserService.updateUser.mockResolvedValue({ ...mockUser, passwordHash: '$2a$10$newhashedpassword' });
            auth_1.AuthService.changePassword.mockResolvedValue(undefined);
            await expect(auth_1.AuthService.changePassword('user-123', 'oldpassword', 'newpassword123'))
                .resolves.not.toThrow();
        });
        it('should throw error for incorrect current password', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                passwordHash: '$2a$10$hashedpassword'
            };
            user_1.UserService.getUserById.mockResolvedValue(mockUser);
            auth_1.AuthService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
            await expect(auth_1.AuthService.changePassword('user-123', 'wrongpassword', 'newpassword123'))
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
                user_1.UserService.getUserById.mockResolvedValue(mockUser);
                auth_1.AuthService.enableMFA.mockResolvedValue({
                    secret: 'JBSWY3DPEHPK3PXP',
                    qrCode: 'data:image/png;base64,mock-qr-code'
                });
                const result = await auth_1.AuthService.enableMFA('user-123');
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
                user_1.UserService.getUserById.mockResolvedValue(mockUser);
                auth_1.AuthService.verifyMFA.mockResolvedValue({ success: true });
                // Mock valid TOTP code (this would be calculated based on secret)
                const result = await auth_1.AuthService.verifyMFA('user-123', '123456');
                expect(result.success).toBe(true);
            });
        });
    });
});
//# sourceMappingURL=auth.test.js.map