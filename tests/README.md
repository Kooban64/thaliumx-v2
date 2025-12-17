# Comprehensive Test Suite

This directory contains a comprehensive test suite for the ThaliumX platform covering both backend API testing and frontend E2E testing.

## Test Structure

```
tests/
├── comprehensive/          # API and integration tests
│   ├── api-comprehensive.test.ts    # All API endpoints
│   ├── role-based-access.test.ts    # RBAC tests
│   ├── integration-flows.test.ts    # Complete user flows
│   ├── playwright-integration.ts    # Playwright integration
│   └── test-runner.ts               # Test orchestrator
├── types/
│   └── test-results.ts              # Type definitions
├── run-comprehensive-tests.sh       # Run API tests only
└── run-all-tests.sh                 # Run all tests (API + Playwright)
```

## Quick Start

### Run All Tests (Recommended)

```bash
# Run both API and Playwright E2E tests
./tests/run-all-tests.sh
```

### Run API Tests Only

```bash
# Run comprehensive API tests
./tests/run-comprehensive-tests.sh

# Or manually
cd tests/comprehensive
npm install
npm test
```

### Run Playwright E2E Tests Only

```bash
cd docker/frontend
npm install
npx playwright install
npm run test:e2e
```

## Test Coverage

### API Tests (`tests/comprehensive/`)

- ✅ Infrastructure (health checks, API docs)
- ✅ Authentication (login, registration, token refresh)
- ✅ User Management
- ✅ Trading & Exchange (orders, orderbook)
- ✅ Wallet System
- ✅ Fiat Operations
- ✅ Margin Trading
- ✅ Advanced Margin
- ✅ DEX Operations
- ✅ NFT Operations
- ✅ KYC Operations
- ✅ Token Sales
- ✅ Presale Operations
- ✅ RBAC Operations
- ✅ Admin Operations
- ✅ Broker Operations
- ✅ Smart Contracts
- ✅ Ledger Operations
- ✅ Native CEX
- ✅ Market Data

### Playwright E2E Tests (`docker/frontend/e2e/`)

- ✅ Platform Admin Dashboard
- ✅ Broker Admin Dashboard
- ✅ Trading Features (UI)
- ✅ Wallet Features (UI)
- ✅ Portfolio Features
- ✅ KYC Features (UI)
- ✅ Token Presale (UI)
- ✅ Role-Based Access Control (UI)
- ✅ Navigation and UI
- ✅ Responsive Design
- ✅ Error Handling

## Test Reports

After running tests, reports are generated:

### API Tests
- **HTML Report:** `test-reports/latest-report.html`
- **JSON Report:** `test-reports/latest-report.json`

### Playwright Tests
- **HTML Report:** `docker/frontend/playwright-report/index.html`
- **JSON Report:** `docker/frontend/test-results/results.json`
- **JUnit Report:** `docker/frontend/test-results/results.xml`

## Environment Variables

```bash
# API Tests
export API_URL=http://localhost:3002
export NODE_ENV=test

# Playwright Tests
export NEXT_PUBLIC_API_URL=http://localhost:3002
export NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Test User Credentials

The tests use these test users (must be seeded in database):

- `admin@thaliumx.com` / `AdminPass123!` - Platform Admin
- `broker@thaliumx.com` / `BrokerPass123!` - Broker Admin
- `trader@thaliumx.com` / `TraderPass123!` - Trader
- `user@thaliumx.com` / `UserPass123!` - Regular User

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Comprehensive Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Start services
        run: |
          docker compose up -d
          sleep 30
      
      - name: Run all tests
        run: ./tests/run-all-tests.sh
        env:
          API_URL: http://localhost:3002
          FRONTEND_URL: http://localhost:3001
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: |
            test-reports/
            docker/frontend/playwright-report/
```

## Troubleshooting

### API Tests Failing

1. **Check backend is running:**
   ```bash
   curl http://localhost:3002/health
   ```

2. **Check test users exist:**
   ```bash
   # Verify users are seeded
   docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "SELECT email FROM users;"
   ```

3. **Check rate limiting:**
   - Tests may fail if rate limiting is too aggressive
   - Consider disabling rate limiting in test environment

### Playwright Tests Failing

1. **Check frontend is running:**
   ```bash
   curl http://localhost:3001
   ```

2. **Install Playwright browsers:**
   ```bash
   cd docker/frontend
   npx playwright install
   ```

3. **Run with visible browser (debugging):**
   ```bash
   cd docker/frontend
   npm run test:e2e:headed
   ```

## Best Practices

1. **Run tests before committing:**
   ```bash
   ./tests/run-all-tests.sh
   ```

2. **Run specific test suites during development:**
   ```bash
   # API tests only
   cd tests/comprehensive && npm test
   
   # Playwright tests only
   cd docker/frontend && npm run test:e2e
   ```

3. **Use Playwright UI mode for debugging:**
   ```bash
   cd docker/frontend
   npm run test:e2e:ui
   ```

4. **Check reports after test runs:**
   - Always review HTML reports for detailed results
   - Check JSON reports for CI/CD integration

## Contributing

When adding new features:

1. **Add API tests** to `tests/comprehensive/api-comprehensive.test.ts`
2. **Add RBAC tests** if feature has role-based access
3. **Add Playwright tests** to `docker/frontend/e2e/comprehensive-platform.spec.ts`
4. **Update this README** with new features tested

## Notes

- Tests are designed for **testnet environment** - no real transactions
- Some tests may fail if services aren't fully configured
- Rate limiting may affect test execution
- Playwright tests require frontend to be running

---

**Test Suite Version:** 1.0.0  
**Last Updated:** December 15, 2025

