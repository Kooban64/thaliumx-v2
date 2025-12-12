# Token Compliance Service

The Token Compliance Service provides compliance functionality for token operations within the ThaliumX platform. It handles Travel Rule compliance, risk assessment, CARF reporting, and wallet screening for token transfers, presales, and other token-related activities.

## Features

### 1. Travel Rule Compliance (FATF)
- Automated Travel Rule message generation for token transfers above threshold
- VASP registry management
- Message status tracking
- Multi-chain token transfer support

### 2. Risk Assessment
- Real-time risk scoring for token transfers
- Wallet address risk analysis
- Token contract risk assessment
- Configurable risk thresholds

### 3. CARF Reporting
- Automated CARF report generation for token activity
- Capital gains/losses calculation
- User-accessible report downloads
- Multi-jurisdiction compliance

### 4. Wallet Screening
- Sanctions list screening
- Mixer/tumbler detection
- High-risk address identification
- Real-time screening for all transactions

### 5. Token Presale Compliance
- KYC/AML verification integration
- Investor accreditation checks
- Jurisdiction restrictions
- Investment limits enforcement

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Risk Assessment
- `POST /api/v1/compliance/token/risk-assessment` - Assess token transfer risk
- `GET /api/v1/compliance/token/risk-assessment/:id` - Get assessment

### Travel Rule
- `POST /api/v1/compliance/token/travel-rule` - Create Travel Rule message
- `GET /api/v1/compliance/token/travel-rule/:id` - Get Travel Rule status

### CARF
- `POST /api/v1/compliance/token/carf/report` - Generate CARF report
- `GET /api/v1/compliance/token/carf/report/:id` - Get CARF report

### Wallet Screening
- `POST /api/v1/compliance/token/wallet/screen` - Screen wallet address
- `GET /api/v1/compliance/token/wallet/:address/risk` - Get wallet risk profile

### Presale Compliance
- `POST /api/v1/compliance/token/presale/verify` - Verify presale participant
- `GET /api/v1/compliance/token/presale/:userId/status` - Get verification status

## Configuration

See `.env.example` for configuration options.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build
npm run build

# Run production
npm start
```

## Docker

```bash
# Build image
docker build -t compliance-token .

# Run container
docker run -d -p 3004:3004 compliance-token
```

## License

Proprietary - ThaliumX Platform
