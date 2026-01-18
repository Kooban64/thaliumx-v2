# Kafka Topics Summary

## Answer to Your Questions

### 1. Have we loaded all the topics into Kafka?
**❌ NO** - Topics are NOT loaded because:
- Kafka broker is not running
- Backend can't connect to create topics
- Topic creation code exists but never executes

### 2. Why is Kafka failing?
**Root Cause**: Kafka broker container (`thaliumx-kafka`) is not running
- Backend tries to connect to `thaliumx-kafka:9092`
- Container doesn't exist → DNS resolution fails
- Connection errors: `getaddrinfo EAI_AGAIN thaliumx-kafka`

## Topics That Should Be Created

The backend defines **30+ topics** in `EventStreamingService.createTopics()`:

### Complete Topic List (30+ topics)

1. **Backend Application Topics** (6)
   - `thaliumx.audit` - Audit logs (90 days)
   - `thaliumx.transactions` - Transactions (90 days)
   - `thaliumx.system` - System events (7 days)
   - `thaliumx.compliance` - Compliance (1 year)
   - `thaliumx.alerts` - Alerts (30 days)
   - `thaliumx.health` - Health checks (1 day)

2. **Market Data Topics** (5)
   - `thaliumx.prices` - Price updates
   - `thaliumx.orderbook` - Order book
   - `thaliumx.klines` - Candlesticks
   - `thaliumx.ticker` - Ticker data
   - `thaliumx.market-stats` - Market stats

3. **Notification Topics** (4)
   - `thaliumx.notifications.email`
   - `thaliumx.notifications.sms`
   - `thaliumx.notifications.push`
   - `thaliumx.notifications.inapp`

4. **KYC/AML Topics** (4)
   - `thaliumx.kyc.requests`
   - `thaliumx.kyc.results`
   - `thaliumx.aml.screening`
   - `thaliumx.risk.assessment`

5. **Blockchain Topics** (4)
   - `thaliumx.blockchain.transactions`
   - `thaliumx.blockchain.confirmations`
   - `thaliumx.blockchain.contracts`
   - `thaliumx.blockchain.wallets`

6. **Dead Letter Queues** (3)
   - `thaliumx.dlq.general`
   - `thaliumx.dlq.transactions`
   - `thaliumx.dlq.notifications`

7. **State Storage Topics** (4+)
   - `thaliumx.state.users` (log-compacted)
   - `thaliumx.state.balances` (log-compacted)
   - `thaliumx.state.markets` (log-compacted)
   - `thaliumx.state.config` (log-compacted)

**Total**: ~30+ topics

## How Topics Are Created

### Automatic Creation
- **Location**: `docker/backend/src/services/event-streaming.ts`
- **Method**: `createTopics()` (line 707)
- **Trigger**: Called during `EventStreamingService.initialize()`
- **When**: After successful Kafka connection

### Process
1. Backend connects to Kafka
2. Lists existing topics
3. Compares with required topics
4. Creates missing topics with optimal config:
   - Partition count (1-6 based on throughput)
   - Replication factor (default: 3, but can be 1 for dev)
   - Retention policies
   - Compression (snappy/lz4)
   - Cleanup policies

### Current Status
- ❌ **Not executed** - Kafka connection fails before topic creation
- ❌ **Topics don't exist** - Can't create without Kafka
- ✅ **Code is ready** - Will auto-create once Kafka is available

## Solution

### Start Kafka
```bash
cd /home/ubuntu/thaliumx-v1
KAFKA_UI_PASSWORD=admin123 docker compose -f docker/kafka/compose.yaml up -d kafka
```

### Verify Kafka is Running
```bash
docker ps | grep kafka
# Should see: thaliumx-kafka
```

### Check Topics (after Kafka starts)
```bash
# Wait for backend to create topics (happens automatically)
docker exec thaliumx-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Or Disable Kafka (if not needed)
Set in `docker/core/compose.yaml`:
```yaml
- ENABLE_KAFKA=false
```

## Impact

### Without Kafka
- ✅ Backend runs successfully
- ✅ Core features work
- ❌ Event streaming disabled
- ❌ Kafka-based notifications disabled
- ⚠️ Warnings in logs (but non-critical)

### With Kafka
- ✅ All topics auto-created
- ✅ Event streaming enabled
- ✅ Real-time notifications
- ✅ Event sourcing
- ✅ Complete audit trail

## Conclusion

- **Topics**: 30+ topics defined, but NOT created (Kafka not running)
- **Why failing**: Kafka broker container not started
- **Solution**: Start Kafka or disable it
- **For E2E testing**: Kafka is optional - backend works without it
