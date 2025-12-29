# ThaliumX Kafka Topics Architecture

## Overview

ThaliumX uses Apache Kafka as the central event streaming platform for:
- Real-time event processing
- Service-to-service communication
- Audit trail and compliance logging
- Market data distribution
- Notification delivery

## Topic Naming Convention

```
<domain>.<category>.<subcategory>
```

Examples:
- `thaliumx.audit` - Audit events
- `thaliumx.transactions` - Transaction events
- `thaliumx.notifications.email` - Email notifications

## Topic Categories

### 1. Dingir Trading Engine Topics

These topics are used by the Dingir matching engine for high-frequency trading operations.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `trades` | 6 | 7 days | Trade execution events from matching engine |
| `orders` | 6 | 7 days | Order creation, updates, and cancellation events |
| `balances` | 3 | 7 days | Account balance update events |
| `deposits` | 3 | 30 days | Cryptocurrency deposit events |
| `withdraws` | 3 | 30 days | Cryptocurrency withdrawal events |
| `internaltransfer` | 3 | 7 days | Internal transfer events between accounts |
| `registeruser` | 3 | 30 days | User registration events |
| `unifyevents` | 1 | 7 days | Unified ordered event stream for state reconstruction |

**Producers:**
- Dingir Matchengine (Rust)

**Consumers:**
- Dingir Persistor (writes to TimescaleDB)
- Backend API (for real-time updates)

### 2. Backend Application Topics

Core application events for audit, compliance, and system monitoring.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.audit` | 3 | 90 days | Audit trail events for compliance |
| `thaliumx.transactions` | 6 | 90 days | Financial transaction events |
| `thaliumx.system` | 3 | 7 days | System health and monitoring events |
| `thaliumx.compliance` | 3 | 1 year | Compliance and regulatory events |
| `thaliumx.alerts` | 3 | 30 days | Critical system alerts |
| `thaliumx.health` | 1 | 1 day | Health check heartbeat events |

**Producers:**
- Backend API (Node.js)
- All microservices

**Consumers:**
- Compliance Service
- Monitoring Service
- Alert Manager

### 3. Market Data Topics

Real-time market data distribution for trading interfaces.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.prices` | 6 | 1 day | Real-time price updates |
| `thaliumx.orderbook` | 6 | 1 hour | Order book depth updates |
| `thaliumx.klines` | 3 | 7 days | Candlestick/OHLCV data updates |
| `thaliumx.ticker` | 3 | 1 day | 24h ticker statistics |
| `thaliumx.market-stats` | 3 | 7 days | Market statistics and analytics |

**Producers:**
- Dingir Matchengine
- Market Data Service

**Consumers:**
- WebSocket Gateway
- Frontend Applications
- Analytics Service

### 4. Notification Topics

User notification delivery queues.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.notifications.email` | 3 | 7 days | Email notification queue |
| `thaliumx.notifications.sms` | 3 | 7 days | SMS notification queue |
| `thaliumx.notifications.push` | 3 | 7 days | Push notification queue |
| `thaliumx.notifications.inapp` | 3 | 30 days | In-app notification events |

**Producers:**
- Backend API
- Trading Engine
- Compliance Service

**Consumers:**
- Email Service (SendGrid/SMTP)
- SMS Service (Twilio)
- Push Notification Service
- WebSocket Gateway

### 5. KYC/AML Topics

Know Your Customer and Anti-Money Laundering event streams.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.kyc.requests` | 3 | 90 days | KYC verification requests |
| `thaliumx.kyc.results` | 3 | 1 year | KYC verification results |
| `thaliumx.aml.screening` | 3 | 1 year | AML/OFAC screening events |
| `thaliumx.risk.assessment` | 3 | 90 days | Risk assessment events |

**Producers:**
- Backend API
- KYC Service (Ballerine)

**Consumers:**
- Compliance Service
- Risk Assessment Service
- Audit Service

### 6. Blockchain Topics

Blockchain interaction events.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.blockchain.transactions` | 3 | 90 days | Blockchain transaction events |
| `thaliumx.blockchain.confirmations` | 3 | 7 days | Block confirmation events |
| `thaliumx.blockchain.contracts` | 3 | 90 days | Smart contract interaction events |
| `thaliumx.blockchain.wallets` | 3 | 30 days | Wallet creation and update events |

**Producers:**
- Blockchain Service
- Wallet Service

**Consumers:**
- Transaction Processor
- Notification Service
- Audit Service

### 7. Dead Letter Queues (DLQ)

Failed message handling for retry and investigation.

| Topic | Partitions | Retention | Description |
|-------|------------|-----------|-------------|
| `thaliumx.dlq.general` | 3 | 30 days | General dead letter queue |
| `thaliumx.dlq.transactions` | 3 | 90 days | Transaction processing failures |
| `thaliumx.dlq.notifications` | 3 | 7 days | Notification delivery failures |

**Producers:**
- All consumers (on failure)

**Consumers:**
- DLQ Processor Service
- Operations Team (manual review)

### 8. Compacted Topics (State Storage)

Log-compacted topics for state storage and recovery.

| Topic | Partitions | Cleanup | Description |
|-------|------------|---------|-------------|
| `thaliumx.state.users` | 3 | compact | User state (infinite retention) |
| `thaliumx.state.balances` | 6 | compact | Account balance state |
| `thaliumx.state.markets` | 1 | compact | Market configuration state |
| `thaliumx.state.config` | 1 | compact | System configuration state |

**Producers:**
- State Management Service

**Consumers:**
- Service Recovery
- State Synchronization

## Event Schemas

### Trade Event
```json
{
  "id": "trade_123456",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "market": "BTC_USDT",
  "price": "42500.00",
  "amount": "0.5",
  "quote_amount": "21250.00",
  "taker_side": "buy",
  "maker_order_id": "order_111",
  "taker_order_id": "order_222"
}
```

### Order Event
```json
{
  "event": "ORDER_CREATED",
  "order": {
    "id": "order_123",
    "user_id": 1001,
    "market": "BTC_USDT",
    "side": "buy",
    "type": "limit",
    "price": "42000.00",
    "amount": "1.0",
    "filled_amount": "0.0",
    "status": "open",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Audit Event
```json
{
  "metadata": {
    "eventId": "evt_1705312200_abc123",
    "eventType": "audit",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "source": "thaliumx-backend",
    "version": "1.0.0",
    "action": "user.login",
    "resource": "user",
    "resourceId": "user_123",
    "tenantId": "tenant_001",
    "userId": "user_123",
    "ipAddress": "192.168.1.1"
  },
  "payload": {
    "before": null,
    "after": { "lastLogin": "2024-01-15T10:30:00.000Z" },
    "changes": ["lastLogin"]
  }
}
```

### Transaction Event
```json
{
  "metadata": {
    "eventId": "evt_1705312200_def456",
    "eventType": "transaction",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "source": "thaliumx-backend",
    "version": "1.0.0",
    "transactionType": "exchange",
    "tenantId": "tenant_001",
    "userId": "user_123"
  },
  "payload": {
    "transactionId": "tx_789",
    "amount": 1000.00,
    "currency": "USDT",
    "status": "completed",
    "fees": 1.00
  }
}
```

## Consumer Groups

| Consumer Group | Topics | Description |
|----------------|--------|-------------|
| `thaliumx-backend` | orders, trades, events | Backend API consumers |
| `thaliumx-persistor` | trades, orders, balances, etc. | Dingir persistor for TimescaleDB |
| `thaliumx-notifications` | thaliumx.notifications.* | Notification delivery service |
| `thaliumx-compliance` | thaliumx.audit, thaliumx.compliance | Compliance monitoring |
| `thaliumx-analytics` | thaliumx.transactions, thaliumx.prices | Analytics processing |
| `thaliumx-websocket` | thaliumx.prices, thaliumx.orderbook | WebSocket gateway |

## Configuration

### Producer Configuration
```javascript
{
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
}
```

### Consumer Configuration
```javascript
{
  groupId: 'thaliumx-backend',
  sessionTimeout: 6000,
  enableAutoCommit: false,
  autoOffsetReset: 'earliest'
}
```

### Topic Configuration
```
retention.ms=604800000        # 7 days default
compression.type=snappy       # Efficient compression
segment.bytes=1073741824      # 1GB segments
max.message.bytes=10485760    # 10MB max message
```

## Monitoring

### Key Metrics
- `kafka_consumer_lag` - Consumer lag per partition
- `kafka_producer_request_rate` - Producer request rate
- `kafka_topic_partition_count` - Partitions per topic
- `kafka_broker_io_rate` - Broker I/O rate

### Alerts
- Consumer lag > 10000 messages
- Producer error rate > 1%
- Broker disk usage > 80%
- Under-replicated partitions > 0

## Operations

### Create Topics
```bash
./docker/kafka/init/create-topics.sh
```

### List Topics
```bash
docker exec thaliumx-kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### Describe Topic
```bash
docker exec thaliumx-kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic trades
```

### View Consumer Groups
```bash
docker exec thaliumx-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

### Check Consumer Lag
```bash
docker exec thaliumx-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group thaliumx-backend
```

### Reset Consumer Offset
```bash
docker exec thaliumx-kafka kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group thaliumx-backend --topic trades --reset-offsets --to-earliest --execute
```

## Kafka UI

Access the Kafka UI at: http://localhost:8081

Credentials:
- Username: admin
- Password: ThaliumX2025

Features:
- Topic management
- Consumer group monitoring
- Message browsing
- Cluster health