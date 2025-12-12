# DEX Compliance Service

The DEX Compliance Service provides compliance functionality for decentralized exchange operations within the ThaliumX platform. It handles Travel Rule compliance, risk assessment, CARF reporting, and wallet screening for DEX swaps and liquidity operations.

## Features

### 1. Travel Rule Compliance (FATF)
- Automated Travel Rule message generation for swaps above threshold
- VASP registry management
- Message status tracking
- Cross-chain Travel Rule support

### 2. Risk Assessment
- Real-time risk scoring for swaps
- Wallet address risk analysis
- Pattern detection for suspicious activity
- Configurable risk thresholds

### 3. CARF Reporting
- Automated CARF report generation
- User-accessible report downloads
- Tax authority submission support
- Multi-jurisdiction compliance

### 4. Wallet Screening
- Sanctions list screening
- Mixer/tumbler detection
- High-risk address identification
- Real-time screening for all transactions

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Risk Assessment
- `POST /api/v1/compliance/dex/risk-assessment` - Assess swap risk
- `GET /api/v1/compliance/dex/risk-assessment/:id` - Get assessment

### Travel Rule
- `POST /api/v1/compliance/dex/travel-rule` - Create Travel Rule message
- `GET /api/v1/compliance/dex/travel-rule/:id` - Get Travel Rule status

### CARF
- `POST /api/v1/compliance/dex/carf/report` - Generate CARF report
- `GET /api/v1/compliance/dex/carf/report/:id` - Get CARF report

### Wallet Screening
- `POST /api/v1/compliance/dex/wallet/screen` - Screen wallet address
- `GET /api/v1/compliance/dex/wallet/:address/risk` - Get wallet risk profile

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
docker build -t compliance-dex .

# Run container
docker run -d -p 3002:3002 compliance-dex
```

## License

Proprietary - ThaliumX Platform
