/**
 * Role-Based Access Control Tests
 * Tests that each role can only access appropriate endpoints
 */

import axios, { AxiosInstance } from 'axios';
import { TestResult, TestCategory } from '../types/test-results';

const BASE_URL = process.env.API_URL || 'http://localhost:3002';
const API_TIMEOUT = 30000;

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

class RoleBasedAccessTester {
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
      category: 'rbac',
      feature,
      testName,
      passed,
      details,
      error,
      response: response ? JSON.stringify(response).substring(0, 500) : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Test that platform admin can access admin endpoints
  async testPlatformAdminAccess(): Promise<void> {
    const adminToken = await this.authenticate('platformAdmin');
    if (!adminToken) {
      this.recordResult('rbac', 'Platform Admin', 'Authentication', false, 'Failed to authenticate');
      return;
    }

    const api = this.createApiClient(adminToken.token);

    const adminEndpoints = [
      { method: 'GET', path: '/api/admin/stats', name: 'Admin Stats' },
      { method: 'GET', path: '/api/admin/dashboard', name: 'Admin Dashboard' },
      { method: 'GET', path: '/api/users', name: 'User Management' },
      { method: 'GET', path: '/api/brokers', name: 'Broker Management' },
      { method: 'GET', path: '/api/rbac/roles', name: 'RBAC Roles' }
    ];

    for (const endpoint of adminEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Platform Admin',
          `Access ${endpoint.name}`,
          response.status === 200 || response.status === 201,
          `Status: ${response.status}`,
          response.status >= 400 ? `Expected success, got ${response.status}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Platform Admin', `Access ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }
  }

  // Test that broker admin can access broker endpoints but not platform admin endpoints
  async testBrokerAdminAccess(): Promise<void> {
    const brokerToken = await this.authenticate('brokerAdmin');
    if (!brokerToken) {
      this.recordResult('rbac', 'Broker Admin', 'Authentication', false, 'Failed to authenticate');
      return;
    }

    const api = this.createApiClient(brokerToken.token);

    // Should have access to broker endpoints
    const allowedEndpoints = [
      { method: 'GET', path: '/api/broker/dashboard', name: 'Broker Dashboard' },
      { method: 'GET', path: '/api/broker/users', name: 'Broker Users' }
    ];

    for (const endpoint of allowedEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Broker Admin',
          `Access ${endpoint.name}`,
          response.status === 200 || response.status === 201,
          `Status: ${response.status}`,
          response.status >= 400 ? `Expected success, got ${response.status}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Broker Admin', `Access ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }

    // Should NOT have access to platform admin endpoints
    const forbiddenEndpoints = [
      { method: 'GET', path: '/api/admin/stats', name: 'Admin Stats' },
      { method: 'GET', path: '/api/admin/dashboard', name: 'Admin Dashboard' },
      { method: 'GET', path: '/api/brokers', name: 'All Brokers' }
    ];

    for (const endpoint of forbiddenEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Broker Admin',
          `Denied ${endpoint.name}`,
          response.status === 403 || response.status === 401,
          `Status: ${response.status} (should be 403/401)`,
          response.status === 200 ? 'Should be denied access' : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Broker Admin', `Denied ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }
  }

  // Test that compliance officer can access compliance endpoints
  async testComplianceAccess(): Promise<void> {
    const complianceToken = await this.authenticate('compliance');
    if (!complianceToken) {
      this.recordResult('rbac', 'Compliance', 'Authentication', false, 'Failed to authenticate');
      return;
    }

    const api = this.createApiClient(complianceToken.token);

    const complianceEndpoints = [
      { method: 'GET', path: '/api/kyc/status/test-user-id', name: 'KYC Status' },
      { method: 'POST', path: '/api/kyc/verify', name: 'KYC Verification', body: { userId: 'test', status: 'approved' } }
    ];

    for (const endpoint of complianceEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path,
          data: endpoint.body
        });
        this.recordResult(
          'rbac',
          'Compliance',
          `Access ${endpoint.name}`,
          response.status === 200 || response.status === 201 || response.status === 404,
          `Status: ${response.status}`,
          response.status === 403 ? 'Should have access' : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Compliance', `Access ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }
  }

  // Test that regular user can access user endpoints but not admin endpoints
  async testRegularUserAccess(): Promise<void> {
    const userToken = await this.authenticate('trader');
    if (!userToken) {
      this.recordResult('rbac', 'Regular User', 'Authentication', false, 'Failed to authenticate');
      return;
    }

    const api = this.createApiClient(userToken.token);

    // Should have access to user endpoints
    const allowedEndpoints = [
      { method: 'GET', path: '/api/users/profile', name: 'User Profile' },
      { method: 'GET', path: '/api/wallets', name: 'User Wallets' },
      { method: 'GET', path: '/api/exchange/orders', name: 'User Orders' }
    ];

    for (const endpoint of allowedEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Regular User',
          `Access ${endpoint.name}`,
          response.status === 200 || response.status === 201,
          `Status: ${response.status}`,
          response.status >= 400 ? `Expected success, got ${response.status}` : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Regular User', `Access ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }

    // Should NOT have access to admin endpoints
    const forbiddenEndpoints = [
      { method: 'GET', path: '/api/admin/stats', name: 'Admin Stats' },
      { method: 'GET', path: '/api/admin/dashboard', name: 'Admin Dashboard' },
      { method: 'GET', path: '/api/users', name: 'All Users' },
      { method: 'GET', path: '/api/brokers', name: 'Brokers' }
    ];

    for (const endpoint of forbiddenEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Regular User',
          `Denied ${endpoint.name}`,
          response.status === 403 || response.status === 401,
          `Status: ${response.status} (should be 403/401)`,
          response.status === 200 ? 'Should be denied access' : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Regular User', `Denied ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }
  }

  // Test that unauthenticated users cannot access protected endpoints
  async testUnauthenticatedAccess(): Promise<void> {
    const api = axios.create({
      baseURL: BASE_URL,
      timeout: API_TIMEOUT,
      validateStatus: () => true
    });

    const protectedEndpoints = [
      { method: 'GET', path: '/api/users', name: 'Users' },
      { method: 'GET', path: '/api/admin/stats', name: 'Admin Stats' },
      { method: 'GET', path: '/api/wallets', name: 'Wallets' },
      { method: 'GET', path: '/api/exchange/orders', name: 'Orders' }
    ];

    for (const endpoint of protectedEndpoints) {
      try {
        const response = await api.request({
          method: endpoint.method as any,
          url: endpoint.path
        });
        this.recordResult(
          'rbac',
          'Unauthenticated',
          `Denied ${endpoint.name}`,
          response.status === 401 || response.status === 403,
          `Status: ${response.status} (should be 401/403)`,
          response.status === 200 ? 'Should require authentication' : undefined,
          response.data
        );
      } catch (error: any) {
        this.recordResult('rbac', 'Unauthenticated', `Denied ${endpoint.name}`, false, 'Request failed', error.message);
      }
    }
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('🔐 Starting Role-Based Access Control Tests...\n');

    const testSuites = [
      { name: 'Platform Admin Access', fn: () => this.testPlatformAdminAccess() },
      { name: 'Broker Admin Access', fn: () => this.testBrokerAdminAccess() },
      { name: 'Compliance Access', fn: () => this.testComplianceAccess() },
      { name: 'Regular User Access', fn: () => this.testRegularUserAccess() },
      { name: 'Unauthenticated Access', fn: () => this.testUnauthenticatedAccess() }
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

    console.log('\n✅ All RBAC tests completed!\n');
    return this.results;
  }
}

export default RoleBasedAccessTester;

