# End-to-End Testing with Playwright

This directory contains comprehensive E2E tests for the ThaliumX platform using Playwright, the most advanced and reliable E2E testing framework available.

## Why Playwright?

Playwright was chosen over Cypress for several critical reasons:

### ✅ **Superior Browser Support**
- **Multi-browser testing**: Chromium, Firefox, WebKit (Safari), and mobile browsers
- **Cross-platform compatibility**: Windows, macOS, Linux
- **Mobile testing**: Native mobile browser testing with device emulation

### ✅ **Better Reliability for Complex Applications**
- **Network interception**: Mock API calls, simulate network conditions
- **Advanced waiting strategies**: Auto-waiting, manual controls
- **Stable element selection**: Multiple selector strategies
- **Better handling of SPAs**: Excellent support for React/Next.js applications

### ✅ **Enterprise-Grade Features**
- **Parallel test execution**: Run tests across multiple browsers simultaneously
- **Rich debugging tools**: Trace viewer, video recording, screenshots
- **CI/CD integration**: Native support for GitHub Actions, Jenkins, etc.
- **Test generation**: Auto-generate tests from user interactions

### ✅ **Performance & Speed**
- **Faster execution**: More efficient than Cypress for large test suites
- **Better resource usage**: Lower memory footprint
- **Parallelization**: Run tests in parallel across multiple workers

## Test Structure

```
e2e/
├── auth.spec.ts           # Authentication flow tests
├── trading.spec.ts        # Trading dashboard and order placement
├── token-presale.spec.ts  # Token presale purchase flow
├── global-setup.ts        # Test environment setup
├── global-teardown.ts     # Test cleanup
└── README.md             # This file
```

## Test Coverage

### 🔐 **Authentication Tests** (`auth.spec.ts`)
- User registration with validation
- Login/logout flow
- Password reset functionality
- Session management
- Route protection
- Input validation
- Security features

### 📈 **Trading Tests** (`trading.spec.ts`)
- Real market data display
- Order placement (market/limit, buy/sell)
- Wallet balance updates
- Real-time price feeds
- Mobile responsiveness
- Error handling
- Network failure simulation

### 🪙 **Token Presale Tests** (`token-presale.spec.ts`)
- Presale page display
- Real THAL token pricing
- Purchase calculations
- Payment method handling (USDT/Bank Transfer)
- Broker code integration
- Portfolio tracking
- Validation and error handling

## Running Tests

### Prerequisites

1. **Install dependencies**:
```bash
npm install
```

2. **Install Playwright browsers**:
```bash
npm run playwright:install
```

3. **Start the application**:
```bash
# Terminal 1: Start backend
cd docker/backend && npm run dev

# Terminal 2: Start frontend
npm run dev
```

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test auth.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium

# Run tests in parallel
npx playwright test --workers=4
```

### CI/CD Integration

Tests are configured for CI/CD with:
- **Parallel execution**: Multiple workers for faster runs
- **Retry logic**: Automatic retries on flaky tests
- **Artifacts**: Screenshots, videos, and traces on failure
- **Multiple reporters**: HTML, JSON, JUnit, GitHub Actions

## Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
export default defineConfig({
  // Test directory and patterns
  testDir: './e2e',
  fullyParallel: true,

  // Browser projects
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  // Web server auto-start
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://localhost:3000',
  },

  // Global setup/teardown
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
});
```

## Test Data Management

### Global Setup
- Creates test user accounts
- Seeds initial test data
- Verifies backend connectivity
- Prepares test environment

### Global Teardown
- Cleans up test users
- Removes test data
- Clears caches
- Resets application state

## Best Practices Implemented

### ✅ **Test Isolation**
- Each test runs in isolation
- Clean state between tests
- No test dependencies

### ✅ **Realistic Scenarios**
- Tests actual user journeys
- Uses real API endpoints
- Tests error conditions

### ✅ **Comprehensive Coverage**
- Happy path testing
- Error case testing
- Edge case validation
- Cross-browser testing

### ✅ **Maintainable Tests**
- Page Object Model (implicit)
- Reusable test utilities
- Clear test descriptions
- Proper assertions

## Debugging Tests

### Visual Debugging
```bash
# Run with browser visible
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui
```

### Trace Viewer
```bash
# View traces after test run
npx playwright show-trace test-results/traces/
```

### Screenshots & Videos
- **Screenshots**: Automatic on failure
- **Videos**: Recorded for failed tests
- **Traces**: Detailed execution traces

## Performance Testing

Playwright tests can be extended for performance testing:

```typescript
test('should load dashboard within 3 seconds', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('/dashboard');

  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000);
});
```

## Mobile Testing

Tests automatically run on mobile viewports:

```typescript
test('should work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  // Test mobile-specific functionality
});
```

## API Testing Integration

Tests can intercept and mock API calls:

```typescript
// Mock API responses
await page.route('**/api/market/**', route =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockData)
  })
);
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run playwright:install
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## Test Results & Reporting

### HTML Report
```bash
npx playwright show-report
```

### JSON Results
- `test-results/results.json` - Machine-readable results
- `test-results/results.xml` - JUnit format for CI

### Coverage Integration
Tests can be integrated with coverage tools like Istanbul.

## Troubleshooting

### Common Issues

1. **Tests timing out**:
   - Increase timeout in config
   - Check network conditions
   - Verify backend is running

2. **Flaky tests**:
   - Add proper waiting strategies
   - Use more specific selectors
   - Implement retry logic

3. **Browser compatibility**:
   - Test in headed mode first
   - Check for browser-specific issues
   - Use Playwright's device emulation

### Debug Commands

```bash
# Run single test with debug
npx playwright test --debug auth.spec.ts

# Run with slow motion
npx playwright test --slowMo=1000

# Generate code from user actions
npx playwright codegen http://localhost:3000
```

## Future Enhancements

### Planned Improvements
- **Visual regression testing** with screenshot comparison
- **Performance monitoring** integration
- **Load testing** capabilities
- **Accessibility testing** (a11y)
- **API contract testing**

### Advanced Features
- **Test data factories** for complex scenarios
- **Custom fixtures** for authenticated sessions
- **Parallel test execution** optimization
- **Test result analytics** and trends

## Conclusion

Playwright provides the most comprehensive and reliable E2E testing solution for ThaliumX, ensuring:

- **Production-ready quality** through thorough testing
- **Cross-browser compatibility** across all major browsers
- **Mobile responsiveness** validation
- **Performance monitoring** capabilities
- **CI/CD integration** for automated testing

The E2E test suite provides confidence in deploying ThaliumX to production with comprehensive coverage of critical user journeys and error scenarios.