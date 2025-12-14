#!/bin/bash
# ThaliumX Load Test Runner
# =========================
# Runs Artillery load tests for 100s/1000s of users

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOAD_TEST_DIR="$PROJECT_ROOT/tests/load"

echo "=========================================="
echo "ThaliumX Load Test Runner"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if backend is running
print_status "Checking if backend is running..."
if ! docker ps --filter "name=thaliumx-backend" --format "{{.Names}}" | grep -q "thaliumx-backend"; then
    print_warning "Backend container not running. Starting services..."
    cd "$PROJECT_ROOT/docker"
    docker compose -f compose.yaml up -d backend
    sleep 20
fi

# Set test environment
export TARGET_URL="${TARGET_URL:-http://localhost:3002}"
export METRICS_TOKEN="${METRICS_TOKEN:-thaliumx-metrics-token}"

# Navigate to load test directory
cd "$LOAD_TEST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing Artillery..."
    npm install
fi

# Create reports directory
mkdir -p reports

# Parse test type
TEST_TYPE="${1:-smoke}"
USERS="${2:-100}"

case "$TEST_TYPE" in
    "smoke")
        print_status "Running smoke test (light load)..."
        npx artillery run smoke-test.yml --output reports/smoke-report-$(date +%Y%m%d-%H%M%S).json
        ;;
    "load")
        print_status "Running load test with $USERS users..."
        # Modify arrival rate based on user count
        ARRIVAL_RATE=$((USERS / 10))
        if [ $ARRIVAL_RATE -lt 5 ]; then
            ARRIVAL_RATE=5
        fi
        npx artillery run load-test.yml \
            --overrides "{\"config\":{\"target\":\"$TARGET_URL\",\"phases\":[{\"duration\":300,\"arrivalRate\":$ARRIVAL_RATE,\"name\":\"Load test\"}]}}" \
            --output reports/load-report-$(date +%Y%m%d-%H%M%S).json
        ;;
    "stress")
        print_status "Running stress test with $USERS users..."
        ARRIVAL_RATE=$((USERS / 5))
        if [ $ARRIVAL_RATE -lt 10 ]; then
            ARRIVAL_RATE=10
        fi
        npx artillery run load-test.yml \
            --overrides "{\"config\":{\"target\":\"$TARGET_URL\",\"phases\":[{\"duration\":600,\"arrivalRate\":$ARRIVAL_RATE,\"rampTo\":$((ARRIVAL_RATE * 2)),\"name\":\"Stress test\"}]}}" \
            --output reports/stress-report-$(date +%Y%m%d-%H%M%S).json
        ;;
    "spike")
        print_status "Running spike test with $USERS users..."
        npx artillery run load-test.yml \
            --overrides "{\"config\":{\"target\":\"$TARGET_URL\",\"phases\":[{\"duration\":60,\"arrivalRate\":$USERS,\"name\":\"Spike test\"}]}}" \
            --output reports/spike-report-$(date +%Y%m%d-%H%M%S).json
        ;;
    "custom")
        print_status "Running custom load test..."
        if [ -z "$3" ]; then
            print_warning "Custom test file not specified. Using default load-test.yml"
            TEST_FILE="load-test.yml"
        else
            TEST_FILE="$3"
        fi
        npx artillery run "$TEST_FILE" \
            --overrides "{\"config\":{\"target\":\"$TARGET_URL\"}}" \
            --output reports/custom-report-$(date +%Y%m%d-%H%M%S).json
        ;;
    *)
        echo "Usage: $0 [smoke|load|stress|spike|custom] [users] [custom-file]"
        echo ""
        echo "Examples:"
        echo "  $0 smoke                    # Light smoke test"
        echo "  $0 load 100                 # Load test with 100 users"
        echo "  $0 stress 500               # Stress test with 500 users"
        echo "  $0 spike 1000                # Spike test with 1000 users"
        echo "  $0 custom 200 custom.yml    # Custom test with 200 users"
        exit 1
        ;;
esac

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "Load test completed!"
    echo ""
    echo "View latest report:"
    LATEST_REPORT=$(ls -t reports/*.json | head -1)
    if [ -n "$LATEST_REPORT" ]; then
        echo "  npx artillery report $LATEST_REPORT --output reports/latest-report.html"
        echo "  Then open: reports/latest-report.html"
    fi
else
    print_warning "Load test failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE

