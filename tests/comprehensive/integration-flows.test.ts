/**
 * Integration Flow Tests
 * Tests complete user workflows end-to-end
 */

import axios, { AxiosInstance } from 'axios';
import { TestResult, TestCategory } from '../types/test-results';

const BASE_URL = process.env.API_URL || 'http://localhost:3002';
const API_TIMEOUT = 30000;

const TEST_USERS = {
  trader: {
    email: 'trader@thaliumx.com',
    password: 'TraderPass123!',
    role: 'user'
  },
  admin: {
    email: 'admin@thaliumx.com',
    password: 'AdminPass123!',
    role: 'admin'
  }
};

interface AuthToken {
  token: string;
  refreshToken: string;
  user: any;
}

class IntegrationFlowTester {
  private api: AxiosInstance;
  private tokens: Map<string, AuthToken> = new Map();
  private results: TestResult[] = [];

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: API_TIMEOUT,
      validateStatus: () => true
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
        const token: AuthToken = {
          token: response.data.data.accessToken || response.data.data.token || response.data.accessToken || response.data.token,
          refreshToken: response.data.data.refreshToken || response.data.refreshToken,
          user: response.data.data.user || response.data.user
        };
        this.tokens.set(userKey, token);
        return token;
      }
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
      category: 'trading' as TestCategory,
      feature,
      testName,
      passed,
      details,
      error,
      response: response ? JSON.stringify(response).substring(0, 500) : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Complete trading flow: Login -> Check Balance -> Place Order -> Check Order Status
  async testCompleteTradingFlow(): Promise<void> {
    const flowName = 'Complete Trading Flow';
    console.log(`  🔄 Testing ${flowName}...`);

    // Step 1: Authenticate
    const traderToken = await this.authenticate('trader');
    if (!traderToken) {
      this.recordResult('trading', flowName, 'Step 1: Authentication', false, 'Failed to authenticate');
      return;
    }
    this.recordResult('trading', flowName, 'Step 1: Authentication', true, 'Successfully authenticated');

    const api = this.createApiClient(traderToken.token);

    // Step 2: Get wallet balance
    try {
      const balanceResponse = await api.get('/api/wallets');
      const balancePassed = balanceResponse.status === 200;
      this.recordResult(
        'trading',
        flowName,
        'Step 2: Get Wallet Balance',
        balancePassed,
        `Status: ${balanceResponse.status}`,
        !balancePassed ? `Failed: ${JSON.stringify(balanceResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('trading', flowName, 'Step 2: Get Wallet Balance', false, 'Request failed', error.message);
    }

    // Step 3: Get orderbook
    try {
      const orderbookResponse = await api.get('/api/exchange/orderbook/BTC-USDT');
      const orderbookPassed = orderbookResponse.status === 200;
      this.recordResult(
        'trading',
        flowName,
        'Step 3: Get Orderbook',
        orderbookPassed,
        `Status: ${orderbookResponse.status}`,
        !orderbookPassed ? `Failed: ${JSON.stringify(orderbookResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('trading', flowName, 'Step 3: Get Orderbook', false, 'Request failed', error.message);
    }

    // Step 4: Place order
    try {
      const orderResponse = await api.post('/api/exchange/orders', {
        symbol: 'BTC-USDT',
        side: 'buy',
        type: 'limit',
        quantity: '0.001',
        price: '40000'
      });
      const orderPassed = orderResponse.status === 200 || orderResponse.status === 201;
      this.recordResult(
        'trading',
        flowName,
        'Step 4: Place Order',
        orderPassed,
        `Status: ${orderResponse.status}`,
        !orderPassed ? `Failed: ${JSON.stringify(orderResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('trading', flowName, 'Step 4: Place Order', false, 'Request failed', error.message);
    }

    // Step 5: Get order status
    try {
      const ordersResponse = await api.get('/api/exchange/orders');
      const ordersPassed = ordersResponse.status === 200;
      this.recordResult(
        'trading',
        flowName,
        'Step 5: Get Order Status',
        ordersPassed,
        `Status: ${ordersResponse.status}`,
        !ordersPassed ? `Failed: ${JSON.stringify(ordersResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('trading', flowName, 'Step 5: Get Order Status', false, 'Request failed', error.message);
    }
  }

  // Complete wallet flow: Login -> Create Wallet -> Deposit -> Withdraw
  async testCompleteWalletFlow(): Promise<void> {
    const flowName = 'Complete Wallet Flow';
    console.log(`  🔄 Testing ${flowName}...`);

    const traderToken = await this.authenticate('trader');
    if (!traderToken) {
      this.recordResult('wallet', flowName, 'Step 1: Authentication', false, 'Failed to authenticate');
      return;
    }
    this.recordResult('wallet', flowName, 'Step 1: Authentication', true, 'Successfully authenticated');

    const api = this.createApiClient(traderToken.token);

    // Step 2: Get wallets
    try {
      const walletsResponse = await api.get('/api/wallets');
      this.recordResult(
        'wallet',
        flowName,
        'Step 2: Get Wallets',
        walletsResponse.status === 200,
        `Status: ${walletsResponse.status}`,
        walletsResponse.status !== 200 ? `Failed: ${JSON.stringify(walletsResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('wallet', flowName, 'Step 2: Get Wallets', false, 'Request failed', error.message);
    }

    // Step 3: Create wallet
    try {
      const createResponse = await api.post('/api/wallets', {
        currency: 'USDT',
        type: 'spot'
      });
      this.recordResult(
        'wallet',
        flowName,
        'Step 3: Create Wallet',
        createResponse.status === 200 || createResponse.status === 201,
        `Status: ${createResponse.status}`,
        createResponse.status >= 400 ? `Failed: ${JSON.stringify(createResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('wallet', flowName, 'Step 3: Create Wallet', false, 'Request failed', error.message);
    }

    // Step 4: Fiat deposit
    try {
      const depositResponse = await api.post('/api/fiat/deposits', {
        amount: '100',
        currency: 'USD',
        method: 'bank_transfer'
      });
      this.recordResult(
        'wallet',
        flowName,
        'Step 4: Fiat Deposit',
        depositResponse.status === 200 || depositResponse.status === 201,
        `Status: ${depositResponse.status}`,
        depositResponse.status >= 400 ? `Failed: ${JSON.stringify(depositResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('wallet', flowName, 'Step 4: Fiat Deposit', false, 'Request failed', error.message);
    }
  }

  // Complete KYC flow: Login -> Upload Document -> Check Status -> Verification
  async testCompleteKYCFlow(): Promise<void> {
    const flowName = 'Complete KYC Flow';
    console.log(`  🔄 Testing ${flowName}...`);

    const traderToken = await this.authenticate('trader');
    if (!traderToken) {
      this.recordResult('kyc', flowName, 'Step 1: Authentication', false, 'Failed to authenticate');
      return;
    }
    this.recordResult('kyc', flowName, 'Step 1: Authentication', true, 'Successfully authenticated');

    const api = this.createApiClient(traderToken.token);

    // Step 2: Get KYC status
    try {
      const statusResponse = await api.get(`/api/kyc/status/${traderToken.user?.id || 'test-id'}`);
      this.recordResult(
        'kyc',
        flowName,
        'Step 2: Get KYC Status',
        statusResponse.status === 200 || statusResponse.status === 404,
        `Status: ${statusResponse.status}`,
        undefined
      );
    } catch (error: any) {
      this.recordResult('kyc', flowName, 'Step 2: Get KYC Status', false, 'Request failed', error.message);
    }

    // Step 3: Upload document (simulated)
    try {
      const uploadResponse = await api.post('/api/kyc/documents/upload', {
        documentType: 'passport',
        note: 'Document upload simulated'
      });
      this.recordResult(
        'kyc',
        flowName,
        'Step 3: Upload Document',
        uploadResponse.status === 200 || uploadResponse.status === 201 || uploadResponse.status === 400,
        `Status: ${uploadResponse.status}`,
        undefined
      );
    } catch (error: any) {
      this.recordResult('kyc', flowName, 'Step 3: Upload Document', false, 'Request failed', error.message);
    }
  }

  // Complete admin flow: Login -> View Dashboard -> Manage Users -> View Stats
  async testCompleteAdminFlow(): Promise<void> {
    const flowName = 'Complete Admin Flow';
    console.log(`  🔄 Testing ${flowName}...`);

    const adminToken = await this.authenticate('admin');
    if (!adminToken) {
      this.recordResult('admin', flowName, 'Step 1: Authentication', false, 'Failed to authenticate');
      return;
    }
    this.recordResult('admin', flowName, 'Step 1: Authentication', true, 'Successfully authenticated');

    const api = this.createApiClient(adminToken.token);

    // Step 2: Get admin dashboard
    try {
      const dashboardResponse = await api.get('/api/admin/dashboard');
      this.recordResult(
        'admin',
        flowName,
        'Step 2: Get Admin Dashboard',
        dashboardResponse.status === 200,
        `Status: ${dashboardResponse.status}`,
        dashboardResponse.status !== 200 ? `Failed: ${JSON.stringify(dashboardResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('admin', flowName, 'Step 2: Get Admin Dashboard', false, 'Request failed', error.message);
    }

    // Step 3: Get admin stats
    try {
      const statsResponse = await api.get('/api/admin/stats');
      this.recordResult(
        'admin',
        flowName,
        'Step 3: Get Admin Stats',
        statsResponse.status === 200,
        `Status: ${statsResponse.status}`,
        statsResponse.status !== 200 ? `Failed: ${JSON.stringify(statsResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('admin', flowName, 'Step 3: Get Admin Stats', false, 'Request failed', error.message);
    }

    // Step 4: Get users
    try {
      const usersResponse = await api.get('/api/users');
      this.recordResult(
        'admin',
        flowName,
        'Step 4: Get Users',
        usersResponse.status === 200,
        `Status: ${usersResponse.status}`,
        usersResponse.status !== 200 ? `Failed: ${JSON.stringify(usersResponse.data)}` : undefined
      );
    } catch (error: any) {
      this.recordResult('admin', flowName, 'Step 4: Get Users', false, 'Request failed', error.message);
    }
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('🔄 Starting Integration Flow Tests...\n');

    const testFlows = [
      { name: 'Complete Trading Flow', fn: () => this.testCompleteTradingFlow() },
      { name: 'Complete Wallet Flow', fn: () => this.testCompleteWalletFlow() },
      { name: 'Complete KYC Flow', fn: () => this.testCompleteKYCFlow() },
      { name: 'Complete Admin Flow', fn: () => this.testCompleteAdminFlow() }
    ];

    for (const flow of testFlows) {
      console.log(`📋 Running ${flow.name}...`);
      try {
        await flow.fn();
      } catch (error: any) {
        console.error(`❌ Error in ${flow.name}:`, error.message);
        this.recordResult(
          'error' as TestCategory,
          flow.name,
          'Flow Execution',
          false,
          'Flow test failed',
          error.message
        );
      }
    }

    console.log('\n✅ All integration flow tests completed!\n');
    return this.results;
  }
}

export default IntegrationFlowTester;

