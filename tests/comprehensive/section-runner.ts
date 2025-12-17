/**
 * Section-Based Test Runner
 * Runs tests in smaller sections to avoid timeouts
 */

import ComprehensiveAPITester from './api-comprehensive.test';
import RoleBasedAccessTester from './role-based-access.test';
import IntegrationFlowTester from './integration-flows.test';
import { TestResult, TestReport, TestCategory } from '../types/test-results';
import * as fs from 'fs';
import * as path from 'path';

interface TestSection {
  name: string;
  description: string;
  run: () => Promise<TestResult[]>;
}

class SectionRunner {
  private results: TestResult[] = [];
  private sectionReports: Map<string, TestReport> = new Map();
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(__dirname, '../../test-reports/sections');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  private generateSectionReport(sectionName: string, results: TestResult[]): TestReport {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const byCategory: Record<TestCategory, { passed: number; failed: number; total: number }> = {} as any;
    const byFeature: Record<string, { passed: number; failed: number; total: number }> = {};

    for (const result of results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) {
        byCategory[result.category].passed++;
      } else {
        byCategory[result.category].failed++;
      }

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

    return {
      timestamp: new Date().toISOString(),
      duration: 0,
      totalTests,
      passedTests,
      failedTests,
      suites: [],
      summary: { byCategory, byFeature }
    };
  }

  private saveSectionReport(sectionName: string, report: TestReport, results: TestResult[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(this.reportsDir, `${sectionName}-${timestamp}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify({ report, results }, null, 2));
    console.log(`📄 Section report saved: ${jsonPath}`);
    
    // Also save as latest
    const latestPath = path.join(this.reportsDir, `${sectionName}-latest.json`);
    fs.writeFileSync(latestPath, JSON.stringify({ report, results }, null, 2));
  }

  private printSectionSummary(sectionName: string, report: TestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 SECTION SUMMARY: ${sectionName}`);
    console.log('='.repeat(80));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.passedTests}`);
    console.log(`❌ Failed: ${report.failedTests}`);
    console.log(`📈 Pass Rate: ${report.totalTests > 0 ? ((report.passedTests / report.totalTests) * 100).toFixed(2) : 0}%`);
    console.log('='.repeat(80) + '\n');
  }

  async runSection(section: TestSection): Promise<TestResult[]> {
    console.log('\n' + '='.repeat(80));
    console.log(`🚀 RUNNING SECTION: ${section.name}`);
    console.log(`📝 ${section.description}`);
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();
    let sectionResults: TestResult[] = [];

    try {
      sectionResults = await section.run();
      const duration = Date.now() - startTime;
      
      const report = this.generateSectionReport(section.name, sectionResults);
      report.duration = duration;
      this.sectionReports.set(section.name, report);
      
      this.saveSectionReport(section.name, report, sectionResults);
      this.printSectionSummary(section.name, report);
      
      this.results.push(...sectionResults);
      return sectionResults;
    } catch (error: any) {
      console.error(`❌ Section ${section.name} failed:`, error.message);
      const errorResult: TestResult = {
        category: 'error' as TestCategory,
        feature: section.name,
        testName: 'Section Execution',
        passed: false,
        details: 'Section execution failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      sectionResults.push(errorResult);
      this.results.push(errorResult);
      return sectionResults;
    }
  }

  generateFinalReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const byCategory: Record<TestCategory, { passed: number; failed: number; total: number }> = {} as any;
    const byFeature: Record<string, { passed: number; failed: number; total: number }> = {};

    for (const result of this.results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) {
        byCategory[result.category].passed++;
      } else {
        byCategory[result.category].failed++;
      }
    }

    const finalReport = {
      timestamp: new Date().toISOString(),
      duration: 0,
      totalTests,
      passedTests,
      failedTests,
      sections: Array.from(this.sectionReports.entries()).map(([name, report]) => ({
        name,
        ...report
      })),
      summary: { byCategory, byFeature },
      results: this.results
    };

    const finalReportPath = path.join(this.reportsDir, '../final-report.json');
    fs.writeFileSync(finalReportPath, JSON.stringify(finalReport, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Pass Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0}%`);
    console.log(`📄 Final report: ${finalReportPath}`);
    console.log('='.repeat(80) + '\n');
  }
}

// Define test sections
export const TEST_SECTIONS: TestSection[] = [
  {
    name: 'Infrastructure',
    description: 'Health checks and API documentation',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testHealthEndpoints();
      return (tester as any).results;
    }
  },
  {
    name: 'Authentication',
    description: 'Login, registration, and token management',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testAuthentication();
      return (tester as any).results;
    }
  },
  {
    name: 'User Management',
    description: 'User CRUD operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testUserManagement();
      return (tester as any).results;
    }
  },
  {
    name: 'Trading & Exchange',
    description: 'Orderbook, orders, and trading operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testTradingFeatures();
      return (tester as any).results;
    }
  },
  {
    name: 'Wallet & Fiat',
    description: 'Wallet system and fiat operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testWalletSystem();
      await tester.testFiatOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'Margin Trading',
    description: 'Basic and advanced margin trading',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testMarginTrading();
      await tester.testAdvancedMargin();
      return (tester as any).results;
    }
  },
  {
    name: 'DEX & NFT',
    description: 'DEX operations and NFT marketplace',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testDEXOperations();
      await tester.testNFTOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'KYC & Compliance',
    description: 'KYC operations and compliance features',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testKYCOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'Token Sales',
    description: 'Token sales and presale operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testTokenSales();
      await tester.testPresaleOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'RBAC',
    description: 'Role-based access control',
    run: async () => {
      const tester = new RoleBasedAccessTester();
      await tester.runAllTests();
      return (tester as any).results;
    }
  },
  {
    name: 'Admin Operations',
    description: 'Admin dashboard and operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testAdminOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'Broker Operations',
    description: 'Broker dashboard and management',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testBrokerOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'Smart Contracts & Ledger',
    description: 'Smart contracts and ledger operations',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testSmartContracts();
      await tester.testLedgerOperations();
      return (tester as any).results;
    }
  },
  {
    name: 'Native CEX & Market Data',
    description: 'Native CEX and market data endpoints',
    run: async () => {
      const tester = new ComprehensiveAPITester();
      await tester.testNativeCEX();
      await tester.testMarketData();
      return (tester as any).results;
    }
  },
  {
    name: 'Integration Flows',
    description: 'Complete user workflow tests',
    run: async () => {
      const tester = new IntegrationFlowTester();
      await tester.runAllTests();
      return (tester as any).results;
    }
  }
];

// Run specific section if provided as argument
if (require.main === module) {
  const sectionRunner = new SectionRunner();
  const sectionName = process.argv[2];

  if (sectionName) {
    // Run specific section
    const section = TEST_SECTIONS.find(s => s.name.toLowerCase() === sectionName.toLowerCase());
    if (section) {
      sectionRunner.runSection(section).then(() => {
        process.exit(0);
      }).catch(error => {
        console.error('Failed:', error);
        process.exit(1);
      });
    } else {
      console.error(`Section "${sectionName}" not found. Available sections:`);
      TEST_SECTIONS.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }
  } else {
    // Run all sections sequentially
    (async () => {
      for (const section of TEST_SECTIONS) {
        await sectionRunner.runSection(section);
        // Small delay between sections
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      sectionRunner.generateFinalReport();
      process.exit(0);
    })().catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
  }
}

export default SectionRunner;

