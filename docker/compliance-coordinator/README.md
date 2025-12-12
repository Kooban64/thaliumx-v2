# Compliance Coordinator

The Compliance Coordinator is the central hub for the ThaliumX Distributed Compliance Service Architecture. It aggregates compliance data from all platform services (CEX, DEX, NFT, Token) and provides unified reporting, alerts management, regulatory submissions, and admin functionality.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ThaliumX Platform                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  NFT Service│ │ DEX Service │ │ CEX Service │ │Token Service│ │
│  │             │ │             │ │             │ │             │ │
│  │  ┌────────┐ │ │  ┌────────┐ │ │  ┌────────┐ │ │  ┌────────┐ │ │
│  │  │NFT Comp│ │ │  │DEX Comp│ │ │  │CEX Comp│ │ │  │Token   │ │
│  │  │Service │ │ │  │Service │ │ │  │Service │ │ │  │Comp    │ │
│  │  └────────┘ │ │  └────────┘ │ │  └────────┘ │ │  └────────┘ │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                    ┌─────────────────────────────┐
                    │    Event Streaming          │
                    │    (Kafka)                  │
                    └─────────────────────────────┘
                                   │
                    ┌─────────────────────────────┐
                    │ Compliance Coordinator      │
                    │ - Cross-system reporting    │
                    │ - Platform analytics        │
                    │ - Regulatory submissions    │
                    │ - Admin management          │
                    │ - Alerts management         │
                    └─────────────────────────────┘
```

## Features

### 1. Data Aggregation
- Aggregates risk assessments from all compliance services
- Aggregates Travel Rule messages across platforms
- Aggregates CARF reports for unified tax reporting
- Real-time event consumption via Kafka

### 2. Platform Reporting
- Daily, weekly, monthly, quarterly, and annual reports
- User-specific compliance reports
- Risk distribution analysis
- Service breakdown statistics
- Top risk flags identification

### 3. Alerts Management
- Centralized alert handling
- Severity-based prioritization (low, medium, high, critical)
- Alert lifecycle management (new → acknowledged → investigating → resolved)
- Email and Slack notifications for high-severity alerts
- Alert statistics and analytics

### 4. Regulatory Submissions
- Support for multiple submission types (CARF, SAR, CTR, STR)
- Multi-jurisdiction support
- Automated submission with retry logic
- Submission status tracking
- Regulatory response handling

### 5. Admin Management
- Role-based access control (admin, compliance_officer, analyst, viewer)
- Permission management
- Action logging and audit trail
- Admin statistics

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes database)
- `GET /health/live` - Liveness check

### Aggregation
- `GET /api/v1/compliance/coordinator/risk-assessments` - Get aggregated risk assessments
- `GET /api/v1/compliance/coordinator/travel-rules` - Get aggregated travel rules
- `GET /api/v1/compliance/coordinator/statistics` - Get platform statistics

### Reporting
- `POST /api/v1/compliance/coordinator/reports/platform` - Generate platform report
- `GET /api/v1/compliance/coordinator/reports/platform/:id` - Get platform report
- `POST /api/v1/compliance/coordinator/reports/user` - Generate user report
- `GET /api/v1/compliance/coordinator/reports/user/:id` - Get user report

### Alerts
- `GET /api/v1/compliance/coordinator/alerts` - Get alerts
- `GET /api/v1/compliance/coordinator/alerts/:id` - Get alert by ID
- `POST /api/v1/compliance/coordinator/alerts/:id/acknowledge` - Acknowledge alert
- `POST /api/v1/compliance/coordinator/alerts/:id/investigate` - Start investigation
- `POST /api/v1/compliance/coordinator/alerts/:id/resolve` - Resolve alert
- `POST /api/v1/compliance/coordinator/alerts/:id/dismiss` - Dismiss alert
- `GET /api/v1/compliance/coordinator/alerts/statistics` - Get alert statistics

### Regulatory
- `GET /api/v1/compliance/coordinator/regulatory/submissions` - Get submissions
- `GET /api/v1/compliance/coordinator/regulatory/submissions/:id` - Get submission
- `POST /api/v1/compliance/coordinator/regulatory/submissions` - Create submission
- `POST /api/v1/compliance/coordinator/regulatory/submissions/:id/submit` - Submit to authority
- `POST /api/v1/compliance/coordinator/regulatory/submissions/:id/acknowledge` - Acknowledge response
- `GET /api/v1/compliance/coordinator/regulatory/statistics` - Get submission statistics

### Admin
- `GET /api/v1/compliance/coordinator/admin/users` - Get admin users
- `GET /api/v1/compliance/coordinator/admin/users/:id` - Get admin user
- `POST /api/v1/compliance/coordinator/admin/users` - Create admin user
- `PATCH /api/v1/compliance/coordinator/admin/users/:id` - Update admin user
- `POST /api/v1/compliance/coordinator/admin/users/:id/deactivate` - Deactivate admin
- `POST /api/v1/compliance/coordinator/admin/users/:id/activate` - Activate admin
- `GET /api/v1/compliance/coordinator/admin/action-logs` - Get action logs
- `GET /api/v1/compliance/coordinator/admin/statistics` - Get admin statistics

## Configuration

### Environment Variables

```bash
# Service Configuration
SERVICE_NAME=compliance-coordinator
SERVICE_VERSION=1.0.0
NODE_ENV=development
LOG_LEVEL=info

# Server Configuration
PORT=3005
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=compliance_coordinator
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_SSL=false
DB_MAX_CONNECTIONS=20

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=compliance-coordinator
KAFKA_GROUP_ID=compliance-coordinator-group

# Compliance Services
CEX_COMPLIANCE_URL=http://localhost:3001
DEX_COMPLIANCE_URL=http://localhost:3002
NFT_COMPLIANCE_URL=http://localhost:3003
TOKEN_COMPLIANCE_URL=http://localhost:3004

# Reporting Configuration
REPORTING_DEFAULT_FORMAT=json
REPORTING_RETENTION_DAYS=365

# Regulatory Configuration
REGULATORY_JURISDICTIONS=US,EU,UK,SG
REGULATORY_AUTO_SUBMIT=false

# Alerts Configuration
ALERTS_ENABLED=true
ALERTS_EMAIL_ENABLED=false
ALERTS_SLACK_ENABLED=false
```

## Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Kafka (optional, for event streaming)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Build

```bash
# Build TypeScript
npm run build

# Run production server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Docker Deployment

### Using Docker Compose

```bash
# Start all compliance services
docker-compose up -d

# View logs
docker-compose logs -f compliance-coordinator

# Stop services
docker-compose down
```

### Individual Container

```bash
# Build image
docker build -t compliance-coordinator .

# Run container
docker run -d \
  --name compliance-coordinator \
  -p 3005:3005 \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=your_password \
  compliance-coordinator
```

## Database Schema

The Compliance Coordinator uses the following main tables:

- `aggregated_risk_assessments` - Aggregated risk data from all services
- `aggregated_travel_rules` - Aggregated Travel Rule messages
- `aggregated_carf_reports` - Aggregated CARF reports
- `platform_compliance_reports` - Generated platform reports
- `user_compliance_reports` - Generated user reports
- `regulatory_submissions` - Regulatory submission records
- `compliance_alerts` - Compliance alerts
- `admin_users` - Admin user accounts
- `admin_action_logs` - Admin action audit logs
- `service_status` - Service health status
- `dashboard_metrics` - Dashboard metrics cache

## Event Topics

The Compliance Coordinator consumes events from the following Kafka topics:

- `compliance.cex.events` - CEX compliance events
- `compliance.dex.events` - DEX compliance events
- `compliance.nft.events` - NFT compliance events
- `compliance.token.events` - Token compliance events

### Event Types

- `risk_assessment_created` - New risk assessment
- `risk_assessment_updated` - Updated risk assessment
- `travel_rule_created` - New Travel Rule message
- `travel_rule_updated` - Updated Travel Rule status
- `carf_report_created` - New CARF report
- `carf_report_updated` - Updated CARF report
- `alert_created` - New compliance alert
- `service_health_update` - Service health status update

## Security

- All endpoints require authentication (via API Gateway)
- Role-based access control for admin functions
- Audit logging for all admin actions
- Encrypted database connections (SSL)
- Request rate limiting (via API Gateway)

## Monitoring

- Health check endpoints for Kubernetes probes
- Structured JSON logging
- Prometheus metrics (via API Gateway)
- Distributed tracing support

## License

Proprietary - ThaliumX Platform
