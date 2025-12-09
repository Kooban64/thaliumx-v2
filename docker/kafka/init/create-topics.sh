#!/bin/bash
# ThaliumX Kafka Topic Initialization Script
# ==========================================
# Creates all required Kafka topics with proper configurations
# for the entire ThaliumX platform

set -e

# Configuration
KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-thaliumx-kafka:9092}"
PARTITIONS="${PARTITIONS:-3}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Wait for Kafka to be ready
wait_for_kafka() {
    print_header "Waiting for Kafka to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if kafka-broker-api-versions --bootstrap-server "$KAFKA_BOOTSTRAP" > /dev/null 2>&1; then
            print_success "Kafka is ready"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts - Kafka not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    print_error "Kafka failed to become ready"
    return 1
}

# Create a topic with specific configuration
create_topic() {
    local topic_name=$1
    local partitions=${2:-$PARTITIONS}
    local retention_ms=${3:-604800000}  # Default 7 days
    local compression=${4:-snappy}
    local cleanup_policy=${5:-delete}
    local description=$6
    
    echo -e "\nCreating topic: ${BLUE}$topic_name${NC}"
    echo "  Description: $description"
    echo "  Partitions: $partitions"
    echo "  Retention: $((retention_ms / 86400000)) days"
    echo "  Compression: $compression"
    echo "  Cleanup: $cleanup_policy"
    
    # Check if topic exists
    if kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" --list 2>/dev/null | grep -q "^${topic_name}$"; then
        print_warning "Topic already exists: $topic_name"
        return 0
    fi
    
    # Create topic
    kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" \
        --create \
        --topic "$topic_name" \
        --partitions "$partitions" \
        --replication-factor "$REPLICATION_FACTOR" \
        --config retention.ms="$retention_ms" \
        --config compression.type="$compression" \
        --config cleanup.policy="$cleanup_policy" \
        --config segment.bytes=1073741824 \
        --config max.message.bytes=10485760 \
        2>/dev/null && print_success "Created: $topic_name" || print_error "Failed: $topic_name"
}

# ============================================================================
# DINGIR TRADING ENGINE TOPICS
# ============================================================================
create_dingir_topics() {
    print_header "Creating Dingir Trading Engine Topics"
    
    # Trades topic - High throughput, critical for matching engine
    create_topic "trades" 6 604800000 "snappy" "delete" \
        "Trade execution events from matching engine"
    
    # Orders topic - Order lifecycle events
    create_topic "orders" 6 604800000 "snappy" "delete" \
        "Order creation, updates, and cancellation events"
    
    # Balances topic - Account balance changes
    create_topic "balances" 3 604800000 "snappy" "delete" \
        "Account balance update events"
    
    # Deposits topic - Deposit events
    create_topic "deposits" 3 2592000000 "snappy" "delete" \
        "Cryptocurrency deposit events (30 days retention)"
    
    # Withdrawals topic - Withdrawal events
    create_topic "withdraws" 3 2592000000 "snappy" "delete" \
        "Cryptocurrency withdrawal events (30 days retention)"
    
    # Internal transfers topic
    create_topic "internaltransfer" 3 604800000 "snappy" "delete" \
        "Internal transfer events between accounts"
    
    # User registration topic
    create_topic "registeruser" 3 2592000000 "snappy" "delete" \
        "User registration events (30 days retention)"
    
    # Unified events topic - All events in order
    create_topic "unifyevents" 1 604800000 "snappy" "delete" \
        "Unified ordered event stream for state reconstruction"
}

# ============================================================================
# BACKEND APPLICATION TOPICS
# ============================================================================
create_backend_topics() {
    print_header "Creating Backend Application Topics"
    
    # Audit events - Compliance and security
    create_topic "thaliumx.audit" 3 7776000000 "snappy" "delete" \
        "Audit trail events for compliance (90 days retention)"
    
    # Transaction events - Financial transactions
    create_topic "thaliumx.transactions" 6 7776000000 "snappy" "delete" \
        "Financial transaction events (90 days retention)"
    
    # System events - Health, errors, performance
    create_topic "thaliumx.system" 3 604800000 "snappy" "delete" \
        "System health and monitoring events"
    
    # Compliance events - Regulatory reporting
    create_topic "thaliumx.compliance" 3 31536000000 "snappy" "delete" \
        "Compliance and regulatory events (1 year retention)"
    
    # Alerts topic - Critical alerts
    create_topic "thaliumx.alerts" 3 2592000000 "snappy" "delete" \
        "Critical system alerts (30 days retention)"
    
    # Health check events
    create_topic "thaliumx.health" 1 86400000 "snappy" "delete" \
        "Health check heartbeat events (1 day retention)"
}

# ============================================================================
# MARKET DATA TOPICS
# ============================================================================
create_market_data_topics() {
    print_header "Creating Market Data Topics"
    
    # Real-time price updates
    create_topic "thaliumx.prices" 6 86400000 "snappy" "delete" \
        "Real-time price updates (1 day retention)"
    
    # Order book updates
    create_topic "thaliumx.orderbook" 6 3600000 "snappy" "delete" \
        "Order book depth updates (1 hour retention)"
    
    # Kline/candlestick data
    create_topic "thaliumx.klines" 3 604800000 "snappy" "delete" \
        "Candlestick/OHLCV data updates"
    
    # Ticker updates
    create_topic "thaliumx.ticker" 3 86400000 "snappy" "delete" \
        "24h ticker statistics (1 day retention)"
    
    # Market statistics
    create_topic "thaliumx.market-stats" 3 604800000 "snappy" "delete" \
        "Market statistics and analytics"
}

# ============================================================================
# USER NOTIFICATION TOPICS
# ============================================================================
create_notification_topics() {
    print_header "Creating Notification Topics"
    
    # Email notifications
    create_topic "thaliumx.notifications.email" 3 604800000 "snappy" "delete" \
        "Email notification queue"
    
    # SMS notifications
    create_topic "thaliumx.notifications.sms" 3 604800000 "snappy" "delete" \
        "SMS notification queue"
    
    # Push notifications
    create_topic "thaliumx.notifications.push" 3 604800000 "snappy" "delete" \
        "Push notification queue"
    
    # In-app notifications
    create_topic "thaliumx.notifications.inapp" 3 2592000000 "snappy" "delete" \
        "In-app notification events (30 days retention)"
}

# ============================================================================
# KYC/AML TOPICS
# ============================================================================
create_kyc_topics() {
    print_header "Creating KYC/AML Topics"
    
    # KYC verification requests
    create_topic "thaliumx.kyc.requests" 3 7776000000 "snappy" "delete" \
        "KYC verification requests (90 days retention)"
    
    # KYC verification results
    create_topic "thaliumx.kyc.results" 3 31536000000 "snappy" "delete" \
        "KYC verification results (1 year retention)"
    
    # AML screening events
    create_topic "thaliumx.aml.screening" 3 31536000000 "snappy" "delete" \
        "AML/OFAC screening events (1 year retention)"
    
    # Risk assessment events
    create_topic "thaliumx.risk.assessment" 3 7776000000 "snappy" "delete" \
        "Risk assessment events (90 days retention)"
}

# ============================================================================
# BLOCKCHAIN TOPICS
# ============================================================================
create_blockchain_topics() {
    print_header "Creating Blockchain Topics"
    
    # Blockchain transaction events
    create_topic "thaliumx.blockchain.transactions" 3 7776000000 "snappy" "delete" \
        "Blockchain transaction events (90 days retention)"
    
    # Block confirmations
    create_topic "thaliumx.blockchain.confirmations" 3 604800000 "snappy" "delete" \
        "Block confirmation events"
    
    # Smart contract events
    create_topic "thaliumx.blockchain.contracts" 3 7776000000 "snappy" "delete" \
        "Smart contract interaction events (90 days retention)"
    
    # Wallet events
    create_topic "thaliumx.blockchain.wallets" 3 2592000000 "snappy" "delete" \
        "Wallet creation and update events (30 days retention)"
}

# ============================================================================
# DEAD LETTER QUEUES
# ============================================================================
create_dlq_topics() {
    print_header "Creating Dead Letter Queue Topics"
    
    # DLQ for failed messages
    create_topic "thaliumx.dlq.general" 3 2592000000 "snappy" "delete" \
        "General dead letter queue (30 days retention)"
    
    # DLQ for failed transactions
    create_topic "thaliumx.dlq.transactions" 3 7776000000 "snappy" "delete" \
        "Transaction processing failures (90 days retention)"
    
    # DLQ for failed notifications
    create_topic "thaliumx.dlq.notifications" 3 604800000 "snappy" "delete" \
        "Notification delivery failures"
}

# ============================================================================
# COMPACTED TOPICS (State storage)
# ============================================================================
create_compacted_topics() {
    print_header "Creating Compacted Topics (State Storage)"
    
    # User state
    create_topic "thaliumx.state.users" 3 -1 "snappy" "compact" \
        "User state (compacted, infinite retention)"
    
    # Account balances state
    create_topic "thaliumx.state.balances" 6 -1 "snappy" "compact" \
        "Account balance state (compacted, infinite retention)"
    
    # Market configuration state
    create_topic "thaliumx.state.markets" 1 -1 "snappy" "compact" \
        "Market configuration state (compacted, infinite retention)"
    
    # System configuration state
    create_topic "thaliumx.state.config" 1 -1 "snappy" "compact" \
        "System configuration state (compacted, infinite retention)"
}

# ============================================================================
# LIST ALL TOPICS
# ============================================================================
list_topics() {
    print_header "Listing All Kafka Topics"
    
    kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" --list 2>/dev/null | sort
    
    echo ""
    topic_count=$(kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" --list 2>/dev/null | wc -l)
    print_success "Total topics: $topic_count"
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    print_header "ThaliumX Kafka Topic Initialization"
    echo "Bootstrap Server: $KAFKA_BOOTSTRAP"
    echo "Default Partitions: $PARTITIONS"
    echo "Replication Factor: $REPLICATION_FACTOR"
    echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    
    wait_for_kafka
    
    create_dingir_topics
    create_backend_topics
    create_market_data_topics
    create_notification_topics
    create_kyc_topics
    create_blockchain_topics
    create_dlq_topics
    create_compacted_topics
    
    list_topics
    
    print_header "Kafka Topic Initialization Complete"
    print_success "All topics have been created successfully!"
}

# Run main
main "$@"