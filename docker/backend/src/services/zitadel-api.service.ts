/**
 * Zitadel Management API Service
 * 
 * Handles all interactions with Zitadel Management API for user management.
 * Uses OAuth 2.0 Client Credentials flow for service account authentication.
 * 
 * Features:
 * - Create users in Zitadel
 * - Authenticate users (password verification)
 * - Get user by email
 * - Update user password
 * - Get user by ID
 * 
 * Security:
 * - Service account credentials stored in environment variables
 * - All API calls use HTTPS
 * - Tokens are cached and refreshed automatically
 */

import axios, { type AxiosInstance } from 'axios';
import { LoggerService } from './logger';
import { createError } from '../utils';

interface ZitadelTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZitadelUserResponse {
  userId: string;
  username: string;
  email?: {
    email: string;
    isEmailVerified: boolean;
  };
  profile?: {
    givenName: string;
    familyName: string;
  };
  state: string;
}

interface ZitadelCreateUserRequest {
  userName: string;
  profile?: {
    givenName: string;
    familyName: string;
  };
  email?: {
    email: string;
    isEmailVerified?: boolean;
  };
  password?: {
    password: string;
    changeRequired?: boolean;
  };
}

export class ZitadelApiService {
  private static instance: ZitadelApiService | null = null;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly issuer: string;
  private serviceAccountId: string; // Not readonly - loaded from Vault
  private serviceAccountKey: string; // Not readonly - loaded from Vault
  private projectId: string; // Not readonly - loaded from Vault
  private orgId: string; // Not readonly - loaded from Vault

  private constructor() {
    // Load Zitadel credentials from Vault (secure) or environment variables (fallback)
    // Priority: Vault > Environment Variables
    this.issuer = process.env.ZITADEL_ISSUER || 'https://auth.thaliumx.com';
    
    // Try to load from Vault first, fallback to environment variables
    this.serviceAccountId = process.env.ZITADEL_SERVICE_ACCOUNT_ID || '';
    this.serviceAccountKey = process.env.ZITADEL_SERVICE_ACCOUNT_KEY || '';
    this.projectId = process.env.ZITADEL_PROJECT_ID || '';
    this.orgId = process.env.ZITADEL_ORG_ID || '';

    // Load from Vault if available (async, will be loaded on first use)
    this.loadCredentialsFromVault();

    if (!this.serviceAccountId || !this.serviceAccountKey) {
      LoggerService.warn('Zitadel service account credentials not configured. Zitadel API operations will fail.');
    }

    // Remove trailing slash from issuer
    const baseURL = this.issuer.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: `${baseURL}/management/v1`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor to inject access token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, refresh and retry
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          const token = await this.getAccessToken();
          if (token && error.config) {
            error.config.headers.Authorization = `Bearer ${token}`;
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ZitadelApiService {
    if (!ZitadelApiService.instance) {
      ZitadelApiService.instance = new ZitadelApiService();
    }
    return ZitadelApiService.instance;
  }

  /**
   * Get OAuth 2.0 access token using Client Credentials flow
   */
  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    // Ensure credentials are loaded from Vault (if available) before using them
    await this.loadCredentialsFromVault();

    if (!this.serviceAccountId || !this.serviceAccountKey) {
      throw createError('Zitadel service account credentials not configured', 500, 'ZITADEL_CONFIG_ERROR');
    }

    try {
      const tokenURL = `${this.issuer.replace(/\/$/, '')}/oauth/v2/token`;
      
      const response = await axios.post<ZitadelTokenResponse>(
        tokenURL,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.serviceAccountId,
          client_secret: this.serviceAccountKey,
          scope: 'openid profile email'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

      LoggerService.debug('Zitadel access token obtained', {
        expiresIn: response.data.expires_in
      });

      return this.accessToken;
    } catch (error: any) {
      LoggerService.error('Failed to obtain Zitadel access token', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw createError('Failed to authenticate with Zitadel', 500, 'ZITADEL_AUTH_ERROR');
    }
  }

  /**
   * Create a new user in Zitadel
   */
  public async createUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ userId: string; username: string }> {
    try {
      const request: ZitadelCreateUserRequest = {
        userName: email,
        profile: {
          givenName: firstName,
          familyName: lastName
        },
        email: {
          email: email,
          isEmailVerified: false // User will verify via email
        },
        password: {
          password: password,
          changeRequired: false
        }
      };

      const response = await this.client.post<ZitadelUserResponse>(
        `/users/human/_import`,
        request
      );

      LoggerService.info('User created in Zitadel', {
        userId: response.data.userId,
        email: email,
        username: response.data.username
      });

      return {
        userId: response.data.userId,
        username: response.data.username
      };
    } catch (error: any) {
      LoggerService.error('Failed to create user in Zitadel', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        email
      });

      if (error.response?.status === 409) {
        throw createError('User already exists in Zitadel', 409, 'USER_ALREADY_EXISTS');
      }

      throw createError(
        `Failed to create user in Zitadel: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_CREATE_USER_ERROR'
      );
    }
  }

  /**
   * Authenticate a user with email and password
   * Returns the Zitadel user ID if authentication succeeds
   */
  public async authenticateUser(email: string, password: string): Promise<{ userId: string; username: string }> {
    try {
      // First, get user by email to get userId
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        throw createError('User not found in Zitadel', 404, 'USER_NOT_FOUND');
      }

      // Authenticate using password grant
      const tokenURL = `${this.issuer.replace(/\/$/, '')}/oauth/v2/token`;
      
      await axios.post<ZitadelTokenResponse>(
        tokenURL,
        new URLSearchParams({
          grant_type: 'password',
          client_id: this.serviceAccountId,
          client_secret: this.serviceAccountKey,
          username: email,
          password: password,
          scope: 'openid profile email'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      LoggerService.debug('User authenticated in Zitadel', {
        userId: user.userId,
        email: email
      });

      // user is guaranteed to be defined here due to the check above
      return {
        userId: user.userId,
        username: user.username
      };
    } catch (error: any) {
      LoggerService.error('Failed to authenticate user in Zitadel', {
        error: error.message,
        status: error.response?.status,
        email
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      if (error.response?.status === 404) {
        throw createError('User not found in Zitadel', 404, 'USER_NOT_FOUND');
      }

      throw createError(
        `Failed to authenticate user: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_AUTH_ERROR'
      );
    }
  }

  /**
   * Get user by email address
   */
  public async getUserByEmail(email: string): Promise<{ userId: string; username: string } | null> {
    try {
      // Zitadel Management API: Search users by email
      const response = await this.client.get<{ result: ZitadelUserResponse[] }>(
        `/users/_search`,
        {
          params: {
            queries: JSON.stringify([
              {
                emailQuery: {
                  emailAddress: email
                }
              }
            ])
          }
        }
      );

      if (response.data.result && response.data.result.length > 0) {
        const user = response.data.result[0];
        if (user && user.userId && user.username) {
          return {
            userId: user.userId,
            username: user.username
          };
        }
      }

      return null;
    } catch (error: any) {
      LoggerService.error('Failed to get user by email from Zitadel', {
        error: error.message,
        status: error.response?.status,
        email
      });

      // Return null if user not found (404), throw for other errors
      if (error.response?.status === 404) {
        return null;
      }

      throw createError(
        `Failed to get user from Zitadel: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_GET_USER_ERROR'
      );
    }
  }

  /**
   * Get user by Zitadel user ID
   */
  public async getUserById(userId: string): Promise<{ userId: string; username: string; email?: string } | null> {
    try {
      const response = await this.client.get<ZitadelUserResponse>(
        `/users/${userId}`
      );

      return {
        userId: response.data.userId,
        username: response.data.username,
        email: response.data.email?.email
      };
    } catch (error: any) {
      LoggerService.error('Failed to get user by ID from Zitadel', {
        error: error.message,
        status: error.response?.status,
        userId
      });

      if (error.response?.status === 404) {
        return null;
      }

      throw createError(
        `Failed to get user from Zitadel: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_GET_USER_ERROR'
      );
    }
  }

  /**
   * Get Zitadel OIDC token for a user using password grant
   * This is used after authentication to get a proper OIDC token
   * Returns the access token and expiration
   */
  public async getUserToken(email: string, password: string): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
    try {
      const tokenURL = `${this.issuer.replace(/\/$/, '')}/oauth/v2/token`;
      
      const response = await axios.post<ZitadelTokenResponse>(
        tokenURL,
        new URLSearchParams({
          grant_type: 'password',
          client_id: this.serviceAccountId,
          client_secret: this.serviceAccountKey,
          username: email,
          password: password,
          scope: 'openid profile email'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      LoggerService.debug('Zitadel OIDC token obtained for user', {
        email,
        expiresIn: response.data.expires_in
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type || 'Bearer'
      };
    } catch (error: any) {
      LoggerService.error('Failed to get Zitadel token for user', {
        error: error.message,
        status: error.response?.status,
        email
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      throw createError(
        `Failed to get Zitadel token: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_TOKEN_ERROR'
      );
    }
  }

  /**
   * Load Zitadel credentials from Vault (secure storage)
   * Falls back to environment variables if Vault is not available
   * This method is idempotent - safe to call multiple times
   */
  private async loadCredentialsFromVault(): Promise<void> {
    // Only load if credentials are not already set (from previous Vault load)
    // This prevents overwriting Vault credentials with env vars on subsequent calls
    const credentialsAlreadyLoaded = this.serviceAccountId && this.serviceAccountKey && 
                                     this.serviceAccountId !== process.env.ZITADEL_SERVICE_ACCOUNT_ID;

    if (credentialsAlreadyLoaded) {
      return; // Already loaded from Vault
    }

    try {
      const { SecretsService } = await import('./secrets');
      
      if (SecretsService.isConnected()) {
        // Load from Vault secret path: thaliumx/zitadel
        const vaultServiceAccountId = await SecretsService.getSecret('thaliumx/zitadel', 'service_account_id');
        const vaultServiceAccountKey = await SecretsService.getSecret('thaliumx/zitadel', 'service_account_key');
        const vaultProjectId = await SecretsService.getSecret('thaliumx/zitadel', 'project_id');
        const vaultOrgId = await SecretsService.getSecret('thaliumx/zitadel', 'org_id');

        // Use Vault values if available, otherwise keep environment variable values
        if (vaultServiceAccountId) {
          this.serviceAccountId = vaultServiceAccountId;
          LoggerService.debug('Loaded Zitadel service account ID from Vault');
        }
        if (vaultServiceAccountKey) {
          this.serviceAccountKey = vaultServiceAccountKey;
          LoggerService.debug('Loaded Zitadel service account key from Vault');
        }
        if (vaultProjectId) {
          this.projectId = vaultProjectId;
        }
        if (vaultOrgId) {
          this.orgId = vaultOrgId;
        }

        if (vaultServiceAccountId && vaultServiceAccountKey) {
          LoggerService.info('✅ Zitadel credentials loaded from Vault (secure)');
        }
      } else {
        LoggerService.debug('Vault not available, using environment variables for Zitadel credentials');
      }
    } catch (error: any) {
      // Fallback to environment variables if Vault fails
      LoggerService.warn('Failed to load Zitadel credentials from Vault, using environment variables', {
        error: error.message
      });
    }
  }

  /**
   * Update user password
   */
  public async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      await this.client.post(
        `/users/${userId}/password`,
        {
          newPassword: {
            password: newPassword,
            changeRequired: false
          }
        }
      );

      LoggerService.info('User password updated in Zitadel', {
        userId
      });
    } catch (error: any) {
      LoggerService.error('Failed to update user password in Zitadel', {
        error: error.message,
        status: error.response?.status,
        userId
      });

      throw createError(
        `Failed to update password: ${error.response?.data?.message || error.message}`,
        500,
        'ZITADEL_UPDATE_PASSWORD_ERROR'
      );
    }
  }
}

// Export singleton instance
export const zitadelApiService = ZitadelApiService.getInstance();
