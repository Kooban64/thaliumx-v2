/**
 * Comprehensive Test Runner
 * Runs all test suites and generates detailed reports
 */

import ComprehensiveAPITester from './api-comprehensive.test';
import RoleBasedAccessTester from './role-based-access.test';
import IntegrationFlowTester from './integration-flows.test';
import PlaywrightIntegration from './playwright-integration';
import { TestResult, TestSuite, TestReport, TestCategory } from '../types/test-results';
import * as fs from 'fs';
import * as path from 'path';

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<TestReport> {
    this.startTime = Date.now();
    console.log('='.repeat(80));
    console.log('🚀 THALIUMX COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(80));
    console.log(`\n⏰ Started at: ${new Date().toISOString()}\n`);

    // Run API comprehensive tests
    console.log('📦 Running Comprehensive API Tests...');
    const apiTester = new ComprehensiveAPITester();
    const apiResults = await apiTester.runAllTests();
    this.results.push(...apiResults);

    // Run RBAC tests
    console.log('🔐 Running Role-Based Access Control Tests...');
    const rbacTester = new RoleBasedAccessTester();
    const rbacResults = await rbacTester.runAllTests();
    this.results.push(...rbacResults);

    // Run integration flow tests
    console.log('🔄 Running Integration Flow Tests...');
    const integrationTester = new IntegrationFlowTester();
    const integrationResults = await integrationTester.runAllTests();
    this.results.push(...integrationResults);

    // Run Playwright E2E tests
    console.log('🎭 Running Playwright E2E Tests...');
    const playwrightIntegration = new PlaywrightIntegration();
    const playwrightResults = await playwrightIntegration.runPlaywrightTests();
    this.results.push(...playwrightResults);

    const duration = Date.now() - this.startTime;
    const report = this.generateReport(duration);

    // Save report
    await this.saveReport(report);

    return report;
  }

  private generateReport(duration: number): TestReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    // Group by category
    const byCategory: Record<TestCategory, { passed: number; failed: number; total: number }> = {} as any;
    const byFeature: Record<string, { passed: number; failed: number; total: number }> = {};

    for (const result of this.results) {
      // Category stats
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) {
        byCategory[result.category].passed++;
      } else {
        byCategory[result.category].failed++;
      }

      // Feature stats
      if (!byFeature[result.feature]) {
        byFeature[result.feature] = { passed: 0, failed: 0, total: 0 };
      }
      byFeature[result.feature].total++;
      if (result.passed) {
        byFeature[result.feature].passed++;
      } else {
        byFeature[result.feature].failed++;
      }
    }

    // Group into suites
    const suites: TestSuite[] = [];
    const categoryMap = new Map<TestCategory, TestResult[]>();

    for (const result of this.results) {
      if (!categoryMap.has(result.category)) {
        categoryMap.set(result.category, []);
      }
      categoryMap.get(result.category)!.push(result);
    }

    for (const [category, tests] of categoryMap.entries()) {
      const passed = tests.filter(t => t.passed).length;
      const failed = tests.filter(t => !t.passed).length;
      suites.push({
        name: this.formatCategoryName(category),
        category,
        tests,
        passed,
        failed,
        total: tests.length
      });
    }

    return {
      timestamp: new Date().toISOString(),
      duration,
      totalTests,
      passedTests,
      failedTests,
      suites,
      summary: {
        byCategory,
        byFeature
      }
    };
  }

  private formatCategoryName(category: TestCategory): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async saveReport(report: TestReport): Promise<void> {
    const reportsDir = path.join(__dirname, '../../test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(reportsDir, `test-report-${timestamp}.json`);
    const htmlPath = path.join(reportsDir, `test-report-${timestamp}.html`);

    // Save JSON report
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 JSON Report saved to: ${jsonPath}`);

    // Generate and save HTML report
    const html = this.generateHTMLReport(report);
    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML Report saved to: ${htmlPath}`);

    // Also save as latest
    fs.writeFileSync(path.join(reportsDir, 'latest-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(reportsDir, 'latest-report.html'), html);
    console.log(`📄 Latest reports saved to: ${path.join(reportsDir, 'latest-report.*')}`);
  }

  private generateHTMLReport(report: TestReport): string {
    const passRate = report.totalTests > 0 ? ((report.passedTests / report.totalTests) * 100).toFixed(2) : '0';
    const durationSeconds = (report.duration / 1000).toFixed(2);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ThaliumX Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 0.9em; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-card h3 { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .summary-card .value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-card.total .value { color: #667eea; }
        .summary-card.passed .value { color: #10b981; }
        .summary-card.failed .value { color: #ef4444; }
        .summary-card.rate .value { color: #f59e0b; }
        .suite {
            background: white;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .suite-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        .suite-header h2 { color: #333; font-size: 1.5em; }
        .suite-stats {
            display: flex;
            gap: 15px;
        }
        .stat {
            padding: 8px 15px;
            border-radius: 5px;
            font-weight: bold;
            font-size: 0.9em;
        }
        .stat.total { background: #e0e7ff; color: #667eea; }
        .stat.passed { background: #d1fae5; color: #10b981; }
        .stat.failed { background: #fee2e2; color: #ef4444; }
        .test {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            border-left: 4px solid;
        }
        .test.passed {
            background: #f0fdf4;
            border-color: #10b981;
        }
        .test.failed {
            background: #fef2f2;
            border-color: #ef4444;
        }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .test-name {
            font-weight: bold;
            color: #333;
        }
        .test-status {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .test-status.passed {
            background: #10b981;
            color: white;
        }
        .test-status.failed {
            background: #ef4444;
            color: white;
        }
        .test-details {
            color: #666;
            font-size: 0.9em;
            margin-top: 8px;
        }
        .test-error {
            background: #fee2e2;
            padding: 10px;
            border-radius: 5px;
            margin-top: 8px;
            color: #991b1b;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
        }
        .category-summary {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .category-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .category-card h3 {
            font-size: 1.1em;
            margin-bottom: 10px;
            color: #333;
        }
        .category-stats {
            display: flex;
            gap: 10px;
        }
        .category-stat {
            flex: 1;
            text-align: center;
            padding: 8px;
            border-radius: 5px;
        }
        .category-stat.passed { background: #d1fae5; color: #10b981; }
        .category-stat.failed { background: #fee2e2; color: #ef4444; }
        .category-stat.total { background: #e0e7ff; color: #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 ThaliumX Test Report</h1>
            <div class="meta">
                <div>Generated: ${new Date(report.timestamp).toLocaleString()}</div>
                <div>Duration: ${durationSeconds}s</div>
            </div>
        </div>

        <div class="summary">
            <div class="summary-card total">
                <h3>Total Tests</h3>
                <div class="value">${report.totalTests}</div>
            </div>
            <div class="summary-card passed">
                <h3>Passed</h3>
                <div class="value">${report.passedTests}</div>
            </div>
            <div class="summary-card failed">
                <h3>Failed</h3>
                <div class="value">${report.failedTests}</div>
            </div>
            <div class="summary-card rate">
                <h3>Pass Rate</h3>
                <div class="value">${passRate}%</div>
            </div>
        </div>

        <h2 style="margin-bottom: 20px; color: #333;">📊 Summary by Category</h2>
        <div class="category-summary">
`;

    // Category summary
    for (const [category, stats] of Object.entries(report.summary.byCategory)) {
      const categoryPassRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
      html += `
            <div class="category-card">
                <h3>${this.formatCategoryName(category as TestCategory)}</h3>
                <div class="category-stats">
                    <div class="category-stat total">Total: ${stats.total}</div>
                    <div class="category-stat passed">✓ ${stats.passed}</div>
                    <div class="category-stat failed">✗ ${stats.failed}</div>
                </div>
                <div style="margin-top: 8px; text-align: center; color: #666; font-size: 0.9em;">
                    ${categoryPassRate}% pass rate
                </div>
            </div>
`;
    }

    html += `
        </div>

        <h2 style="margin-bottom: 20px; color: #333;">📋 Detailed Test Results</h2>
`;

    // Test suites
    for (const suite of report.suites) {
      const suitePassRate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : '0';
      html += `
        <div class="suite">
            <div class="suite-header">
                <h2>${suite.name}</h2>
                <div class="suite-stats">
                    <div class="stat total">Total: ${suite.total}</div>
                    <div class="stat passed">Passed: ${suite.passed}</div>
                    <div class="stat failed">Failed: ${suite.failed}</div>
                    <div class="stat" style="background: #fef3c7; color: #f59e0b;">Rate: ${suitePassRate}%</div>
                </div>
            </div>
`;

      for (const test of suite.tests) {
        html += `
            <div class="test ${test.passed ? 'passed' : 'failed'}">
                <div class="test-header">
                    <div class="test-name">${test.testName}</div>
                    <div class="test-status ${test.passed ? 'passed' : 'failed'}">
                        ${test.passed ? '✓ PASSED' : '✗ FAILED'}
                    </div>
                </div>
                <div class="test-details">
                    <strong>Feature:</strong> ${test.feature}<br>
                    <strong>Details:</strong> ${test.details}<br>
                    <strong>Time:</strong> ${new Date(test.timestamp).toLocaleString()}
                </div>
`;

        if (test.error) {
          html += `
                <div class="test-error">
                    <strong>Error:</strong> ${test.error}
                </div>
`;
        }

        if (test.response && !test.passed) {
          html += `
                <div class="test-details" style="margin-top: 8px;">
                    <strong>Response:</strong> <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; overflow-x: auto;">${test.response}</pre>
                </div>
`;
        }

        html += `
            </div>
`;
      }

      html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.passedTests}`);
    console.log(`❌ Failed: ${report.failedTests}`);
    console.log(`📈 Pass Rate: ${report.totalTests > 0 ? ((report.passedTests / report.totalTests) * 100).toFixed(2) : 0}%`);
    console.log(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`);

    console.log('\n' + '-'.repeat(80));
    console.log('📋 BY CATEGORY');
    console.log('-'.repeat(80));

    for (const [category, stats] of Object.entries(report.summary.byCategory)) {
      const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
      console.log(`\n${this.formatCategoryName(category as TestCategory)}:`);
      console.log(`  Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Rate: ${passRate}%`);
    }

    console.log('\n' + '-'.repeat(80));
    console.log('❌ FAILED TESTS');
    console.log('-'.repeat(80));

    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length === 0) {
      console.log('\n🎉 No failed tests!');
    } else {
      for (const test of failedTests) {
        console.log(`\n❌ ${test.feature} - ${test.testName}`);
        console.log(`   Details: ${test.details}`);
        if (test.error) {
          console.log(`   Error: ${test.error}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests()
    .then(report => {
      runner.printSummary(report);
      process.exit(report.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export default TestRunner;

