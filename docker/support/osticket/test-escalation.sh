#!/bin/bash
# Test script for osTicket chat escalation endpoint

API_URL="${API_URL:-http://localhost:80/escalate-chat.php}"
API_KEY="${API_KEY:-test-key}"

echo "Testing osTicket chat escalation endpoint..."
echo "API URL: $API_URL"

# Test data
TEST_DATA='{
  "chat_id": "test-chat-123",
  "user_id": "test-user-456",
  "subject": "Test trading issue",
  "message": "User is having trouble with BTC trading",
  "priority": "normal",
  "issue_type": "trade_execution",
  "trading_pair": "BTCUSD",
  "order_id": "order-789",
  "department": "Trading Support"
}'

echo "Test data:"
echo "$TEST_DATA"
echo ""

# Make the request
echo "Making POST request..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-LHC-API-KEY: $API_KEY" \
  -d "$TEST_DATA")

echo "Response:"
echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✓ Escalation test PASSED"
  TICKET_ID=$(echo "$RESPONSE" | grep -o '"ticket_id":[0-9]*' | cut -d':' -f2)
  TICKET_NUMBER=$(echo "$RESPONSE" | grep -o '"ticket_number":"[^"]*"' | cut -d'"' -f4)
  echo "  Ticket ID: $TICKET_ID"
  echo "  Ticket Number: $TICKET_NUMBER"
  exit 0
else
  echo "✗ Escalation test FAILED"
  exit 1
fi