# Kafka Status and Topics Analysis

**Date**: 2026-01-14  
**Status**: ⚠️ Kafka Broker Not Running

## Current Status

### Kafka Containers
- ✅ **thaliumx-kafka-ui** - Running (UI only, not the broker)
- ❌ **thaliumx-kafka** - **NOT RUNNING** (the actual Kafka broker)

### Backend Configuration
- **KAFKA_BROKERS**: `thaliumx-kafka:9092`
- **ENABLE_KAFKA**: `true`
- **Connection**: Failing with `getaddrinfo EAI_AGAIN thaliumx-kafka`

## Why Kafka is Failing

### Root Cause
1. **Kafka broker container doesn't exist or isn't running**
   - Backend tries to connect to `thaliumx-kafka:9092`
   - Container `thaliumx-kafka` is not found
   - DNS resolution fails: `getaddrinfo EAI_AGAIN thaliumx-kafka`

2. **Topics are NOT loaded**
   - Backend has code to auto-create topics in `EventStreamingService.createTopics()`
   - But this code never runs because Kafka connection fails during initialization
   - Topics are only created after successful Kafka connection

3. **Backend handles failure gracefully**
   - Backend continues running despite Kafka failures
   - Logs warnings instead of crashing
   - Other services initialize successfully

## Topics That Should Be Created

The backend defines **30+ topics** that should be auto-created when Kafka is available:

### Backend Application Topics (6)
1. `thaliumx.audit` - Audit logs (90 days retention)
2. `thaliumx.transactions` - Financial transactions (90 days)
3. `thaliumx.system` - System events (7 days)
4. `thaliumx.compliance` - Compliance events (1 year)
5. `thaliumx.alerts` - Security alerts (30 days)
6. `thaliumx.health` - Health checks (1 day)

### Market Data Topics (5)
7. `thaliumx.prices` - Price updates
8. `thaliumx.orderbook` - Order book snapshots
9. `thaliumx.klines` - Candlestick data
10. `thaliumx.ticker` - Ticker updates
11. `thaliumx.market-stats` - Market statistics

### Notification Topics (4)
12. `thaliumx.notifications.email` - Email notifications
13. `thaliumx.notifications.sms` - SMS notifications
14. `thaliumx.notifications.push` - Push notifications
15. `thaliumx.notifications.inapp` - In-app notifications

### KYC/AML Topics (4)
16. `thaliumx.kyc.requests` - KYC requests
17. `thaliumx.kyc.results` - KYC results
18. `thaliumx.aml.screening` - AML screening events
19. `thaliumx.risk.assessment` - Risk assessments

### Blockchain Topics (4)
20. `thaliumx.blockchain.transactions` - Blockchain transactions
21. `thaliumx.blockchain.confirmations` - Transaction confirmations
22. `thaliumx.blockchain.contracts` - Smart contract events
23. `thaliumx.blockchain.wallets` - Wallet events

### Dead Letter Queues (3)
24. `thaliumx.dlq.general` - General DLQ
25. `thaliumx.dlq.transactions` - Transaction DLQ
26. `thaliumx.dlq.notifications` - Notification DLQ

### State Storage Topics (2+)
27. `thaliumx.state.users` - User state (log-compacted)
28. `thaliumx.state.balances` - Balance state (log-compacted)
... and more

**Total**: ~30+ topics defined in `EventStreamingService.TOPICS`

## Topic Creation Code

### Location
- **File**: `docker/backend/src/services/event-streaming.ts`
- **Method**: `createTopics()` (line 707)
- **Called from**: `initialize()` (line 259)

### How It Works
1. Backend connects to Kafka
2. Lists existing topics
3. Creates missing topics with optimal configuration:
   - Partition count based on throughput
   - Replication factor (default: 3)
   - Retention policies
   - Compression (snappy)
   - Cleanup policies

### Current Status
- ❌ **Topics NOT created** - Kafka connection fails before topic creation
- ❌ **Auto-creation disabled** - `allowAutoTopicCreation: false` in consumer config

## Solutions

### Option 1: Start Kafka Broker (Recommended if needed)

If you need Kafka functionality:

1. **Check if Kafka service exists in docker-compose**:
   ```bash
   grep -r "kafka:" docker/
   ```

2. **Start Kafka** (if service exists):
   ```bash
   cd docker/core
   docker compose up -d kafka
   ```

3. **Or add Kafka service** to `docker/core/compose.yaml`:
   ```yaml
   kafka:
     image: confluentinc/cp-kafka:latest
     container_name: thaliumx-kafka
     environment:
       KAFKA_BROKER_ID: 1
       KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
       KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://thaliumx-kafka:9092
       KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
     networks:
       - thaliumx-net
   ```

4. **Backend will auto-create topics** once Kafka is available

### Option 2: Disable Kafka (If not needed)

If Kafka is not required for current functionality:

1. **Set environment variable**:
   ```yaml
   - ENABLE_KAFKA=false
   ```

2. **Backend will skip Kafka initialization**
   - No connection attempts
   - No topic creation
   - No warnings

### Option 3: Use External Kafka

If you have external Kafka:

1. **Update KAFKA_BROKERS**:
   ```yaml
   - KAFKA_BROKERS=external-kafka:9092
   ```

2. **Backend will connect and create topics**

## Verification

### Check if Kafka is running:
```bash
docker ps | grep kafka
```

### Check if topics exist (when Kafka is running):
```bash
docker exec thaliumx-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Check backend logs for topic creation:
```bash
docker logs thaliumx-backend | grep -i "topic\|kafka"
```

## Current Impact

### What Works
- ✅ Backend runs successfully
- ✅ All core services operational
- ✅ API endpoints functional
- ✅ Database and Redis connected

### What Doesn't Work
- ❌ Event streaming to Kafka
- ❌ Kafka-based notifications
- ❌ Event sourcing features
- ❌ Real-time event processing

### Is Kafka Required?
- **For basic functionality**: ❌ No
- **For event streaming**: ✅ Yes
- **For notifications**: ⚠️ Optional (can use other methods)
- **For audit logging**: ⚠️ Optional (database logging works)

## Recommendation

**For E2E Testing**: Kafka is **NOT required**
- Backend handles Kafka failures gracefully
- All core features work without Kafka
- E2E tests can continue

**For Production**: Kafka **IS recommended**
- Event streaming for scalability
- Real-time notifications
- Event sourcing
- Audit trail via Kafka

## Next Steps

1. **For now**: Continue with E2E testing (Kafka not needed)
2. **Later**: Set up Kafka if event streaming is required
3. **Or**: Disable Kafka warnings by setting `ENABLE_KAFKA=false`

## Conclusion

- ❌ **Kafka broker is not running** - that's why it's failing
- ❌ **Topics are not loaded** - can't create topics without Kafka
- ✅ **Backend handles this gracefully** - continues running
- ✅ **E2E tests can proceed** - Kafka is optional for basic functionality

The backend is designed to work without Kafka, so the current setup is fine for testing.
