/**
 * Playwright Test Integration
 * Runs Playwright E2E tests and integrates results with comprehensive test suite
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { TestResult, TestCategory } from '../types/test-results';

const execAsync = promisify(exec);

interface PlaywrightTestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
}

class PlaywrightIntegration {
  private results: TestResult[] = [];
  private frontendDir: string;

  constructor() {
    this.frontendDir = path.join(__dirname, '../../docker/frontend');
  }

  private recordResult(
    category: TestCategory,
    feature: string,
    testName: string,
    passed: boolean,
    details: string,
    error?: string
  ): void {
    this.results.push({
      category: 'trading' as TestCategory, // Default category
      feature,
      testName,
      passed,
      details,
      error,
      timestamp: new Date().toISOString()
    });
  }

  async runPlaywrightTests(): Promise<TestResult[]> {
    console.log('🎭 Running Playwright E2E Tests...\n');

    try {
      // Check if Playwright is installed
      const playwrightInstalled = fs.existsSync(
        path.join(this.frontendDir, 'node_modules/@playwright/test')
      );

      if (!playwrightInstalled) {
        console.log('📦 Installing Playwright...');
        await execAsync('npm install', { cwd: this.frontendDir });
        await execAsync('npx playwright install', { cwd: this.frontendDir });
      }

      // Run Playwright tests
      console.log('🧪 Executing Playwright tests...');
      const { stdout, stderr } = await execAsync(
        'npx playwright test --reporter=json',
        { 
          cwd: this.frontendDir,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      // Parse results
      const resultsFile = path.join(this.frontendDir, 'test-results/results.json');
      if (fs.existsSync(resultsFile)) {
        const resultsData = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
        this.parsePlaywrightResults(resultsData);
      } else {
        // Try to parse from stdout
        this.parsePlaywrightOutput(stdout, stderr);
      }

      console.log('✅ Playwright tests completed!\n');
    } catch (error: any) {
      console.error('❌ Playwright test execution failed:', error.message);
      this.recordResult(
        'error' as TestCategory,
        'Playwright',
        'Test Execution',
        false,
        'Failed to run Playwright tests',
        error.message
      );
    }

    return this.results;
  }

  private parsePlaywrightResults(resultsData: any): void {
    if (resultsData.suites) {
      for (const suite of resultsData.suites) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            if (spec.tests) {
              for (const test of spec.tests) {
                const passed = test.results?.some((r: any) => r.status === 'passed') || false;
                const error = test.results?.find((r: any) => r.error)?.error?.message;
                
                this.recordResult(
                  this.categorizeTest(spec.title),
                  suite.title || 'E2E',
                  test.title,
                  passed,
                  `Status: ${test.results?.[0]?.status || 'unknown'}`,
                  error
                );
              }
            }
          }
        }
      }
    }
  }

  private parsePlaywrightOutput(stdout: string, stderr: string): void {
    // Parse test output for basic results
    const lines = stdout.split('\n');
    let currentSuite = 'E2E';
    
    for (const line of lines) {
      if (line.includes('Running') || line.includes('✓') || line.includes('×')) {
        const passed = line.includes('✓');
        const testName = line.replace(/[✓×]/g, '').trim();
        
        if (testName) {
          this.recordResult(
            this.categorizeTest(testName),
            currentSuite,
            testName,
            passed,
            passed ? 'Test passed' : 'Test failed'
          );
        }
      }
      
      if (line.includes('describe')) {
        currentSuite = line.match(/describe\s+['"](.*)['"]/)?.[1] || 'E2E';
      }
    }
  }

  private categorizeTest(testName: string): TestCategory {
    const name = testName.toLowerCase();
    
    if (name.includes('admin')) return 'admin';
    if (name.includes('broker')) return 'broker';
    if (name.includes('auth') || name.includes('login')) return 'authentication';
    if (name.includes('trading') || name.includes('order')) return 'trading';
    if (name.includes('wallet')) return 'wallet';
    if (name.includes('kyc')) return 'kyc';
    if (name.includes('presale') || name.includes('token sale')) return 'token-sale';
    if (name.includes('portfolio')) return 'trading';
    if (name.includes('rbac') || name.includes('role')) return 'rbac';
    
    return 'trading';
  }
}

export default PlaywrightIntegration;

