#!/usr/bin/env bash
set -euo pipefail

# Create Service Account directly via Database
# This is a workaround for local development when console/API access is blocked

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

INSTANCE_ID="353322233650741272"
PROJECT_ID="353322233650937880"

echo "=========================================="
echo "Create Service Account via Database"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This is a workaround for local development."
echo "   Direct database manipulation bypasses Zitadel's event sourcing."
echo "   This should ONLY be used for local dev when console/API access is blocked."
echo ""

# Generate a unique user ID
USER_ID=$(python3 -c "import uuid; print(str(uuid.uuid4()).replace('-', ''))" 2>/dev/null || echo "$(date +%s)$(shuf -i 1000-9999 -n 1)")

# Generate client ID and secret
CLIENT_ID="${USER_ID}@zitadel"
CLIENT_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")

echo "Generated credentials:"
echo "  User ID: $USER_ID"
echo "  Client ID: $CLIENT_ID"
echo "  Client Secret: $CLIENT_SECRET"
echo ""

# This approach is complex because Zitadel uses event sourcing
# We'd need to insert events into the event store, which is risky

echo "Unfortunately, Zitadel uses event sourcing, so we can't easily"
echo "create a service account via direct database inserts without"
echo "understanding the full event structure."
echo ""
echo "Alternative solution: Create a simple OIDC app configuration"
echo "that can be used for testing, or use the Management API once"
echo "we have any form of authentication."
echo ""

# Actually, let's try a different approach - create an OIDC app
# configuration file that can be imported, or provide instructions
# for using curl with proper headers

cat > /tmp/zitadel-access-solution.md <<'EOF'
# Solution for Accessing Zitadel

## Your Situation
- ❌ Can't access from localhost
- ❌ APISIX blocks web access  
- ❌ Don't have console credentials (but we do now!)
- ❌ Password grant not enabled

## Credentials (You Now Have!)
- Username: root@localhost
- Password: Aa1!30ad3716f234d05666ef744b178e

## Solutions

### Solution 1: SSH Port Forwarding (Recommended)

From your local machine:
```bash
ssh -L 8080:localhost:8080 user@your-server-ip
```

Then in your browser:
- Go to: http://localhost:8080
- Login with: root@localhost / Aa1!30ad3716f234d05666ef744b178e
- Create service account manually
- Then use our automation scripts

### Solution 2: Use Backend Container as Proxy

```bash
# Access backend container
docker exec -it thaliumx-backend sh

# From inside, you can access Zitadel
# But you still need a way to interact with the console
```

### Solution 3: Create OIDC App via Database (Advanced)

Since Zitadel uses event sourcing, this is complex. But for local dev,
we could create a minimal OIDC app configuration directly.

### Solution 4: Use Management API with Correct Headers

Once you have ANY service account (even manually created), use:
```bash
node docker/scripts/create-oidc-app-with-service-account.js \
  <client_id> \
  <client_secret>
```

EOF

cat /tmp/zitadel-access-solution.md

echo ""
echo "=========================================="
echo "Recommended: Use SSH Port Forwarding"
echo "=========================================="
echo ""
echo "This is the easiest way to access Zitadel console:"
echo "  1. SSH port forward: ssh -L 8080:localhost:8080 user@server"
echo "  2. Access http://localhost:8080 in browser"
echo "  3. Login with credentials above"
echo "  4. Create service account"
echo "  5. Run automation script"
echo ""
