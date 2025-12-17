# Comprehensive Test Suite

This directory contains a comprehensive test suite for the ThaliumX platform that tests every feature and role-based access control.

## Overview

The test suite includes:

1. **API Comprehensive Tests** - Tests all API endpoints across all features
2. **Role-Based Access Control Tests** - Verifies that each role can only access appropriate endpoints
3. **Integration Flow Tests** - Tests complete user workflows end-to-end

## Features Tested

### Infrastructure
- Health checks
- API documentation
- Service availability

### Authentication
- User login (all roles)
- User registration
- Token refresh
- Invalid credentials handling

### User Management
- Get all users
- Get user by ID
- Update user profile

### Trading & Exchange
- Orderbook retrieval
- Market orders
- Limit orders
- Order cancellation
- Order status

### Wallet System
- Wallet creation
- Balance retrieval
- Multi-currency support

### Fiat Operations
- Fiat deposits
- Fiat withdrawals
- Wallet management

### Margin Trading
- Margin account creation
- Margin positions
- Margin orders
- Advanced margin features

### DEX Operations
- DEX quotes
- DEX pools
- Liquidity management

### NFT Operations
- NFT collections
- NFT activity
- NFT marketplace

### KYC Operations
- KYC status
- Document upload
- KYC verification

### Token Sales
- Token sale stats
- Investment creation

### Presale Operations
- Presale info
- Presale participation

### RBAC Operations
- Role management
- Permission checking
- User role assignment

### Admin Operations
- Admin dashboard
- Admin stats
- User management

### Broker Operations
- Broker dashboard
- Broker management

### Smart Contracts
- Token info
- Contract interaction

### Ledger Operations
- Account balances
- Fund transfers

### Native CEX
- Trading pairs
- Exchange operations

### Market Data
- Real-time market data
- Price feeds

## Roles Tested

- **Platform Admin** - Full platform access
- **Broker Admin** - Broker-specific access
- **Compliance Officer** - Compliance and KYC access
- **Finance Officer** - Financial operations access
- **Trader** - Trading operations
- **Regular User** - Basic user access

## Running Tests

### Prerequisites

1. Ensure the backend API is running at `http://localhost:3002` (or set `API_URL` environment variable)
2. Ensure test users are seeded in the database

### Quick Start

```bash
# Run all tests
./tests/run-comprehensive-tests.sh

# Or run directly
cd tests/comprehensive
npm install
npm test
```

### Environment Variables

- `API_URL` - Backend API URL (default: `http://localhost:3002`)
- `NODE_ENV` - Environment (default: `test`)

## Test Reports

After running tests, detailed reports are generated in `test-reports/`:

- `latest-report.html` - HTML report with visual results
- `latest-report.json` - JSON report with all test data
- `test-report-{timestamp}.html` - Timestamped HTML reports
- `test-report-{timestamp}.json` - Timestamped JSON reports

## Report Structure

The test report includes:

1. **Summary** - Total tests, passed, failed, pass rate
2. **By Category** - Breakdown by feature category
3. **By Feature** - Breakdown by specific feature
4. **Detailed Results** - Full test results with:
   - Test name
   - Status (passed/failed)
   - Details
   - Error messages (if failed)
   - Response data (if available)

## Test User Credentials

The tests use the following test users (must be seeded in database):

- `admin@thaliumx.com` / `AdminPass123!` - Platform Admin
- `broker@thaliumx.com` / `BrokerPass123!` - Broker Admin
- `compliance@thaliumx.com` / `CompliancePass123!` - Compliance Officer
- `finance@thaliumx.com` / `FinancePass123!` - Finance Officer
- `trader@thaliumx.com` / `TraderPass123!` - Trader
- `user@thaliumx.com` / `UserPass123!` - Regular User

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Comprehensive Tests
  run: |
    ./tests/run-comprehensive-tests.sh
  env:
    API_URL: ${{ secrets.API_URL }}
```

## Notes

- Tests are designed for **testnet environment** - no real transactions are executed
- Some tests may fail if services are not fully configured (e.g., KYC provider, payment gateways)
- Tests verify API responses but don't validate business logic correctness
- Failed tests indicate potential issues but may also be due to missing configuration

## Troubleshooting

### Tests failing with connection errors
- Ensure backend API is running
- Check `API_URL` environment variable
- Verify network connectivity

### Authentication failures
- Ensure test users are seeded in database
- Check user credentials match expected values
- Verify Keycloak/authentication service is running

### Permission denied errors
- Verify RBAC configuration is correct
- Check user roles are properly assigned
- Ensure test users have appropriate permissions

## Contributing

When adding new features:

1. Add corresponding tests to `api-comprehensive.test.ts`
2. Add RBAC tests if the feature has role-based access
3. Add integration flow tests if the feature is part of a user workflow
4. Update this README with new features tested

