/**
 * Test Data Setup and Teardown for Authentication and KYC E2E Tests
 *
 * This file handles the creation and cleanup of test users and data
 * required for authentication and KYC verification tests.
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Test user data for different scenarios
export const TEST_USERS = {
  // Regular user with L0 KYC
  regular_l0: {
    userId: 'test-user-l0-id',
    email: 'test-user-l0@example.com',
    firstName: 'Test',
    lastName: 'User L0',
    role: 'user',
    kycLevel: 'L0',
    tenantId: 'test-tenant-id'
  },
  // Verified user with L1 KYC
  verified_l1: {
    userId: 'test-user-l1-id',
    email: 'test-user-l1@example.com',
    firstName: 'Test',
    lastName: 'User L1',
    role: 'user',
    kycLevel: 'L1',
    tenantId: 'test-tenant-id'
  },
  // Advanced user with L2 KYC
  advanced_l2: {
    userId: 'test-user-l2-id',
    email: 'test-user-l2@example.com',
    firstName: 'Test',
    lastName: 'User L2',
    role: 'user',
    kycLevel: 'L2',
    tenantId: 'test-tenant-id'
  },
  // Premium user with L3 KYC
  premium_l3: {
    userId: 'test-user-l3-id',
    email: 'test-user-l3@example.com',
    firstName: 'Test',
    lastName: 'User L3',
    role: 'user',
    kycLevel: 'L3',
    tenantId: 'test-tenant-id'
  },
  // Broker user
  broker: {
    userId: 'test-broker-id',
    email: 'test-broker@example.com',
    firstName: 'Test',
    lastName: 'Broker',
    role: 'broker',
    kycLevel: 'L2',
    tenantId: 'test-tenant-id'
  },
  // Admin user
  admin: {
    userId: 'test-admin-id',
    email: 'test-admin@example.com',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    kycLevel: 'L3',
    tenantId: 'test-tenant-id'
  }
};

// Mock tokens for testing (in real scenarios, these would be obtained through actual auth)
export const MOCK_TOKENS = {
  admin: 'mock-admin-token',
  broker: 'mock-broker-token',
  user_l0: 'mock-l0-token',
  user_l1: 'mock-l1-token',
  user_l2: 'mock-l2-token',
  user_l3: 'mock-l3-token'
};

/**
 * Setup test data before running tests
 */
export async function setupTestData() {
  console.log('🚀 Setting up test data for authentication and KYC tests...');

  try {
    // In a real implementation, this would:
    // 1. Create test users in Authentik
    // 2. Set up their roles and permissions
    // 3. Initialize KYC records with appropriate levels
    // 4. Create necessary tenant and broker relationships

    // For now, we'll just verify the API endpoints are accessible
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (!healthResponse.ok) {
      console.warn('⚠️ Backend API not accessible during test setup');
      return;
    }

    // Test KYC service health
    const kycHealthResponse = await fetch(`${API_BASE_URL}/api/kyc/health`);
    if (kycHealthResponse.ok) {
      console.log('✅ KYC service is healthy');
    } else {
      console.warn('⚠️ KYC service health check failed');
    }

    // Test RBAC service health
    const rbacHealthResponse = await fetch(`${API_BASE_URL}/api/rbac/health`);
    if (rbacHealthResponse.ok) {
      console.log('✅ RBAC service is healthy');
    } else {
      console.warn('⚠️ RBAC service health check failed');
    }

    console.log('✅ Test data setup completed (mock setup for demonstration)');

  } catch (error: any) {
    console.error('❌ Test data setup failed:', error.message);
    // Don't throw - allow tests to run even if setup has issues
    console.warn('⚠️ Continuing with tests despite setup warnings...');
  }
}

/**
 * Clean up test data after running tests
 */
export async function teardownTestData() {
  console.log('🧹 Cleaning up test data...');

  try {
    // In a real implementation, this would:
    // 1. Remove test users from Authentik
    // 2. Clean up KYC records
    // 3. Remove role assignments
    // 4. Clean up any test-specific data

    console.log('✅ Test data cleanup completed (mock cleanup for demonstration)');

  } catch (error: any) {
    console.error('❌ Test data cleanup failed:', error.message);
    // Don't throw - cleanup failures shouldn't break the test run
  }
}

/**
 * Create a test user in the system (mock implementation)
 */
export async function createTestUser(userData: typeof TEST_USERS.regular_l0) {
  try {
    // In real implementation, this would call backend APIs to create user
    console.log(`📝 Creating test user: ${userData.email}`);

    // Mock API call - in real scenario, this would be actual API calls
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_TOKENS.admin}`
      },
      body: JSON.stringify(userData)
    }).catch(() => null);

    if (response?.ok) {
      console.log(`✅ Test user created: ${userData.email}`);
      return true;
    } else {
      console.log(`⚠️ Could not create test user: ${userData.email} (API not available)`);
      return false;
    }

  } catch (error) {
    console.warn(`⚠️ Failed to create test user ${userData.email}:`, error);
    return false;
  }
}

/**
 * Delete a test user from the system (mock implementation)
 */
export async function deleteTestUser(userId: string) {
  try {
    console.log(`🗑️ Deleting test user: ${userId}`);

    // Mock API call
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${MOCK_TOKENS.admin}`
      }
    }).catch(() => null);

    if (response?.ok) {
      console.log(`✅ Test user deleted: ${userId}`);
      return true;
    } else {
      console.log(`⚠️ Could not delete test user: ${userId} (API not available)`);
      return false;
    }

  } catch (error) {
    console.warn(`⚠️ Failed to delete test user ${userId}:`, error);
    return false;
  }
}

/**
 * Setup KYC data for a test user
 */
export async function setupUserKYC(userId: string, kycLevel: string) {
  try {
    console.log(`🔒 Setting up KYC level ${kycLevel} for user: ${userId}`);

    const kycData = {
      userId,
      brokerId: 'test-broker-id',
      email: `test-user-${userId}@example.com`,
      requestedLevel: kycLevel
    };

    const response = await fetch(`${API_BASE_URL}/api/kyc/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_TOKENS.admin}`
      },
      body: JSON.stringify(kycData)
    }).catch(() => null);

    if (response?.ok) {
      console.log(`✅ KYC setup completed for user: ${userId}`);
      return true;
    } else {
      console.log(`⚠️ Could not setup KYC for user: ${userId} (API not available)`);
      return false;
    }

  } catch (error) {
    console.warn(`⚠️ Failed to setup KYC for user ${userId}:`, error);
    return false;
  }
}

/**
 * Assign role to a test user
 */
export async function assignUserRole(userId: string, roleId: string) {
  try {
    console.log(`👤 Assigning role ${roleId} to user: ${userId}`);

    const roleData = {
      roleId: roleId,
      reason: 'Test setup',
      expiresAt: null
    };

    const response = await fetch(`${API_BASE_URL}/api/rbac/users/${userId}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_TOKENS.admin}`
      },
      body: JSON.stringify(roleData)
    }).catch(() => null);

    if (response?.ok) {
      console.log(`✅ Role assigned to user: ${userId}`);
      return true;
    } else {
      console.log(`⚠️ Could not assign role to user: ${userId} (API not available)`);
      return false;
    }

  } catch (error) {
    console.warn(`⚠️ Failed to assign role to user ${userId}:`, error);
    return false;
  }
}

/**
 * Get authentication headers for a test user
 */
export function getAuthHeaders(userType: keyof typeof MOCK_TOKENS) {
  return {
    'Authorization': `Bearer ${MOCK_TOKENS[userType]}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Wait for backend services to be ready
 */
export async function waitForServices(timeoutMs: number = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/health`);
      if (healthResponse.ok) {
        console.log('✅ Backend services are ready');
        return true;
      }
    } catch (error) {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.warn('⚠️ Backend services did not become ready within timeout');
  return false;
}
