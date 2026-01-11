# Step-by-Step Programmatic Zitadel OIDC App Creation

## Complete Automated Procedure

This document provides a step-by-step procedure to create a Zitadel OIDC application entirely programmatically.

## Prerequisites

- ✅ Zitadel running at `http://localhost:8080`
- ✅ Instance ID: `353322233650741272`
- ✅ Project ID: `353322233650937880`
- ✅ Root user: `root@localhost`
- ✅ Root password: `Aa1!30ad3716f234d05666ef744b178e` (from `.secrets/generated/zitadel-firstadmin-password`)

## Step 1: Get Initial Authentication

The challenge is that we need authentication to use the Management API, but we need the Management API to create a service account. We'll use Zitadel CLI to break this cycle.

### Option A: Use Zitadel CLI (Recommended)

```bash
# Download Zitadel CLI
cd /home/ubuntu/thaliumx-v1
curl -L "https://github.com/zitadel/zitadel/releases/download/v2.43.11/zitadelctl_2.43.11_linux_amd64.tar.gz" \
  -o /tmp/zitadelctl.tar.gz

# Extract and make executable
tar -xzf /tmp/zitadelctl.tar.gz -C /tmp
chmod +x /tmp/zitadelctl

# Verify installation
/tmp/zitadelctl version
```

### Step 1.1: Login to Zitadel

```bash
# Login using root user
/tmp/zitadelctl login --instance http://localhost:8080

# When prompted:
# Username: root@localhost
# Password: Aa1!30ad3716f234d05666ef744b178e
```

## Step 2: Create Service Account

```bash
# Create a machine user (service account)
SERVICE_ACCOUNT_RESPONSE=$(/tmp/zitadelctl user machine create \
  --name "thaliumx-backend-service" \
  --description "Service account for backend API authentication" \
  --output json)

# Extract user ID
SERVICE_ACCOUNT_USER_ID=$(echo "$SERVICE_ACCOUNT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['userId'])")

echo "Service Account User ID: $SERVICE_ACCOUNT_USER_ID"
```

## Step 3: Generate Client Secret for Service Account

```bash
# Generate client secret
SECRET_RESPONSE=$(/tmp/zitadelctl user machine secret create \
  --user-id "$SERVICE_ACCOUNT_USER_ID" \
  --expiration "2099-12-31T23:59:59Z" \
  --output json)

# Extract client ID and secret
SERVICE_ACCOUNT_CLIENT_ID=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientId'])")
SERVICE_ACCOUNT_CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientSecret'])")

echo "Service Account Client ID: $SERVICE_ACCOUNT_CLIENT_ID"
echo "Service Account Client Secret: $SERVICE_ACCOUNT_CLIENT_SECRET"
```

**⚠️ IMPORTANT**: Save these credentials securely! The client secret won't be shown again.

## Step 4: Create OIDC Application Using Service Account

Now we can use the service account to create the OIDC app programmatically:

```bash
cd /home/ubuntu/thaliumx-v1

# Use our Node.js script to create the OIDC app
node docker/scripts/create-oidc-app-with-service-account.js \
  "$SERVICE_ACCOUNT_CLIENT_ID" \
  "$SERVICE_ACCOUNT_CLIENT_SECRET" \
  "353322233650937880"
```

This script will:
1. Authenticate using the service account (client credentials flow)
2. Get an access token with management scope
3. Create the OIDC application via Management API
4. Output the client ID and secret for the OIDC app

## Step 5: Update Backend Configuration

From the output of Step 4, you'll get:
- OIDC Client ID
- OIDC Client Secret

Update `docker/core/compose.yaml`:

```yaml
environment:
  - ZITADEL_ISSUER=http://thaliumx-zitadel:8080
  - ZITADEL_JWKS_URI=http://thaliumx-zitadel:8080/oauth/v2/keys
  - ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET>
  - ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>
```

Or set environment variables:

```bash
export ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID>
export ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET>
export ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>
export ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>
```

## Step 6: Restart Backend

```bash
docker restart thaliumx-backend
```

## Step 7: Verify Setup

```bash
# Check backend logs for Zitadel initialization
docker logs thaliumx-backend | grep -i zitadel

# Look for:
# - ✅ Zitadel credentials loaded
# - No errors about "client not found"
# - No errors about "password not supported"
```

## Complete One-Liner Script

Here's a complete script that does everything:

```bash
#!/bin/bash
set -euo pipefail

cd /home/ubuntu/thaliumx-v1

# Step 1: Download and setup Zitadel CLI
curl -L "https://github.com/zitadel/zitadel/releases/download/v2.43.11/zitadelctl_2.43.11_linux_amd64.tar.gz" \
  -o /tmp/zitadelctl.tar.gz
tar -xzf /tmp/zitadelctl.tar.gz -C /tmp
chmod +x /tmp/zitadelctl

# Step 2: Login (interactive - you'll need to enter password)
echo "Please login to Zitadel:"
/tmp/zitadelctl login --instance http://localhost:8080

# Step 3: Create service account
echo "Creating service account..."
SERVICE_ACCOUNT_RESPONSE=$(/tmp/zitadelctl user machine create \
  --name "thaliumx-backend-service" \
  --description "Service account for backend API" \
  --output json)
SERVICE_ACCOUNT_USER_ID=$(echo "$SERVICE_ACCOUNT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['userId'])")

# Step 4: Generate client secret
echo "Generating client secret..."
SECRET_RESPONSE=$(/tmp/zitadelctl user machine secret create \
  --user-id "$SERVICE_ACCOUNT_USER_ID" \
  --expiration "2099-12-31T23:59:59Z" \
  --output json)
SERVICE_ACCOUNT_CLIENT_ID=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientId'])")
SERVICE_ACCOUNT_CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientSecret'])")

# Step 5: Create OIDC app
echo "Creating OIDC application..."
node docker/scripts/create-oidc-app-with-service-account.js \
  "$SERVICE_ACCOUNT_CLIENT_ID" \
  "$SERVICE_ACCOUNT_CLIENT_SECRET" \
  "353322233650937880"

echo ""
echo "✅ Setup complete! Update backend configuration with the OIDC credentials shown above."
```

## Alternative: Using Management API Directly with curl

If you prefer using curl instead of the Node.js script:

```bash
# Step 1: Get access token
ACCESS_TOKEN=$(curl -s -X POST "http://localhost:8080/oauth/v2/token" \
  -u "$SERVICE_ACCOUNT_CLIENT_ID:$SERVICE_ACCOUNT_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=urn:zitadel:iam:org:project:id:zitadel:management" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Step 2: Create OIDC app
curl -X POST "http://localhost:8080/management/v1/projects/353322233650937880/apps/oidc" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "thaliumx-backend-local",
    "redirectUris": ["http://localhost:3000/callback"],
    "responseTypes": ["TOKEN"],
    "grantTypes": ["PASSWORD", "CLIENT_CREDENTIALS"],
    "authMethodType": "CLIENT_SECRET_BASIC",
    "accessTokenType": "ACCESS_TOKEN_TYPE_BEARER",
    "devMode": true
  }' | python3 -m json.tool
```

## Summary

The complete programmatic procedure:

1. ✅ **Zitadel running** (DONE)
2. ⏳ **Get Zitadel CLI** → Download and install
3. ⏳ **Login to Zitadel** → Use root user credentials
4. ⏳ **Create service account** → Using CLI
5. ⏳ **Generate client secret** → Using CLI
6. ⏳ **Create OIDC app** → Using Node.js script or curl with service account
7. ⏳ **Update backend config** → Set environment variables
8. ⏳ **Restart backend** → Apply changes
9. ⏳ **Verify** → Check logs and test login

The only manual step is the initial login (Step 3), which requires entering the password. Everything else is fully automated!
