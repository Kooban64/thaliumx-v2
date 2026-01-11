# Platform Features & Menu Structure Documentation

## 1. KYC Levels & Triggers

### KYC Level Definitions

**L0 - Web3 Basic**
- **Requirements**: Web3 wallet connection only
- **Documents**: None
- **Checks**: No sanctions/PEP/face verification
- **Limits**:
  - Max Investment: R185,000 (USD 10,000)
  - Max Trading: R0 (no trading allowed)
  - Max Withdrawal: R18,500 (USD 1,000)
  - Max Deposit: R185,000 (USD 10,000)
  - Max Daily Transactions: 5
- **Trigger**: Automatic on wallet connection
- **Upgrade Triggers**:
  - User attempts transaction exceeding L0 limits
  - User attempts trading (requires L1+)
  - User reaches 80% of L0 investment limit (warning)
  - User reaches 100% of L0 withdrawal limit (blocking)

**L1 - Basic Verification**
- **Requirements**: Email verified + Phone verified
- **Documents**: None
- **Checks**: Sanctions check only
- **Limits**:
  - Max Investment: R925,000 (USD 50,000)
  - Max Trading: R462,500 (USD 25,000)
  - Max Withdrawal: R92,500 (USD 5,000)
  - Max Deposit: R925,000 (USD 50,000)
  - Max Daily Transactions: 20
- **Triggers**:
  - User attempts transaction exceeding L0 limits
  - User attempts trading (requires L1+)
  - User reaches 80% of L0 investment limit (warning)
  - User reaches 100% of L0 withdrawal limit (blocking)

**L2 - Identity Verified**
- **Requirements**: Email + Phone + Government ID + Proof of Address + Biometric
- **Documents**: NATIONAL_ID, PROOF_OF_ADDRESS, BIOMETRIC_DATA
- **Checks**: Sanctions + PEP + Face verification + Ongoing monitoring
- **Limits**:
  - Max Investment: R4,625,000 (USD 250,000)
  - Max Trading: R1,850,000 (USD 100,000)
  - Max Withdrawal: R462,500 (USD 25,000)
  - Max Deposit: R4,625,000 (USD 250,000)
  - Max Daily Transactions: 50
- **Triggers**:
  - User attempts transaction exceeding L1 limits
  - User reaches 80% of L1 investment limit (warning)
  - User reaches 100% of L1 trading/withdrawal limit (blocking)
  - User requests advanced trading features

**L3 - Enhanced Verification**
- **Requirements**: All L2 + Source of Funds + Enhanced Screening
- **Documents**: PASSPORT, PROOF_OF_ADDRESS, PROOF_OF_INCOME, SOURCE_OF_FUNDS, BIOMETRIC_DATA
- **Checks**: Sanctions + PEP + Face verification + Ongoing monitoring
- **Limits**:
  - Max Investment: R18,500,000 (USD 1,000,000)
  - Max Trading: R9,250,000 (USD 500,000)
  - Max Withdrawal: R1,850,000 (USD 100,000)
  - Max Deposit: R18,500,000 (USD 1,000,000)
  - Max Daily Transactions: 100
- **Triggers**:
  - User attempts transaction exceeding L2 limits
  - User reaches 80% of L2 investment limit (warning)
  - User reaches 100% of L2 trading/withdrawal limit (blocking)
  - User requests institutional features
  - User requests high-value transactions

**INSTITUTIONAL - Institutional/KYB Verification**
- **Requirements**: Business registration + Incorporation documents + Ownership structure + Authorized signatories + Source of funds + Enhanced screening + Regulatory licenses
- **Documents**: BUSINESS_LICENSE, ARTICLES_OF_INCORPORATION, CERTIFICATE_OF_INCORPORATION, BANK_STATEMENT, PROOF_OF_ADDRESS
- **Checks**: Sanctions + PEP + Face verification + Ongoing monitoring
- **Limits**:
  - Max Investment: R185,000,000 (USD 10,000,000)
  - Max Trading: R92,500,000 (USD 5,000,000)
  - Max Withdrawal: R18,500,000 (USD 1,000,000)
  - Max Deposit: R185,000,000 (USD 10,000,000)
  - Max Daily Transactions: 500
- **Triggers**:
  - User attempts transaction exceeding L3 limits
  - Business entity registration
  - Request for institutional account
  - High-volume trading requirements

### KYC Upgrade Flow
1. **Warning Threshold (80%)**: User sees upgrade prompt, transaction still allowed
2. **Blocking Threshold (100%)**: Transaction blocked, upgrade workflow automatically triggered
3. **Manual Trigger**: User can initiate upgrade from account settings
4. **Workflow Integration**: Ballerine workflows handle document collection and verification

---

## 2. Features by Role

### Platform Roles

#### SUPER_ADMIN / ADMIN
**Full Platform Access**
- System Configuration
- User Management (all tenants)
- Broker Management
- Platform Settings
- System Health Monitoring
- Audit Logs Access
- RBAC Management
- Policy Management
- Workflow Management
- Compliance Oversight
- Financial Operations
- Security Oversight
- Analytics & Reporting

#### PLATFORM_COMPLIANCE
**Compliance & Regulatory**
- KYC/KYB Review & Approval
- Compliance Monitoring
- Audit Log Access
- Policy Enforcement
- Risk Assessment
- Regulatory Reporting
- SAR Filing
- Transaction Monitoring

#### PLATFORM_FINANCE
**Financial Operations**
- Multi-Tier Ledger Management
- Fund Reconciliation
- Treasury Management
- Financial Reporting
- Transaction Oversight
- Broker Financial Controls
- Billing & Invoicing

#### PLATFORM_OPERATIONS
**Platform Operations**
- System Monitoring
- Service Health Checks
- Workflow Management
- Event Streaming
- Log Analytics
- Support Operations

#### PLATFORM_SECURITY
**Security & Risk**
- Security Oversight
- Threat Detection
- Device Fingerprinting
- Security Policies
- Risk Assessment
- Incident Response

#### PLATFORM_SUPPORT
**Customer Support**
- User Support Tickets
- Account Assistance
- Transaction Support
- KYC Assistance
- General Inquiries

### Broker Roles

#### BROKER_ADMIN
**Full Broker Access**
- Broker Configuration
- User Management (broker-scoped)
- Broker Dashboard
- Broker Analytics
- Broker Settings
- White-Label Branding
- Feature Toggles
- Broker Financial Controls

#### BROKER_COMPLIANCE
**Broker Compliance**
- KYC Review (broker users)
- Compliance Monitoring
- Risk Assessment
- Transaction Monitoring
- Broker Audit Logs

#### BROKER_FINANCE
**Broker Finance**
- Broker Ledger Management
- Fund Reconciliation
- Financial Reporting
- Transaction Oversight

#### BROKER_OPERATIONS
**Broker Operations**
- Broker Monitoring
- Workflow Management
- Support Operations
- Broker Analytics

#### BROKER_TRADING
**Broker Trading**
- Trading Operations
- Order Management
- Market Data Access
- Trading Analytics

#### BROKER_SUPPORT
**Broker Support**
- Customer Support
- Account Assistance
- Transaction Support

### End User Roles

#### USER (Default)
**Standard User Features**
- Trading (CEX & DEX)
- Wallet Management (Web3 & Hot Wallets)
- Portfolio Management
- Market Data
- KYC Submission
- Account Settings
- Transaction History
- Deposit/Withdrawal
- Presale Participation
- NFT Marketplace
- Staking
- Token Management

#### USER_TRADER
**Enhanced Trading**
- All USER features
- Advanced Trading Tools
- Margin Trading
- Advanced Order Types
- Trading Analytics
- Risk Management Tools

#### USER_ANALYST
**Analytics & Research**
- All USER features
- Advanced Analytics
- Market Research Tools
- Portfolio Analytics
- Reporting Tools

#### USER_VIEWER
**Read-Only Access**
- View Portfolio
- View Market Data
- View Transaction History
- Read-Only Dashboard

---

## 3. Menu Structure (Tree Format)

### Platform Admin Dashboard (`/admin`)

```
Platform Admin Dashboard
├── Home
│   └── Dashboard Overview
│       ├── System Health
│       ├── Platform Metrics
│       └── Quick Actions
│
├── System Management
│   ├── System Health
│   │   ├── Service Status
│   │   ├── Database Health
│   │   ├── Redis Health
│   │   └── External Services
│   ├── System Info
│   │   ├── Node.js Metrics
│   │   ├── OS Metrics
│   │   └── Resource Usage
│   └── Settings
│       ├── Platform Configuration
│       ├── Feature Toggles
│       └── System Maintenance
│
├── Limit Management
│   ├── KYC Level Limits
│   │   ├── Configure Default Limits
│   │   │   ├── L0 Limits
│   │   │   ├── L1 Limits
│   │   │   ├── L2 Limits
│   │   │   ├── L3 Limits
│   │   │   └── INSTITUTIONAL Limits
│   │   ├── Investment Limits
│   │   ├── Trading Limits
│   │   ├── Withdrawal Limits
│   │   ├── Deposit Limits
│   │   └── Daily Transaction Limits
│   ├── Role-Based Limits
│   │   ├── Platform Role Limits
│   │   ├── Broker Role Limits
│   │   └── User Role Limits
│   ├── User-Specific Overrides
│   │   ├── Override KYC Limits
│   │   ├── Temporary Limits
│   │   └── Permanent Limits
│   └── Limit History
│       ├── Limit Changes
│       └── Audit Trail
│
├── User Management
│   ├── All Users
│   │   ├── Search & Filter
│   │   ├── User Details
│   │   └── Bulk Actions
│   ├── User Roles
│   │   ├── Role Assignment
│   │   └── Permission Management
│   └── User Limits
│       ├── Transaction Limits
│       └── KYC Status
│
├── Broker Management
│   ├── All Brokers
│   │   ├── Broker List
│   │   ├── Broker Details
│   │   └── Broker Status
│   ├── Broker Onboarding
│   │   ├── Create Broker
│   │   ├── Configuration
│   │   └── Branding Setup
│   ├── Broker Settings
│   │   ├── Feature Toggles
│   │   ├── Limits & Controls
│   │   └── Financial Controls
│   └── Broker Analytics
│       ├── User Metrics
│       ├── Transaction Metrics
│       └── Financial Metrics
│
├── RBAC & Permissions
│   ├── Roles
│   │   ├── Platform Roles
│   │   ├── Broker Roles
│   │   └── User Roles
│   ├── Permissions
│   │   ├── Permission Matrix
│   │   └── Permission Assignment
│   └── Role Assignment
│       ├── User Role Assignment
│       └── Bulk Assignment
│
├── Policy Management
│   ├── OPA Policies
│   │   ├── AML Policies
│   │   ├── Security Policies
│   │   ├── Trading Policies
│   │   └── RBAC Policies
│   ├── Policy Testing
│   │   ├── Test Input
│   │   └── Test Results
│   └── Policy Audit
│       ├── Policy Changes
│       └── Audit Log
│
├── Workflow Management
│   ├── All Workflows
│   │   ├── Workflow List
│   │   ├── Workflow Status
│   │   └── Workflow Analytics
│   ├── KYC Workflows
│   │   ├── L0 → L1 Workflow
│   │   ├── L1 → L2 Workflow
│   │   ├── L2 → L3 Workflow
│   │   └── L3 → INSTITUTIONAL Workflow
│   └── Workflow Configuration
│       ├── Workflow Definitions
│       └── Workflow Triggers
│
├── Compliance & Audit
│   ├── Compliance Dashboard
│   │   ├── KYC Status Overview
│   │   ├── Compliance Metrics
│   │   └── Risk Assessment
│   ├── KYC Management
│   │   ├── Pending Reviews
│   │   ├── Approved Users
│   │   └── Rejected Users
│   ├── Audit Logs
│   │   ├── System Events
│   │   ├── User Actions
│   │   └── Policy Changes
│   └── Regulatory Reporting
│       ├── SAR Filing
│       ├── Transaction Reports
│       └── Compliance Reports
│
├── Financial Management
│   ├── Multi-Tier Ledger
│   │   ├── Platform Accounts
│   │   ├── Broker Accounts
│   │   └── User Accounts
│   ├── Fund Reconciliation
│   │   ├── Reconciliation Jobs
│   │   └── Reconciliation Reports
│   ├── Treasury Management
│   │   ├── Platform Treasury
│   │   └── Fund Transfers
│   └── Financial Reports
│       ├── Transaction Reports
│       ├── Revenue Reports
│       └── Broker Financials
│
├── Security & Risk
│   ├── Security Oversight
│   │   ├── Threat Detection
│   │   ├── Security Events
│   │   └── Incident Response
│   ├── Device Fingerprinting
│   │   ├── Device Management
│   │   └── Risk Assessment
│   └── Risk Management
│       ├── Risk Scoring
│       └── Risk Policies
│
└── Analytics & Reporting
    ├── Platform Analytics
    │   ├── User Metrics
    │   ├── Transaction Metrics
    │   └── Financial Metrics
    ├── Broker Analytics
    │   ├── Per-Broker Metrics
    │   └── Comparative Analysis
    └── Custom Reports
        ├── Report Builder
        └── Scheduled Reports
```

### Broker Admin Dashboard (`/broker`)

```
Broker Admin Dashboard
├── Home
│   └── Broker Dashboard
│       ├── Broker Metrics
│       ├── User Metrics
│       └── Quick Actions
│
├── User Management
│   ├── Broker Users
│   │   ├── User List
│   │   ├── User Details
│   │   └── User Actions
│   ├── KYC Management
│   │   ├── Pending Reviews
│   │   ├── KYC Status
│   │   └── KYC Approvals
│   └── User Limits
│       ├── Transaction Limits
│       └── Access Controls
│
├── Trading Operations
│   ├── Order Management
│   │   ├── Active Orders
│   │   ├── Order History
│   │   └── Order Analytics
│   ├── Market Data
│   │   ├── Trading Pairs
│   │   └── Market Analytics
│   └── Trading Configuration
│       ├── Trading Pairs
│       └── Trading Rules
│
├── Financial Management
│   ├── Broker Ledger
│   │   ├── Account Balances
│   │   └── Transaction History
│   ├── Fund Reconciliation
│   │   └── Reconciliation Reports
│   └── Financial Reports
│       ├── Revenue Reports
│       └── Transaction Reports
│
├── Compliance
│   ├── Compliance Dashboard
│   │   ├── KYC Status
│   │   └── Risk Assessment
│   ├── Transaction Monitoring
│   │   ├── Suspicious Transactions
│   │   └── Transaction Alerts
│   └── Audit Logs
│       └── Broker Events
│
├── Broker Settings
│   ├── Configuration
│   │   ├── Broker Details
│   │   └── Feature Toggles
│   ├── Branding
│   │   ├── Logo & Colors
│   │   └── Customization
│   └── Limits & Controls
│       ├── Transaction Limits
│       └── Access Controls
│
└── Analytics
    ├── User Analytics
    │   ├── User Growth
    │   └── User Activity
    ├── Trading Analytics
    │   ├── Trading Volume
    │   └── Trading Patterns
    └── Financial Analytics
        ├── Revenue Analytics
        └── Cost Analytics
```

### End User Dashboard (`/dashboard`)

```
User Dashboard
├── Home
│   └── Dashboard Overview
│       ├── Portfolio Summary
│       ├── Market Overview
│       └── Quick Actions
│
├── Trading
│   ├── Spot Trading
│   │   ├── Trading Interface
│   │   ├── Order Book
│   │   ├── Price Chart
│   │   └── Order History
│   ├── Advanced Trading
│   │   ├── Margin Trading
│   │   ├── Futures Trading
│   │   └── Options Trading
│   ├── Exchange Selection
│   │   ├── Native CEX (Platform Exchange)
│   │   ├── Omni-Exchange (Third-Party Aggregator)
│   │   │   ├── KuCoin
│   │   │   ├── Bybit
│   │   │   ├── OKX
│   │   │   ├── Kraken
│   │   │   ├── VALR
│   │   │   ├── Bitstamp
│   │   │   └── Crypto.com
│   │   └── DEX (Decentralized Exchange)
│   └── Trading History
│       ├── Open Orders
│       ├── Order History
│       └── Trade History
│
├── Wallet
│   ├── Hot Wallet
│   │   ├── Wallet Balance
│   │   ├── Receive Funds
│   │   ├── Send Funds
│   │   └── Wallet Settings
│   ├── Web3 Wallet
│   │   ├── Connected Wallets
│   │   ├── Wallet Balance
│   │   └── Wallet Security
│   └── FIAT Wallet
│       ├── Deposit
│       ├── Withdraw
│       └── Transaction History
│
├── Portfolio
│   ├── Holdings
│   │   ├── Asset Allocation
│   │   ├── Portfolio Value
│   │   └── Performance Metrics
│   ├── Analytics
│   │   ├── Portfolio Analytics
│   │   ├── Performance Charts
│   │   └── Risk Analysis
│   └── Reports
│       ├── Tax Reports
│       └── Transaction Reports
│
├── Presale & Token Sales
│   ├── Active Presales
│   │   ├── Presale List
│   │   ├── Presale Details
│   │   └── Investment Interface
│   ├── My Investments
│   │   ├── Active Investments
│   │   ├── Vesting Schedule
│   │   └── Investment History
│   └── Whitelist
│       ├── Whitelist Status
│       └── Whitelist Applications
│
├── Staking
│   ├── Staking Pools
│   │   ├── Available Pools
│   │   ├── Pool Details
│   │   └── Staking Interface
│   ├── My Stakes
│   │   ├── Active Stakes
│   │   ├── Rewards
│   │   └── Staking History
│   └── Staking Analytics
│       ├── APY Calculator
│       └── Rewards History
│
├── NFT Marketplace
│   ├── Browse NFTs
│   │   ├── NFT Collections
│   │   ├── NFT Details
│   │   └── NFT Search
│   ├── My NFTs
│   │   ├── Owned NFTs
│   │   ├── Created NFTs
│   │   └── NFT History
│   └── Create NFT
│       ├── Mint NFT
│       └── NFT Management
│
├── DEX
│   ├── Swap
│   │   ├── Token Swap
│   │   ├── Liquidity Pools
│   │   └── Swap History
│   ├── Liquidity
│   │   ├── Add Liquidity
│   │   ├── Remove Liquidity
│   │   └── Liquidity Positions
│   └── DEX Analytics
│       ├── Pool Analytics
│       └── Trading Analytics
│
├── Market Data
│   ├── Price Charts
│   │   ├── TradingView Charts
│   │   ├── Historical Data
│   │   └── Technical Indicators
│   ├── Market Overview
│   │   ├── Top Gainers
│   │   ├── Top Losers
│   │   └── Market Cap
│   └── News & Analysis
│       ├── Market News
│       └── Analysis Reports
│
├── Account
│   ├── Profile
│   │   ├── Personal Information
│   │   ├── Security Settings
│   │   └── Preferences
│   ├── KYC Status
│   │   ├── Current Level
│   │   ├── Upgrade Options
│   │   ├── Document Upload
│   │   └── KYC History
│   ├── Transaction Limits
│   │   ├── Current Limits
│   │   ├── Usage Statistics
│   │   └── Upgrade Benefits
│   ├── API Keys
│   │   ├── API Key Management
│   │   ├── Create API Key
│   │   └── API Documentation
│   ├── Notifications
│   │   ├── Notification Settings
│   │   └── Notification History
│   └── Security
│       ├── Two-Factor Authentication
│       ├── Device Management
│       ├── Login History
│       └── Security Alerts
│
└── Support
    ├── Help Center
    │   ├── FAQs
    │   ├── Guides
    │   └── Documentation
    ├── Support Tickets
    │   ├── Create Ticket
    │   ├── My Tickets
    │   └── Ticket History
    └── Contact
        ├── Live Chat
        └── Contact Form
```

---

## 4. Feature Access Matrix

### Trading Features
| Feature | L0 | L1 | L2 | L3 | INSTITUTIONAL |
|---------|----|----|----|----|---------------|
| Spot Trading | ❌ | ✅ | ✅ | ✅ | ✅ |
| Advanced Trading | ❌ | ❌ | ✅ | ✅ | ✅ |
| Margin Trading | ❌ | ❌ | ✅ | ✅ | ✅ |
| Futures Trading | ❌ | ❌ | ❌ | ✅ | ✅ |
| Options Trading | ❌ | ❌ | ❌ | ✅ | ✅ |
| Native CEX (Platform) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Omni-Exchange (Third-Party) | ❌ | ✅ | ✅ | ✅ | ✅ |
| DEX Trading | ✅ | ✅ | ✅ | ✅ | ✅ |

### Investment Features
| Feature | L0 | L1 | L2 | L3 | INSTITUTIONAL |
|---------|----|----|----|----|---------------|
| Presale Investment | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token Sales | ✅ | ✅ | ✅ | ✅ | ✅ |
| Staking | ✅ | ✅ | ✅ | ✅ | ✅ |
| NFT Marketplace | ✅ | ✅ | ✅ | ✅ | ✅ |
| DEX Trading | ✅ | ✅ | ✅ | ✅ | ✅ |

### Wallet Features
| Feature | L0 | L1 | L2 | L3 | INSTITUTIONAL |
|---------|----|----|----|----|---------------|
| Web3 Wallet | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hot Wallet | ✅ | ✅ | ✅ | ✅ | ✅ |
| FIAT Wallet | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deposit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Withdrawal | ✅ | ✅ | ✅ | ✅ | ✅ |

### Advanced Features
| Feature | L0 | L1 | L2 | L3 | INSTITUTIONAL |
|---------|----|----|----|----|---------------|
| API Access | ❌ | ✅ | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ❌ | ✅ | ✅ | ✅ |
| Portfolio Analytics | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dedicated Support | ❌ | ❌ | ❌ | ✅ | ✅ |
| Custom Solutions | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. API Endpoints by Feature Area

### Authentication (`/api/auth`)
- POST `/login` - User login
- POST `/register` - User registration
- POST `/logout` - User logout
- GET `/profile` - Get user profile
- POST `/refresh-token` - Refresh access token
- POST `/verify-mfa` - Verify MFA code
- POST `/reset-password` - Request password reset
- POST `/confirm-reset` - Confirm password reset

### KYC (`/api/kyc`)
- GET `/status` - Get KYC status
- POST `/submit` - Submit KYC documents
- GET `/level/:userId` - Get KYC level
- PUT `/level/:userId` - Update KYC level
- POST `/upgrade` - Request KYC upgrade
- GET `/workflows` - Get KYC workflows

### Trading (`/api/trading`)
- POST `/order` - Place order
- GET `/orders` - Get orders
- DELETE `/orders/:id` - Cancel order
- GET `/history` - Get trading history

### Native CEX (`/api/native-cex`)
- POST `/orders` - Place CEX order
- GET `/orders` - Get CEX orders
- DELETE `/orders/:id` - Cancel CEX order
- GET `/balance` - Get CEX balance
- GET `/orderbook/:symbol` - Get order book

### Omni-Exchange (`/api/omni-exchange`)
- GET `/exchanges` - Get available exchanges
- GET `/exchanges/:id/health` - Get exchange health
- POST `/orders` - Place order (auto-routed to best exchange)
- GET `/orders` - Get orders across exchanges
- DELETE `/orders/:id` - Cancel order
- GET `/balance` - Get aggregated balance
- GET `/orderbook/:symbol` - Get aggregated order book
- GET `/trades/:symbol` - Get trades across exchanges

### Market Data (`/api/market`)
- GET `/prices/:symbol` - Get price
- GET `/historical/:symbol` - Get historical data
- GET `/orderbook/:symbol` - Get order book
- GET `/trades/:symbol` - Get recent trades

### Wallet System (`/api/wallet`)
- GET `/wallets` - Get wallets
- POST `/wallets` - Create wallet
- GET `/wallets/:id` - Get wallet details
- POST `/wallets/:id/deposit` - Deposit funds
- POST `/wallets/:id/withdraw` - Withdraw funds
- GET `/wallets/:id/transactions` - Get transactions

### Web3 Wallet (`/api/web3-wallet`)
- GET `/wallets` - Get connected wallets
- POST `/connect` - Connect wallet
- POST `/disconnect` - Disconnect wallet
- GET `/wallets/:id/balance` - Get balance
- POST `/wallets/:id/transfer` - Transfer funds

### Presale (`/api/presale`)
- GET `/presales` - Get presales
- GET `/presales/:id` - Get presale details
- POST `/presales/:id/invest` - Invest in presale
- GET `/investments` - Get investments
- GET `/whitelist` - Get whitelist status

### Admin (`/api/admin`)
- GET `/users` - Get all users
- GET `/users/:id` - Get user details
- PUT `/users/:id` - Update user
- DELETE `/users/:id` - Delete user
- GET `/kyc` - Get KYC statuses
- PUT `/kyc/:id` - Update KYC level
- GET `/health` - System health
- GET `/dashboard` - Admin dashboard
- GET `/audit-logs` - Get audit logs
- GET `/user-limits/:userId` - Get user limits

### Broker Management (`/api/brokers`)
- POST `/onboard` - Onboard broker
- GET `/brokers` - Get brokers
- GET `/brokers/:id` - Get broker details
- PUT `/brokers/:id` - Update broker
- GET `/brokers/:id/analytics` - Get broker analytics

### RBAC (`/api/rbac`)
- GET `/roles` - Get roles
- GET `/roles/:id` - Get role details
- POST `/roles` - Create role
- PUT `/roles/:id` - Update role
- GET `/permissions` - Get permissions
- POST `/assign-role` - Assign role to user

### Policy Management (`/api/admin/policies`)
- GET `/parameters/:category` - Get policy parameters
- PUT `/parameters/:category` - Update policy parameters
- GET `/health` - OPA health check
- POST `/test` - Test policy
- GET `/audit` - Get audit log

### Workflows (`/api/workflows`)
- GET `/workflows` - Get workflows
- GET `/workflows/:id` - Get workflow details
- POST `/workflows` - Create workflow
- GET `/workflows/health` - Workflow health

---

## 6. Transaction Limits Summary

### By KYC Level (in ZAR, default currency)

| KYC Level | Max Investment | Max Trading | Max Withdrawal | Max Deposit | Daily TX |
|-----------|---------------|-------------|----------------|-------------|----------|
| L0 | R185,000 | R0 | R18,500 | R185,000 | 5 |
| L1 | R925,000 | R462,500 | R92,500 | R925,000 | 20 |
| L2 | R4,625,000 | R1,850,000 | R462,500 | R4,625,000 | 50 |
| L3 | R18,500,000 | R9,250,000 | R1,850,000 | R18,500,000 | 100 |
| INSTITUTIONAL | R185,000,000 | R92,500,000 | R18,500,000 | R185,000,000 | 500 |

### By Role (in ZAR, default currency)

| Role | Max Daily Volume | Max Monthly Volume | Max Single TX | Max Withdrawal Daily |
|------|------------------|-------------------|---------------|---------------------|
| broker-admin | R18,500,000 | R185,000,000 | R1,850,000 | R9,250,000 |
| broker-finance | R9,250,000 | R92,500,000 | R925,000 | R4,625,000 |
| broker-ops | R1,850,000 | R18,500,000 | R185,000 | R925,000 |
| user-trader | R185,000 | R1,850,000 | R185,000 | R92,500 |
| user-institutional | R1,850,000 | R18,500,000 | R185,000 | R925,000 |
| user-vip | R925,000 | R9,250,000 | R92,500 | R462,500 |

---

## 7. Navigation Flow

### User Journey: New User → L3 Verified

1. **Registration** → L0 (Web3 Basic)
   - Connect Web3 wallet
   - Automatic L0 assignment
   - Can invest up to R185,000
   - Cannot trade

2. **First Transaction Attempt** → L1 Upgrade Prompt
   - User attempts trading or exceeds L0 limits
   - Upgrade workflow triggered
   - Email + Phone verification required
   - Sanctions check performed

3. **L1 Verified** → Enhanced Access
   - Can trade (up to R462,500)
   - Higher investment limits (R925,000)
   - 20 daily transactions

4. **Limit Approach** → L2 Upgrade Prompt
   - User reaches 80% of L1 limits (warning)
   - User reaches 100% of L1 limits (blocking)
   - Upgrade workflow triggered
   - ID + Address + Biometric required

5. **L2 Verified** → Advanced Features
   - Advanced trading features unlocked
   - Significantly higher limits
   - Priority support

6. **High-Value Transaction** → L3 Upgrade Prompt
   - User attempts transaction exceeding L2 limits
   - Source of funds verification required
   - Enhanced screening performed

7. **L3 Verified** → Maximum Access
   - Maximum limits
   - Institutional features
   - Dedicated account manager

---

## 8. Role-Based Menu Visibility

### Platform Admin
- All platform menus visible
- Full system access
- Broker management access
- User management (all tenants)

### Broker Admin
- Broker-scoped menus only
- Broker user management
- Broker configuration
- Broker analytics

### End User
- User dashboard menus
- Trading, Wallet, Portfolio
- Account settings
- KYC management
- Support

### Compliance Officer
- Compliance dashboard
- KYC review
- Audit logs
- Policy management
- Risk assessment

### Finance Manager
- Financial dashboard
- Ledger management
- Reconciliation
- Financial reports
- Treasury management

---

This documentation provides a complete overview of the platform's features, KYC levels, triggers, and menu structure organized by role and user type.
