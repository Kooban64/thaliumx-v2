# ThaliumX Compliance Services Stack

Enterprise-grade compliance microservices for the ThaliumX platform, providing comprehensive regulatory compliance across all trading verticals.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Compliance Coordinator                               │
│                    (Aggregation, Reporting, Alerts)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│ CEX Compliance│         │ DEX Compliance│         │ NFT Compliance│
│   Service     │         │   Service     │         │   Service     │
│   (Port 3001) │         │   (Port 3002) │         │   (Port 3003) │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                          ┌─────────────────┐
                          │Token Compliance │
                          │   Service       │
                          │   (Port 3004)   │
                          └─────────────────┘
```

## Services

### 1. CEX Compliance Service (Port 3001)
Compliance processing for centralized exchange operations.

**Features:**
- Travel Rule compliance (FATF)
- Risk assessment for trades
- CARF reporting
- VASP registry integration
- Sanctions screening

**API Endpoints:**
- `POST /api/v1/travel-rule/check` - Check if Travel Rule applies
- `GET /api/v1/travel-rule/:id` - Get Travel Rule message
- `GET /api/v1/travel-rule/stats` - Get Travel Rule statistics
- `GET /api/v1/risk-assessment/:id` - Get risk assessment
- `GET /api/v1/risk-assessment/stats` - Get risk statistics
- `GET /api/v1/carf/:id` - Get CARF report
- `GET /api/v1/carf/user/:userId` - Get user CARF reports

### 2. DEX Compliance Service (Port 3002)
Compliance processing for decentralized exchange operations.

**Features:**
- Smart contract monitoring
- Liquidity pool analysis
- DEX-specific risk assessment
- Cross-chain compliance
- Travel Rule for DEX transfers

**API Endpoints:**
- `POST /api/v1/risk/assess` - Assess DEX transaction risk
- `GET /api/v1/risk/assessment/:id` - Get risk assessment
- `POST /api/v1/travel-rule/create` - Create Travel Rule message
- `GET /api/v1/travel-rule/:id` - Get Travel Rule message

### 3. NFT Compliance Service (Port 3003)
Compliance processing for NFT marketplace operations.

**Features:**
- Content screening (NSFW, copyright)
- Wash trading detection
- NFT-specific risk assessment
- Travel Rule for high-value NFTs
- CARF reporting for NFT transactions

**API Endpoints:**
- `POST /api/v1/wash-trading/analyze` - Analyze sale for wash trading
- `GET /api/v1/wash-trading/token/:contractAddress/:tokenId/:chainId` - Get token history
- `POST /api/v1/content/screen` - Screen NFT content
- `POST /api/v1/content/review/:screeningId` - Review flagged content
- `GET /api/v1/content/pending` - Get pending reviews
- `POST /api/v1/risk/assess` - Assess NFT transaction risk
- `GET /api/v1/risk/assessment/:assessmentId` - Get risk assessment

### 4. Token Compliance Service (Port 3004)
Compliance processing for token operations.

**Features:**
- Wallet screening (sanctions, risk indicators)
- Token transfer risk assessment
- Approval risk assessment
- Presale compliance
- Travel Rule for token transfers
- CARF reporting

**API Endpoints:**
- `POST /api/v1/compliance/token/screening/wallet` - Screen wallet
- `GET /api/v1/compliance/token/screening/wallet/:address` - Get screening result
- `POST /api/v1/compliance/token/risk/assess/transfer` - Assess transfer risk
- `POST /api/v1/compliance/token/risk/assess/approval` - Assess approval risk
- `POST /api/v1/compliance/token/risk/assess/presale` - Assess presale risk
- `POST /api/v1/compliance/token/travel-rule/process` - Process Travel Rule
- `POST /api/v1/compliance/token/carf/report` - Generate CARF report

### 5. Compliance Coordinator (Port 3005)
Central coordination service for cross-platform compliance.

**Features:**
- Cross-platform aggregation
- Unified reporting
- Alert management
- Regulatory submission management
- Admin user management
- Audit logging

**API Endpoints:**
- `GET /api/v1/compliance/coordinator/risk-assessments` - Get aggregated risk assessments
- `GET /api/v1/compliance/coordinator/travel-rules` - Get aggregated Travel Rules
- `GET /api/v1/compliance/coordinator/statistics` - Get platform statistics
- `POST /api/v1/compliance/coordinator/reports/platform` - Generate platform report
- `POST /api/v1/compliance/coordinator/reports/user` - Generate user report
- `GET /api/v1/compliance/coordinator/alerts` - Get alerts
- `POST /api/v1/compliance/coordinator/alerts/:id/acknowledge` - Acknowledge alert
- `POST /api/v1/compliance/coordinator/alerts/:id/resolve` - Resolve alert
- `GET /api/v1/compliance/coordinator/regulatory/submissions` - Get regulatory submissions
- `POST /api/v1/compliance/coordinator/regulatory/submissions` - Create submission
- `GET /api/v1/compliance/coordinator/admin/users` - Get admin users
- `POST /api/v1/compliance/coordinator/admin/users` - Create admin user

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+
- Redis 7+
- Apache Kafka 3.6+

### Running with Docker Compose

```bash
# Navigate to compliance directory
cd docker/compliance

# Start all services
docker-compose -f compose.yaml up -d

# View logs
docker-compose -f compose.yaml logs -f

# Stop services
docker-compose -f compose.yaml down
```

### Environment Variables

Copy `.env.example` to `.env` in each service directory and configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=compliance_db
DB_USER=compliance_user
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092

# Service-specific settings
TRAVEL_RULE_ENABLED=true
TRAVEL_RULE_THRESHOLD=3000
CARF_ENABLED=true
```

## Health Checks

All services expose health check endpoints:

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic health status |
| `/health/ready` or `/ready` | Readiness check (database connected) |
| `/health/live` or `/live` | Liveness check |

## Compliance Features

### Travel Rule (FATF Recommendation 16)
- Automatic threshold detection
- Originator/beneficiary data collection
- VASP-to-VASP messaging
- Retry mechanism for failed transmissions

### Risk Assessment
- Transaction risk scoring
- User profile risk assessment
- Pattern detection
- Sanctions screening integration

### CARF (Crypto Asset Reporting Framework)
- Automatic report generation
- Multi-jurisdiction support
- Regulatory submission tracking
- 7-year retention compliance

### Content Screening (NFT)
- NSFW detection
- Copyright violation detection
- Manual review workflow
- Automated flagging

### Wash Trading Detection (NFT)
- Historical pattern analysis
- Circular trading detection
- Price manipulation detection
- Confidence scoring

## Development

### Local Development

```bash
# Install dependencies
cd docker/compliance-cex
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Database Migrations

```bash
# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback
```

## Monitoring

### Metrics
All services expose Prometheus metrics at `/metrics`:
- Request latency
- Error rates
- Database connection pool stats
- Kafka consumer lag
- Risk assessment counts

### Logging
Structured JSON logging with correlation IDs:
```json
{
  "level": "info",
  "timestamp": "2024-12-12T10:00:00.000Z",
  "service": "cex-compliance-service",
  "requestId": "uuid",
  "tenantId": "tenant-1",
  "message": "Risk assessment completed",
  "riskScore": 45,
  "riskLevel": "medium"
}
```

## Security

### Authentication
- API key authentication for service-to-service
- JWT validation for user requests
- Tenant isolation

### Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- PII handling compliance
- Audit logging

## License

Proprietary - ThaliumX
