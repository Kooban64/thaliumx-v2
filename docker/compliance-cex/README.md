# CEX Compliance Service

Enterprise-grade compliance processing service for ThaliumX CEX platform. Implements FATF Travel Rule, OECD CARF Reporting, and real-time Risk Assessment.

## Overview

The CEX Compliance Service is a distributed microservice that handles all compliance-related operations for the centralized exchange component of ThaliumX. It operates independently from the trading engine to ensure compliance processing doesn't impact trading performance.

### Key Features

- **Travel Rule Compliance**: FATF Recommendation 16 implementation for cross-border virtual asset transfers
- **CARF Reporting**: OECD Crypto-Asset Reporting Framework for tax authority submissions
- **Risk Assessment**: Real-time AML/CFT risk scoring with configurable thresholds
- **Event-Driven Architecture**: Kafka-based event streaming for real-time compliance processing
- **Multi-Tenant Support**: Full tenant and broker isolation for white-label deployments

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CEX Compliance Service                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │Travel Rule  │ │    CARF     │ │    Risk     │               │
│  │  Service    │ │   Service   │ │ Assessment  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│         │               │               │                       │
│  ┌──────┴───────────────┴───────────────┴──────┐               │
│  │           Repository Layer                   │               │
│  │  (VASP, TravelRule, CARF, RiskAssessment)   │               │
│  └──────────────────────────────────────────────┘               │
│                          │                                      │
│  ┌──────────────────────────────────────────────┐               │
│  │           Database Service (PostgreSQL)      │               │
│  └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │    Event Streaming (Kafka)   │
            └─────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+
- Apache Kafka 3.x
- Redis 7+

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   cd docker/compliance-cex
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start infrastructure**:
   ```bash
   docker-compose up -d postgres redis kafka zookeeper
   ```

4. **Run migrations**:
   ```bash
   psql -h localhost -U compliance_user -d thaliumx_compliance -f migrations/001_create_compliance_schema.sql
   ```

5. **Start the service**:
   ```bash
   npm run dev
   ```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f compliance-cex

# Stop services
docker-compose down
```

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health status |
| `/ready` | GET | Readiness check |
| `/live` | GET | Liveness check |
| `/version` | GET | Service version info |

### Travel Rule

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/travel-rule/check` | POST | Check if Travel Rule applies |
| `/api/v1/travel-rule/:id` | GET | Get Travel Rule message by ID |
| `/api/v1/travel-rule/stats` | GET | Get Travel Rule statistics |

### Risk Assessment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/risk-assessment/:id` | GET | Get risk assessment by ID |
| `/api/v1/risk-assessment/stats` | GET | Get risk assessment statistics |
| `/api/v1/risk-assessment/review-required` | GET | Get assessments requiring review |

### CARF Reporting

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/carf/:id` | GET | Get CARF report by ID |
| `/api/v1/carf/user/:userId` | GET | Get user's CARF reports |
| `/api/v1/carf/stats` | GET | Get CARF statistics |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/staging/production) | development |
| `PORT` | HTTP server port | 3001 |
| `DATABASE_HOST` | PostgreSQL host | localhost |
| `DATABASE_PORT` | PostgreSQL port | 5432 |
| `DATABASE_NAME` | Database name | thaliumx_compliance |
| `KAFKA_BROKERS` | Kafka broker addresses | localhost:9092 |
| `TRAVEL_RULE_THRESHOLD` | Travel Rule threshold (USD) | 3000 |
| `RISK_LOW_THRESHOLD` | Low risk score threshold | 30 |
| `RISK_MEDIUM_THRESHOLD` | Medium risk score threshold | 60 |
| `RISK_HIGH_THRESHOLD` | High risk score threshold | 80 |

See `.env.example` for complete configuration options.

## Event Topics

### Consumed Topics

| Topic | Description |
|-------|-------------|
| `cex.transactions` | Transaction events from CEX |
| `cex.users` | User registration and KYC events |
| `cex.wallets` | Wallet deposit/withdrawal events |

### Produced Topics

| Topic | Description |
|-------|-------------|
| `compliance.travel_rule` | Travel Rule message events |
| `compliance.risk_assessment` | Risk assessment completion events |
| `compliance.carf` | CARF report generation events |
| `compliance.events` | General compliance events |

## Database Schema

The service uses a dedicated `compliance` schema with the following tables:

- `vasp_registry` - VASP (Virtual Asset Service Provider) registry
- `travel_rule_messages` - Travel Rule message records
- `carf_reports` - CARF reporting records
- `risk_assessments` - Risk assessment records
- `compliance_events` - Compliance event log
- `audit_log` - Audit trail
- `user_compliance_profiles` - User compliance profiles
- `migrations` - Migration tracking

## Risk Assessment

### Risk Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Amount | 15% | Transaction amount relative to user average |
| Frequency | 10% | Transaction frequency |
| Geography | 20% | Geographic risk (FATF grey/black list) |
| Counterparty | 15% | Counterparty verification status |
| Pattern | 15% | Suspicious pattern detection |
| Velocity | 10% | Transaction velocity |
| Concentration | 5% | Asset concentration risk |
| Source of Funds | 10% | Source of funds verification |

### Risk Levels

| Level | Score Range | Action |
|-------|-------------|--------|
| Low | 0-29 | Standard processing |
| Medium | 30-59 | Enhanced monitoring |
| High | 60-79 | Manual review required |
| Critical | 80-100 | Transaction hold, report to authorities |

### Risk Flags

- `high_amount` - Unusually large transaction
- `frequent_transactions` - High transaction frequency
- `high_risk_jurisdiction` - FATF grey/black list country
- `unknown_counterparty` - Unverified counterparty
- `suspicious_pattern` - Potential structuring
- `rapid_velocity` - Rapid successive transactions
- `concentration_risk` - High asset concentration
- `peps_exposure` - Politically Exposed Person
- `sanctions_match` - Sanctions list match
- `unusual_timing` - Unusual transaction timing

## Travel Rule

### Supported Jurisdictions

| Jurisdiction | Threshold | Notes |
|--------------|-----------|-------|
| US | $3,000 USD | FinCEN requirements |
| EU | €1,000 EUR | MiCA requirements |
| CA | $1,000 CAD | FINTRAC requirements |
| UK | £1,000 GBP | FCA requirements |

### VASP Messaging

The service supports integration with major VASP messaging protocols:
- TRISA (Travel Rule Information Sharing Architecture)
- OpenVASP
- Sygna Bridge

## CARF Reporting

### Report Types

- Annual transaction summaries
- Individual transaction reports
- Holdings reports
- Tax authority submissions

### Supported Transaction Types

- Exchange (crypto-to-crypto, crypto-to-fiat)
- Transfer (deposits, withdrawals)
- Disposal (sales)
- Acquisition (purchases)
- Mining rewards
- Staking rewards

## Development

### Project Structure

```
docker/compliance-cex/
├── src/
│   ├── config/           # Configuration management
│   ├── repositories/     # Data access layer
│   ├── services/         # Business logic
│   │   ├── database/     # Database service
│   │   ├── events/       # Kafka producer/consumer
│   │   ├── travel-rule/  # Travel Rule service
│   │   ├── risk-assessment/ # Risk assessment service
│   │   └── carf/         # CARF reporting service
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── migrations/           # Database migrations
├── Dockerfile           # Production Docker image
├── docker-compose.yaml  # Development environment
└── package.json         # Dependencies
```

### Scripts

```bash
npm run build      # Build TypeScript
npm run start      # Start production server
npm run dev        # Start development server with hot reload
npm run test       # Run tests
npm run lint       # Run ESLint
npm run type-check # TypeScript type checking
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Monitoring

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "memory": {
    "used": 50000000,
    "total": 100000000,
    "percentage": 50
  },
  "database": {
    "status": "connected",
    "latency": 5
  },
  "kafka": {
    "status": "connected",
    "topics": ["cex.transactions", "cex.users", "cex.wallets"]
  },
  "compliance": {
    "pendingTravelRule": 0,
    "pendingCARF": 0,
    "highRiskAlerts": 0
  }
}
```

### Metrics

The service exposes metrics for:
- Request latency (p50, p95, p99)
- Event processing throughput
- Risk assessment distribution
- Travel Rule message status
- CARF report status

## Security

### Authentication

- JWT-based API authentication
- API key authentication for service-to-service communication
- Role-based access control (RBAC)

### Data Protection

- AES-256 encryption for sensitive data at rest
- TLS 1.3 for data in transit
- PII data masking in logs
- Audit logging for all compliance operations

### Compliance

- GDPR compliant data handling
- SOC 2 Type II controls
- ISO 27001 aligned security practices

## License

UNLICENSED - Proprietary software of ThaliumX

## Support

For support, contact the ThaliumX compliance team.
