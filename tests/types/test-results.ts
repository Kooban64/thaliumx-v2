/**
 * Test Result Types
 */

export type TestCategory = 
  | 'infrastructure'
  | 'authentication'
  | 'user-management'
  | 'trading'
  | 'wallet'
  | 'fiat'
  | 'margin'
  | 'advanced-margin'
  | 'dex'
  | 'nft'
  | 'kyc'
  | 'token-sale'
  | 'presale'
  | 'rbac'
  | 'admin'
  | 'broker'
  | 'smart-contracts'
  | 'ledger'
  | 'native-cex'
  | 'market-data'
  | 'security'
  | 'compliance'
  | 'error';

export interface TestResult {
  category: TestCategory;
  feature: string;
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
  response?: string;
  timestamp: string;
}

export interface TestSuite {
  name: string;
  category: TestCategory;
  tests: TestResult[];
  passed: number;
  failed: number;
  total: number;
}

export interface TestReport {
  timestamp: string;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  suites: TestSuite[];
  summary: {
    byCategory: Record<TestCategory, { passed: number; failed: number; total: number }>;
    byFeature: Record<string, { passed: number; failed: number; total: number }>;
  };
}

