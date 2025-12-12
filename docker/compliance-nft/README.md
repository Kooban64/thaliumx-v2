# NFT Compliance Service

The NFT Compliance Service provides compliance functionality for NFT marketplace operations within the ThaliumX platform. It handles Travel Rule compliance, risk assessment, CARF reporting, content screening, and wash trading detection for NFT transactions.

## Features

### 1. Travel Rule Compliance (FATF)
- Automated Travel Rule message generation for NFT sales above threshold
- VASP registry management
- Message status tracking
- Cross-chain NFT transfer support

### 2. Risk Assessment
- Real-time risk scoring for NFT transactions
- Seller/buyer risk analysis
- Collection-level risk assessment
- Configurable risk thresholds

### 3. CARF Reporting
- Automated CARF report generation for NFT activity
- Capital gains/losses calculation
- User-accessible report downloads
- Multi-jurisdiction compliance

### 4. Content Screening
- Automated content moderation
- Copyright/IP violation detection
- Prohibited content identification
- Manual review queue management

### 5. Wash Trading Detection
- Pattern analysis for wash trading
- Related wallet identification
- Artificial volume detection
- Automated flagging and alerts

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Risk Assessment
- `POST /api/v1/compliance/nft/risk-assessment` - Assess NFT transaction risk
- `GET /api/v1/compliance/nft/risk-assessment/:id` - Get assessment

### Travel Rule
- `POST /api/v1/compliance/nft/travel-rule` - Create Travel Rule message
- `GET /api/v1/compliance/nft/travel-rule/:id` - Get Travel Rule status

### CARF
- `POST /api/v1/compliance/nft/carf/report` - Generate CARF report
- `GET /api/v1/compliance/nft/carf/report/:id` - Get CARF report

### Content Screening
- `POST /api/v1/compliance/nft/content/screen` - Screen NFT content
- `GET /api/v1/compliance/nft/content/:id/status` - Get screening status

### Wash Trading
- `POST /api/v1/compliance/nft/wash-trading/analyze` - Analyze for wash trading
- `GET /api/v1/compliance/nft/wash-trading/:collectionId` - Get collection analysis

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
docker build -t compliance-nft .

# Run container
docker run -d -p 3003:3003 compliance-nft
```

## License

Proprietary - ThaliumX Platform
