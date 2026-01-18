#!/bin/bash

# Production Authentication Verification Script
# 
# This script verifies that registration and login work from a real browser
# on the production domain (thaliumx.com)
#
# Usage:
#   ./verify-production-auth.sh
#   PRODUCTION_URL=https://thaliumx.com ./verify-production-auth.sh

set -e

# Default to production URL if not specified
PRODUCTION_URL=${PRODUCTION_URL:-"https://thaliumx.com"}

echo "============================================================"
echo "🧪 PRODUCTION AUTHENTICATION VERIFICATION"
echo "============================================================"
echo "🌐 Testing against: $PRODUCTION_URL"
echo "============================================================"
echo ""

# Change to frontend directory
cd "$(dirname "$0")"

# Run the test
PRODUCTION_URL="$PRODUCTION_URL" npm run test:e2e -- \
  e2e/production-auth-verification.spec.ts \
  --project=chromium \
  --workers=1 \
  --timeout=120000

echo ""
echo "============================================================"
echo "✅ Verification Complete"
echo "============================================================"
