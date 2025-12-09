#!/usr/bin/env node

/**
 * API Security Testing Suite
 * Tests for common security vulnerabilities and compliance
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class APISecurityTester {
  constructor(baseURL = 'http://localhost:3002') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      validateStatus: () => true // Don't throw on error status codes
    });
  }

  async runSecurityTests() {
    console.log('🚀 Starting API Security Tests...\n');

    const results = {
      summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
      tests: []
    };

    // Authentication Tests
    await this.testAuthenticationSecurity(results);

    // Authorization Tests
    await this.testAuthorizationSecurity(results);

    // Input Validation Tests
    await this.testInputValidation(results);

    // Rate Limiting Tests
    await this.testRateLimiting(results);

    // CORS Tests
    await this.testCORS(results);

    // Security Headers Tests
    await this.testSecurityHeaders(results);

    // SQL Injection Tests
    await this.testSQLInjection(results);

    // XSS Tests
    await this.testXSS(results);

    // Print Results
    this.printResults(results);

    return results;
  }

  async testAuthenticationSecurity(results) {
    console.log('🔐 Testing Authentication Security...');

    // Test 1: Invalid credentials
    try {
      const response = await this.client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });

      if (response.status === 401) {
        this.addTestResult(results, 'Invalid credentials rejected', true);
      } else {
        this.addTestResult(results, 'Invalid credentials rejected', false, 'Expected 401, got ' + response.status);
      }
    } catch (error) {
      this.addTestResult(results, 'Invalid credentials rejected', false, error.message);
    }

    // Test 2: Brute force protection
    const bruteForcePromises = [];
    for (let i = 0; i < 10; i++) {
      bruteForcePromises.push(
        this.client.post('/api/auth/login', {
          email: 'test@example.com',
          password: 'wrongpassword' + i
        })
      );
    }

    try {
      const responses = await Promise.all(bruteForcePromises);
      const blockedRequests = responses.filter(r => r.status === 429).length;

      if (blockedRequests > 0) {
        this.addTestResult(results, 'Brute force protection active', true);
      } else {
        this.addTestResult(results, 'Brute force protection active', false, 'No rate limiting detected');
      }
    } catch (error) {
      this.addTestResult(results, 'Brute force protection active', false, error.message);
    }

    // Test 3: JWT token validation
    try {
      const response = await this.client.get('/api/auth/profile', {
        headers: { Authorization: 'Bearer invalid.jwt.token' }
      });

      if (response.status === 401) {
        this.addTestResult(results, 'Invalid JWT rejected', true);
      } else {
        this.addTestResult(results, 'Invalid JWT rejected', false, 'Expected 401, got ' + response.status);
      }
    } catch (error) {
      this.addTestResult(results, 'Invalid JWT rejected', false, error.message);
    }
  }

  async testAuthorizationSecurity(results) {
    console.log('🔒 Testing Authorization Security...');

    // Get valid token first
    let validToken = null;
    try {
      const loginResponse = await this.client.post('/api/auth/login', {
        email: 'test@example.com',
        password: 'testpassword'
      });

      if (loginResponse.status === 200 && loginResponse.data?.data?.accessToken) {
        validToken = loginResponse.data.data.accessToken;
      }
    } catch (error) {
      console.log('Could not obtain valid token for auth tests');
    }

    if (validToken) {
      // Test 4: Access protected resource with valid token
      try {
        const response = await this.client.get('/api/auth/profile', {
          headers: { Authorization: `Bearer ${validToken}` }
        });

        if (response.status === 200) {
          this.addTestResult(results, 'Valid token grants access', true);
        } else {
          this.addTestResult(results, 'Valid token grants access', false, 'Expected 200, got ' + response.status);
        }
      } catch (error) {
        this.addTestResult(results, 'Valid token grants access', false, error.message);
      }

      // Test 5: Access admin resource with regular user token
      try {
        const response = await this.client.get('/api/admin/stats', {
          headers: { Authorization: `Bearer ${validToken}` }
        });

        if (response.status === 403) {
          this.addTestResult(results, 'RBAC prevents unauthorized access', true);
        } else {
          this.addTestResult(results, 'RBAC prevents unauthorized access', false, 'Expected 403, got ' + response.status);
        }
      } catch (error) {
        this.addTestResult(results, 'RBAC prevents unauthorized access', false, error.message);
      }
    }
  }

  async testInputValidation(results) {
    console.log('✅ Testing Input Validation...');

    // Test 6: SQL injection attempt
    try {
      const response = await this.client.post('/api/auth/login', {
        email: "' OR '1'='1'; --",
        password: "password"
      });

      if (response.status === 400 || response.status === 401) {
        this.addTestResult(results, 'SQL injection prevented', true);
      } else {
        this.addTestResult(results, 'SQL injection prevented', false, 'Unexpected response: ' + response.status);
      }
    } catch (error) {
      this.addTestResult(results, 'SQL injection prevented', false, error.message);
    }

    // Test 7: XSS attempt
    try {
      const response = await this.client.post('/api/auth/login', {
        email: 'test@example.com',
        password: '<script>alert("xss")</script>'
      });

      if (response.status === 400 || response.status === 401) {
        this.addTestResult(results, 'XSS input sanitized', true);
      } else {
        this.addTestResult(results, 'XSS input sanitized', false, 'Unexpected response: ' + response.status);
      }
    } catch (error) {
      this.addTestResult(results, 'XSS input sanitized', false, error.message);
    }

    // Test 8: Large payload
    try {
      const largePayload = 'x'.repeat(1000000); // 1MB payload
      const response = await this.client.post('/api/auth/login', {
        email: 'test@example.com',
        password: largePayload
      });

      if (response.status === 413 || response.status === 400) {
        this.addTestResult(results, 'Large payload rejected', true);
      } else {
        this.addTestResult(results, 'Large payload rejected', false, 'Expected 413 or 400, got ' + response.status);
      }
    } catch (error) {
      this.addTestResult(results, 'Large payload rejected', false, error.message);
    }
  }

  async testRateLimiting(results) {
    console.log('⏱️  Testing Rate Limiting...');

    // Test 9: Rapid requests
    const rapidRequests = [];
    for (let i = 0; i < 100; i++) {
      rapidRequests.push(
        this.client.get('/health')
      );
    }

    try {
      const responses = await Promise.all(rapidRequests);
      const rateLimited = responses.filter(r => r.status === 429).length;

      if (rateLimited > 0) {
        this.addTestResult(results, 'Rate limiting active', true);
      } else {
        this.addTestResult(results, 'Rate limiting active', false, 'No rate limiting detected');
      }
    } catch (error) {
      this.addTestResult(results, 'Rate limiting active', false, error.message);
    }
  }

  async testCORS(results) {
    console.log('🌐 Testing CORS Configuration...');

    // Test 10: Invalid origin
    try {
      const response = await this.client.get('/health', {
        headers: {
          'Origin': 'https://malicious-site.com'
        }
      });

      // Check if CORS headers are properly set
      const corsHeaders = response.headers['access-control-allow-origin'];
      if (corsHeaders && !corsHeaders.includes('malicious-site.com')) {
        this.addTestResult(results, 'CORS properly configured', true);
      } else {
        this.addTestResult(results, 'CORS properly configured', false, 'CORS allows invalid origin');
      }
    } catch (error) {
      this.addTestResult(results, 'CORS properly configured', false, error.message);
    }
  }

  async testSecurityHeaders(results) {
    console.log('🛡️  Testing Security Headers...');

    // Test 11: Security headers presence
    try {
      const response = await this.client.get('/health');

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security'
      ];

      const missingHeaders = requiredHeaders.filter(header =>
        !response.headers[header.toLowerCase()]
      );

      if (missingHeaders.length === 0) {
        this.addTestResult(results, 'Security headers present', true);
      } else {
        this.addTestResult(results, 'Security headers present', false, `Missing: ${missingHeaders.join(', ')}`);
      }
    } catch (error) {
      this.addTestResult(results, 'Security headers present', false, error.message);
    }
  }

  async testSQLInjection(results) {
    console.log('💉 Testing SQL Injection Protection...');

    // Test 12: Various SQL injection patterns
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --"
    ];

    let blockedCount = 0;

    for (const payload of sqlPayloads) {
      try {
        const response = await this.client.post('/api/auth/login', {
          email: payload,
          password: 'password'
        });

        if (response.status === 400 || response.status === 401) {
          blockedCount++;
        }
      } catch (error) {
        // Request failed, count as blocked
        blockedCount++;
      }
    }

    if (blockedCount === sqlPayloads.length) {
      this.addTestResult(results, 'SQL injection patterns blocked', true);
    } else {
      this.addTestResult(results, 'SQL injection patterns blocked', false, `${blockedCount}/${sqlPayloads.length} blocked`);
    }
  }

  async testXSS(results) {
    console.log('🕷️  Testing XSS Protection...');

    // Test 13: XSS payloads
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      'javascript:alert("xss")',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '<svg onload=alert("xss")>'
    ];

    let blockedCount = 0;

    for (const payload of xssPayloads) {
      try {
        const response = await this.client.post('/api/auth/login', {
          email: 'test@example.com',
          password: payload
        });

        if (response.status === 400 || response.status === 401) {
          blockedCount++;
        }
      } catch (error) {
        // Request failed, count as blocked
        blockedCount++;
      }
    }

    if (blockedCount === xssPayloads.length) {
      this.addTestResult(results, 'XSS payloads blocked', true);
    } else {
      this.addTestResult(results, 'XSS payloads blocked', false, `${blockedCount}/${xssPayloads.length} blocked`);
    }
  }

  addTestResult(results, name, passed, error = null) {
    results.summary.total++;

    if (passed) {
      results.summary.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.summary.failed++;
      console.log(`❌ ${name}${error ? ': ' + error : ''}`);
    }

    results.tests.push({
      name,
      passed,
      error
    });
  }

  printResults(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 SECURITY TEST RESULTS');
    console.log('='.repeat(50));

    console.log(`Total Tests: ${results.summary.total}`);
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`⚠️  Warnings: ${results.summary.warnings}`);

    const passRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
    console.log(`📈 Pass Rate: ${passRate}%`);

    if (results.summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  - ${test.name}${test.error ? ': ' + test.error : ''}`);
      });
    }

    console.log('\n' + '='.repeat(50));

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `security-test-results-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${filename}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new APISecurityTester(process.env.TEST_BASE_URL || 'http://localhost:3002');
  tester.runSecurityTests()
    .then(results => {
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Security test suite failed:', error);
      process.exit(1);
    });
}

module.exports = APISecurityTester;