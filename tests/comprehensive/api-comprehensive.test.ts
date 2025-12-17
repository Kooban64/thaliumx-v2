/**
 * Comprehensive API Test Suite
 * Tests all API endpoints across all features
 */

import axios, { AxiosInstance } from 'axios';
import { TestResult, TestSuite, TestCategory } from '../types/test-results';

const BASE_URL = process.env.API_URL || 'http://localhost:3002';
const API_TIMEOUT = 30000;

// Test user credentials
const TEST_USERS = {
  platformAdmin: {
    email: 'admin@thaliumx.com',
    password: 'AdminPass123!',
    role: 'admin'
  },
  brokerAdmin: {
    email: 'broker@thaliumx.com',
    password: 'BrokerPass123!',
    role: 'broker-admin'
  },
  compliance: {
    email: 'compliance@thaliumx.com',
    password: 'CompliancePass123!',
    role: 'compliance'
  },
  finance: {
    email: 'finance@thaliumx.com',
    password: 'FinancePass123!',
    role: 'finance'
  },
  trader: {
    email: 'trader@thaliumx.com',
    password: 'TraderPass123!',
    role: 'user'
  },
  basicUser: {
    email: 'user@thaliumx.com',
    password: 'UserPass123!',
    role: 'user'
  }
};

interface AuthToken {
  token: string;
  refreshToken: string;
  user: any;
}

class ComprehensiveAPITester {
  private api: AxiosInstance;
  private tokens: Map<string, AuthToken> = new Map();
  private results: TestResult[] = [];

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: API_TIMEOUT,
      validateStatus: () => true // Don't throw on any status
    });
  }

  private async authenticate(userKey: keyof typeof TEST_USERS): Promise<AuthToken | null> {
    if (this.tokens.has(userKey)) {
      return this.tokens.get(userKey)!;
    }

    const user = TEST_USERS[userKey];
    try {
      const response = await this.api.post('/api/auth/login', {
        email: user.email,
        password: user.password
      });

      if (response.status === 200 && response.data.success) {
        // Handle both accessToken and token field names
        const data = response.data.data || response.data;
        const token: AuthToken = {
          token: data.accessToken || data.token || response.data.accessToken || response.data.token,
          refreshToken: data.refreshToken || response.data.refreshToken,
          user: data.user || response.data.user
        };
        // Only store if we got a valid token
        if (token.token) {
          this.tokens.set(userKey, token);
          return token;
        }
      }
      return null;
      return null;
    } catch (error) {
      return null;
    }
  }

  private createApiClient(token: string): AxiosInstance {
    return axios.create({
      baseURL: BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      validateStatus: () => true
    });
  }

  private recordResult(
    category: TestCategory,
    feature: string,
    testName: string,
    passed: boolean,
    details: string,
    error?: string,
    response?: any
  ): void {
    this.results.push({
      category,
      feature,
      testName,
      passed,
      details,
      error,
      response: response ? JSON.stringify(response).substring(0, 500) : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // ==================== HEALTH & INFRASTRUCTURE ====================

  async testHealthEndpoints(): Promise<void> {
    const category: TestCategory = 'infrastructure';
    
    // Test public health check
    try {
      const response = await this.api.get('/health');
      this.recordResult(
        category,
        'Health Check',
        'Public Health Check',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Health Check', 'Public Health Check', false, 'Request failed', error.message);
    }

    // Test internal health check (may require auth)
    try {
      const response = await this.api.get('/health/internal');
      this.recordResult(
        category,
        'Health Check',
        'Internal Health Check',
        response.status === 200 || response.status === 403,
        `Status: ${response.status} (403 expected if no auth)`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Health Check', 'Internal Health Check', false, 'Request failed', error.message);
    }

    // Test API docs endpoint
    try {
      const response = await this.api.get('/api/docs');
      this.recordResult(
        category,
        'API Documentation',
        'API Docs Endpoint',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'API Documentation', 'API Docs Endpoint', false, 'Request failed', error.message);
    }
  }

  // ==================== AUTHENTICATION ====================

  async testAuthentication(): Promise<void> {
    const category: TestCategory = 'authentication';

    // Test login for each user role
    for (const [userKey, user] of Object.entries(TEST_USERS)) {
      try {
        const response = await this.api.post('/api/auth/login', {
          email: user.email,
          password: user.password
        });

        const passed = response.status === 200 && response.data.success;
        this.recordResult(
          category,
          'Login',
          `Login as ${userKey}`,
          passed,
          `Status: ${response.status}, Role: ${user.role}`,
          !passed ? `Login failed: ${JSON.stringify(response.data)}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult(category, 'Login', `Login as ${userKey}`, false, 'Request failed', error.message);
      }
    }

    // Test invalid credentials
    try {
      const response = await this.api.post('/api/auth/login', {
        email: 'invalid@test.com',
        password: 'wrongpassword'
      });
      this.recordResult(
        category,
        'Login',
        'Invalid Credentials Rejection',
        response.status === 401 || response.status === 400,
        `Status: ${response.status}`,
        response.status === 200 ? 'Should reject invalid credentials' : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Login', 'Invalid Credentials Rejection', false, 'Request failed', error.message);
    }

    // Test registration
    try {
      const response = await this.api.post('/api/auth/register', {
        email: `test${Date.now()}@test.com`,
        password: 'TestPass123!',
        username: `testuser${Date.now()}`,
        firstName: 'Test',
        lastName: 'User'
      });
      this.recordResult(
        category,
        'Registration',
        'User Registration',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Registration failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Registration', 'User Registration', false, 'Request failed', error.message);
    }

    // Test token refresh
    const adminToken = await this.authenticate('platformAdmin');
    if (adminToken) {
      try {
        const response = await this.api.post('/api/auth/refresh', {
          refreshToken: adminToken.refreshToken
        });
        this.recordResult(
          category,
          'Token Management',
          'Token Refresh',
          response.status === 200,
          `Status: ${response.status}`,
          response.status !== 200 ? `Refresh failed: ${JSON.stringify(response.data)}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult(category, 'Token Management', 'Token Refresh', false, 'Request failed', error.message);
      }
    }
  }

  // ==================== USER MANAGEMENT ====================

  async testUserManagement(): Promise<void> {
    const category: TestCategory = 'user-management';
    const adminToken = await this.authenticate('platformAdmin');
    
    if (!adminToken) {
      this.recordResult(category, 'User Management', 'Admin Authentication', false, 'Failed to authenticate admin');
      return;
    }

    const api = this.createApiClient(adminToken.token);

    // Get all users
    try {
      const response = await api.get('/api/users');
      this.recordResult(
        category,
        'User Management',
        'Get All Users',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'User Management', 'Get All Users', false, 'Request failed', error.message);
    }

    // Get user by ID (using admin user ID)
    try {
      const response = await api.get(`/api/users/${adminToken.user?.id || 'test-id'}`);
      this.recordResult(
        category,
        'User Management',
        'Get User by ID',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'User Management', 'Get User by ID', false, 'Request failed', error.message);
    }

    // Update user profile
    try {
      const response = await api.put(`/api/users/${adminToken.user?.id || 'test-id'}`, {
        firstName: 'Updated',
        lastName: 'Name'
      });
      this.recordResult(
        category,
        'User Management',
        'Update User Profile',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'User Management', 'Update User Profile', false, 'Request failed', error.message);
    }
  }

  // ==================== TRADING & EXCHANGE ====================

  async testTradingFeatures(): Promise<void> {
    const category: TestCategory = 'trading';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Trading', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get orderbook
    try {
      const response = await api.get('/api/exchange/orderbook/BTC-USDT');
      this.recordResult(
        category,
        'Orderbook',
        'Get Orderbook',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Orderbook', 'Get Orderbook', false, 'Request failed', error.message);
    }

    // Place market order
    try {
      const response = await api.post('/api/exchange/orders', {
        symbol: 'BTC-USDT',
        side: 'buy',
        type: 'market',
        quantity: '0.001'
      });
      this.recordResult(
        category,
        'Orders',
        'Place Market Order',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Orders', 'Place Market Order', false, 'Request failed', error.message);
    }

    // Place limit order
    try {
      const response = await api.post('/api/exchange/orders', {
        symbol: 'BTC-USDT',
        side: 'sell',
        type: 'limit',
        quantity: '0.001',
        price: '50000'
      });
      this.recordResult(
        category,
        'Orders',
        'Place Limit Order',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Orders', 'Place Limit Order', false, 'Request failed', error.message);
    }

    // Get user orders
    try {
      const response = await api.get('/api/exchange/orders');
      this.recordResult(
        category,
        'Orders',
        'Get User Orders',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Orders', 'Get User Orders', false, 'Request failed', error.message);
    }

    // Cancel order
    try {
      const response = await api.delete('/api/exchange/orders/test-order-id');
      this.recordResult(
        category,
        'Orders',
        'Cancel Order',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Orders', 'Cancel Order', false, 'Request failed', error.message);
    }
  }

  // ==================== WALLET SYSTEM ====================

  async testWalletSystem(): Promise<void> {
    const category: TestCategory = 'wallet';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Wallet', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get wallets
    try {
      const response = await api.get('/api/wallets');
      this.recordResult(
        category,
        'Wallet Management',
        'Get Wallets',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Wallet Management', 'Get Wallets', false, 'Request failed', error.message);
    }

    // Get wallet balance
    try {
      const response = await api.get('/api/wallets/BTC/balance');
      this.recordResult(
        category,
        'Wallet Management',
        'Get Wallet Balance',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Wallet Management', 'Get Wallet Balance', false, 'Request failed', error.message);
    }

    // Create wallet
    try {
      const response = await api.post('/api/wallets', {
        currency: 'USDT',
        type: 'spot'
      });
      this.recordResult(
        category,
        'Wallet Management',
        'Create Wallet',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Wallet Management', 'Create Wallet', false, 'Request failed', error.message);
    }
  }

  // ==================== FIAT OPERATIONS ====================

  async testFiatOperations(): Promise<void> {
    const category: TestCategory = 'fiat';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Fiat', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get fiat wallets
    try {
      const response = await api.get('/api/fiat/wallets');
      this.recordResult(
        category,
        'Fiat Wallets',
        'Get Fiat Wallets',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Fiat Wallets', 'Get Fiat Wallets', false, 'Request failed', error.message);
    }

    // Create deposit
    try {
      const response = await api.post('/api/fiat/deposits', {
        amount: '100',
        currency: 'USD',
        method: 'bank_transfer'
      });
      this.recordResult(
        category,
        'Fiat Deposits',
        'Create Deposit',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Fiat Deposits', 'Create Deposit', false, 'Request failed', error.message);
    }

    // Create withdrawal
    try {
      const response = await api.post('/api/fiat/withdrawals', {
        amount: '50',
        currency: 'USD',
        method: 'bank_transfer',
        destination: 'test-bank-account'
      });
      this.recordResult(
        category,
        'Fiat Withdrawals',
        'Create Withdrawal',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Fiat Withdrawals', 'Create Withdrawal', false, 'Request failed', error.message);
    }
  }

  // ==================== MARGIN TRADING ====================

  async testMarginTrading(): Promise<void> {
    const category: TestCategory = 'margin';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Margin Trading', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get margin accounts
    try {
      const response = await api.get('/api/margin/accounts');
      this.recordResult(
        category,
        'Margin Accounts',
        'Get Margin Accounts',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Margin Accounts', 'Get Margin Accounts', false, 'Request failed', error.message);
    }

    // Create margin account
    try {
      const response = await api.post('/api/margin/accounts', {
        currency: 'USDT',
        leverage: 10
      });
      this.recordResult(
        category,
        'Margin Accounts',
        'Create Margin Account',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Margin Accounts', 'Create Margin Account', false, 'Request failed', error.message);
    }

    // Get margin positions
    try {
      const response = await api.get('/api/margin/positions');
      this.recordResult(
        category,
        'Margin Positions',
        'Get Margin Positions',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Margin Positions', 'Get Margin Positions', false, 'Request failed', error.message);
    }

    // Place margin order
    try {
      const response = await api.post('/api/margin/orders', {
        symbol: 'BTC-USDT',
        side: 'buy',
        type: 'market',
        quantity: '0.001',
        leverage: 10
      });
      this.recordResult(
        category,
        'Margin Orders',
        'Place Margin Order',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Margin Orders', 'Place Margin Order', false, 'Request failed', error.message);
    }
  }

  // ==================== ADVANCED MARGIN ====================

  async testAdvancedMargin(): Promise<void> {
    const category: TestCategory = 'advanced-margin';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Advanced Margin', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get advanced margin accounts
    try {
      const response = await api.get('/api/advanced-margin/accounts');
      this.recordResult(
        category,
        'Advanced Margin',
        'Get Advanced Margin Accounts',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Advanced Margin', 'Get Advanced Margin Accounts', false, 'Request failed', error.message);
    }
  }

  // ==================== DEX OPERATIONS ====================

  async testDEXOperations(): Promise<void> {
    const category: TestCategory = 'dex';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'DEX', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get DEX quote
    try {
      const response = await api.post('/api/dex/quotes', {
        tokenIn: 'USDT',
        tokenOut: 'BTC',
        amountIn: '1000'
      });
      this.recordResult(
        category,
        'DEX Quotes',
        'Get DEX Quote',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'DEX Quotes', 'Get DEX Quote', false, 'Request failed', error.message);
    }

    // Get DEX pools
    try {
      const response = await api.get('/api/dex/pools');
      this.recordResult(
        category,
        'DEX Pools',
        'Get DEX Pools',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'DEX Pools', 'Get DEX Pools', false, 'Request failed', error.message);
    }

    // Add liquidity
    try {
      const response = await api.post('/api/dex/liquidity/add', {
        tokenA: 'USDT',
        tokenB: 'BTC',
        amountA: '1000',
        amountB: '0.02'
      });
      this.recordResult(
        category,
        'DEX Liquidity',
        'Add Liquidity',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'DEX Liquidity', 'Add Liquidity', false, 'Request failed', error.message);
    }
  }

  // ==================== NFT OPERATIONS ====================

  async testNFTOperations(): Promise<void> {
    const category: TestCategory = 'nft';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'NFT', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get NFT collections
    try {
      const response = await api.get('/api/nft/collections');
      this.recordResult(
        category,
        'NFT Collections',
        'Get NFT Collections',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'NFT Collections', 'Get NFT Collections', false, 'Request failed', error.message);
    }

    // Create NFT collection
    try {
      const response = await api.post('/api/nft/collections', {
        name: 'Test Collection',
        symbol: 'TEST',
        description: 'Test NFT Collection'
      });
      this.recordResult(
        category,
        'NFT Collections',
        'Create NFT Collection',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'NFT Collections', 'Create NFT Collection', false, 'Request failed', error.message);
    }

    // Get NFT activity
    try {
      const response = await api.get('/api/nft/activity');
      this.recordResult(
        category,
        'NFT Activity',
        'Get NFT Activity',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'NFT Activity', 'Get NFT Activity', false, 'Request failed', error.message);
    }
  }

  // ==================== KYC OPERATIONS ====================

  async testKYCOperations(): Promise<void> {
    const category: TestCategory = 'kyc';
    const traderToken = await this.authenticate('trader');
    const complianceToken = await this.authenticate('compliance');
    
    if (!traderToken) {
      this.recordResult(category, 'KYC', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get KYC status
    try {
      const response = await api.get(`/api/kyc/status/${traderToken.user?.id || 'test-id'}`);
      this.recordResult(
        category,
        'KYC Status',
        'Get KYC Status',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'KYC Status', 'Get KYC Status', false, 'Request failed', error.message);
    }

    // Upload KYC document (skip in testnet - requires actual file)
    try {
      // Note: FormData uploads are complex in Node.js, skipping for now
      // In production, this would use proper multipart/form-data
      const response = await api.post('/api/kyc/documents/upload', {
        documentType: 'passport',
        note: 'File upload test skipped - requires actual file'
      });
      this.recordResult(
        category,
        'KYC Documents',
        'Upload KYC Document',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'KYC Documents', 'Upload KYC Document', false, 'Request failed', error.message);
    }

    // Verify KYC (compliance role)
    if (complianceToken) {
      const complianceApi = this.createApiClient(complianceToken.token);
      try {
        const response = await complianceApi.post('/api/kyc/verify', {
          userId: traderToken.user?.id || 'test-id',
          status: 'approved',
          level: 'intermediate'
        });
        this.recordResult(
          category,
          'KYC Verification',
          'Verify KYC (Compliance)',
          response.status === 200,
          `Status: ${response.status}`,
          response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult(category, 'KYC Verification', 'Verify KYC (Compliance)', false, 'Request failed', error.message);
      }
    }
  }

  // ==================== TOKEN SALES ====================

  async testTokenSales(): Promise<void> {
    const category: TestCategory = 'token-sale';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Token Sale', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get token sale stats
    try {
      const response = await api.get('/api/token-sale/stats');
      this.recordResult(
        category,
        'Token Sale',
        'Get Token Sale Stats',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Token Sale', 'Get Token Sale Stats', false, 'Request failed', error.message);
    }

    // Create investment
    try {
      const response = await api.post('/api/token-sale/investments', {
        phaseId: 'test-phase-id',
        amount: '1000',
        currency: 'USDT'
      });
      this.recordResult(
        category,
        'Token Sale',
        'Create Investment',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Token Sale', 'Create Investment', false, 'Request failed', error.message);
    }
  }

  // ==================== PRESALE OPERATIONS ====================

  async testPresaleOperations(): Promise<void> {
    const category: TestCategory = 'presale';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Presale', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get presale info
    try {
      const response = await api.get('/api/presale/info');
      this.recordResult(
        category,
        'Presale',
        'Get Presale Info',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Presale', 'Get Presale Info', false, 'Request failed', error.message);
    }

    // Participate in presale
    try {
      const response = await api.post('/api/presale/participate', {
        amount: '1000',
        currency: 'USDT'
      });
      this.recordResult(
        category,
        'Presale',
        'Participate in Presale',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Presale', 'Participate in Presale', false, 'Request failed', error.message);
    }
  }

  // ==================== RBAC OPERATIONS ====================

  async testRBACOperations(): Promise<void> {
    const category: TestCategory = 'rbac';
    const adminToken = await this.authenticate('platformAdmin');
    
    if (!adminToken) {
      this.recordResult(category, 'RBAC', 'Admin Authentication', false, 'Failed to authenticate admin');
      return;
    }

    const api = this.createApiClient(adminToken.token);

    // Get roles
    try {
      const response = await api.get('/api/rbac/roles');
      this.recordResult(
        category,
        'RBAC',
        'Get Roles',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'RBAC', 'Get Roles', false, 'Request failed', error.message);
    }

    // Assign role to user
    try {
      const response = await api.post(`/api/rbac/users/${adminToken.user?.id || 'test-id'}/roles`, {
        role: 'user'
      });
      this.recordResult(
        category,
        'RBAC',
        'Assign Role to User',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'RBAC', 'Assign Role to User', false, 'Request failed', error.message);
    }

    // Check permissions
    try {
      const response = await api.post('/api/rbac/permissions/check', {
        resource: 'users',
        action: 'read'
      });
      this.recordResult(
        category,
        'RBAC',
        'Check Permissions',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'RBAC', 'Check Permissions', false, 'Request failed', error.message);
    }
  }

  // ==================== ADMIN OPERATIONS ====================

  async testAdminOperations(): Promise<void> {
    const category: TestCategory = 'admin';
    const adminToken = await this.authenticate('platformAdmin');
    
    if (!adminToken) {
      this.recordResult(category, 'Admin', 'Admin Authentication', false, 'Failed to authenticate admin');
      return;
    }

    const api = this.createApiClient(adminToken.token);

    // Get admin stats
    try {
      const response = await api.get('/api/admin/stats');
      this.recordResult(
        category,
        'Admin Stats',
        'Get Admin Stats',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Admin Stats', 'Get Admin Stats', false, 'Request failed', error.message);
    }

    // Get admin dashboard
    try {
      const response = await api.get('/api/admin/dashboard');
      this.recordResult(
        category,
        'Admin Dashboard',
        'Get Admin Dashboard',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Admin Dashboard', 'Get Admin Dashboard', false, 'Request failed', error.message);
    }
  }

  // ==================== BROKER OPERATIONS ====================

  async testBrokerOperations(): Promise<void> {
    const category: TestCategory = 'broker';
    const brokerToken = await this.authenticate('brokerAdmin');
    
    if (!brokerToken) {
      this.recordResult(category, 'Broker', 'Broker Authentication', false, 'Failed to authenticate broker');
      return;
    }

    const api = this.createApiClient(brokerToken.token);

    // Get broker dashboard
    try {
      const response = await api.get('/api/broker/dashboard');
      this.recordResult(
        category,
        'Broker Dashboard',
        'Get Broker Dashboard',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Broker Dashboard', 'Get Broker Dashboard', false, 'Request failed', error.message);
    }

    // Get brokers list (admin only)
    const adminToken = await this.authenticate('platformAdmin');
    if (adminToken) {
      const adminApi = this.createApiClient(adminToken.token);
      try {
        const response = await adminApi.get('/api/brokers');
        this.recordResult(
          category,
          'Broker Management',
          'Get Brokers List',
          response.status === 200,
          `Status: ${response.status}`,
          response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult(category, 'Broker Management', 'Get Brokers List', false, 'Request failed', error.message);
      }
    }
  }

  // ==================== SMART CONTRACTS ====================

  async testSmartContracts(): Promise<void> {
    const category: TestCategory = 'smart-contracts';
    const adminToken = await this.authenticate('platformAdmin');
    
    if (!adminToken) {
      this.recordResult(category, 'Smart Contracts', 'Admin Authentication', false, 'Failed to authenticate admin');
      return;
    }

    const api = this.createApiClient(adminToken.token);

    // Get token info
    try {
      const response = await api.get('/api/contracts/token/0x1234567890123456789012345678901234567890/info');
      this.recordResult(
        category,
        'Smart Contracts',
        'Get Token Info',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Smart Contracts', 'Get Token Info', false, 'Request failed', error.message);
    }
  }

  // ==================== LEDGER OPERATIONS ====================

  async testLedgerOperations(): Promise<void> {
    const category: TestCategory = 'ledger';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Ledger', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get ledger account balance
    try {
      const response = await api.get(`/api/ledger/accounts/${traderToken.user?.id || 'test-id'}/balance`);
      this.recordResult(
        category,
        'Ledger',
        'Get Ledger Account Balance',
        response.status === 200 || response.status === 404,
        `Status: ${response.status}`,
        undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Ledger', 'Get Ledger Account Balance', false, 'Request failed', error.message);
    }

    // Transfer funds
    try {
      const response = await api.post('/api/ledger/transactions/transfer', {
        fromAccountId: traderToken.user?.id || 'test-id',
        toAccountId: 'test-recipient-id',
        amount: '100',
        currency: 'USDT'
      });
      this.recordResult(
        category,
        'Ledger',
        'Transfer Funds',
        response.status === 200 || response.status === 201,
        `Status: ${response.status}`,
        response.status >= 400 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Ledger', 'Transfer Funds', false, 'Request failed', error.message);
    }
  }

  // ==================== NATIVE CEX ====================

  async testNativeCEX(): Promise<void> {
    const category: TestCategory = 'native-cex';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Native CEX', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get trading pairs
    try {
      const response = await api.get('/api/cex/pairs');
      this.recordResult(
        category,
        'Native CEX',
        'Get Trading Pairs',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Native CEX', 'Get Trading Pairs', false, 'Request failed', error.message);
    }
  }

  // ==================== MARKET DATA ====================

  async testMarketData(): Promise<void> {
    const category: TestCategory = 'market-data';
    const traderToken = await this.authenticate('trader');
    
    if (!traderToken) {
      this.recordResult(category, 'Market Data', 'Trader Authentication', false, 'Failed to authenticate trader');
      return;
    }

    const api = this.createApiClient(traderToken.token);

    // Get market data
    try {
      const response = await api.get('/api/market/data/BTC-USDT');
      this.recordResult(
        category,
        'Market Data',
        'Get Market Data',
        response.status === 200,
        `Status: ${response.status}`,
        response.status !== 200 ? `Failed: ${JSON.stringify(response.data)}` : undefined,
        response.data
      );
    } catch (error: any) {
      this.recordResult(category, 'Market Data', 'Get Market Data', false, 'Request failed', error.message);
    }
  }

  // ==================== RUN ALL TESTS ====================

  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 Starting Comprehensive API Test Suite...\n');

    const testSuites = [
      { name: 'Health & Infrastructure', fn: () => this.testHealthEndpoints() },
      { name: 'Authentication', fn: () => this.testAuthentication() },
      { name: 'User Management', fn: () => this.testUserManagement() },
      { name: 'Trading & Exchange', fn: () => this.testTradingFeatures() },
      { name: 'Wallet System', fn: () => this.testWalletSystem() },
      { name: 'Fiat Operations', fn: () => this.testFiatOperations() },
      { name: 'Margin Trading', fn: () => this.testMarginTrading() },
      { name: 'Advanced Margin', fn: () => this.testAdvancedMargin() },
      { name: 'DEX Operations', fn: () => this.testDEXOperations() },
      { name: 'NFT Operations', fn: () => this.testNFTOperations() },
      { name: 'KYC Operations', fn: () => this.testKYCOperations() },
      { name: 'Token Sales', fn: () => this.testTokenSales() },
      { name: 'Presale Operations', fn: () => this.testPresaleOperations() },
      { name: 'RBAC Operations', fn: () => this.testRBACOperations() },
      { name: 'Admin Operations', fn: () => this.testAdminOperations() },
      { name: 'Broker Operations', fn: () => this.testBrokerOperations() },
      { name: 'Smart Contracts', fn: () => this.testSmartContracts() },
      { name: 'Ledger Operations', fn: () => this.testLedgerOperations() },
      { name: 'Native CEX', fn: () => this.testNativeCEX() },
      { name: 'Market Data', fn: () => this.testMarketData() }
    ];

    for (const suite of testSuites) {
      console.log(`📋 Running ${suite.name} tests...`);
      try {
        await suite.fn();
      } catch (error: any) {
        console.error(`❌ Error in ${suite.name}:`, error.message);
        this.recordResult(
          'error' as TestCategory,
          suite.name,
          'Test Suite Execution',
          false,
          'Test suite failed',
          error.message
        );
      }
    }

    console.log('\n✅ All tests completed!\n');
    return this.results;
  }
}

export default ComprehensiveAPITester;

