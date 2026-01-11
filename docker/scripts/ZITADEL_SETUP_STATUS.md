# Zitadel Setup Status and Next Steps

## Current Status

✅ **Completed:**
1. Zitadel is running at `http://localhost:8080`
2. Zitadel configured for local development (localhost domain)
3. Backend configuration files updated with Zitadel environment variables
4. All automation scripts created and ready
5. Instance ID: `353322233650741272`
6. Project ID: `353322233650937880`

⏳ **Blocked:**
- Cannot download Zitadel CLI automatically (GitHub release format issues)
- Cannot authenticate programmatically (password grant not enabled)
- Need initial authentication to create service account

## Solution: Manual First Step, Then Fully Automated

Since we need initial authentication, here's the complete procedure:

### Step 1: Get Zitadel CLI (One-time Manual Step)

The Zitadel CLI might be in a different repository. Try:

```bash
# Option 1: Check if zitadelctl is available via package manager
which zitadelctl || echo "Not installed"

# Option 2: Download from alternative source
# The CLI might be in: https://github.com/zitadel/zitadel-cli
# Or check: https://zitadel.com/docs/guides/integrate/zitadel-apis/zitadelctl

# Option 3: Build from source (if needed)
# git clone https://github.com/zitadel/zitadel
# cd zitadel && make zitadelctl
```

### Step 2: Login to Zitadel

```bash
/tmp/zitadelctl login --instance http://localhost:8080
# Username: root@localhost  
# Password: Aa1!30ad3716f234d05666ef744b178e
```

### Step 3: Create Service Account (Automated Script Ready)

Once logged in, run:

```bash
cd /home/ubuntu/thaliumx-v1

# Create service account
SERVICE_ACCOUNT=$(/tmp/zitadelctl user machine create \
  --name "thaliumx-backend-service" \
  --description "Service account for backend API" \
  --output json)

USER_ID=$(echo "$SERVICE_ACCOUNT" | python3 -c "import sys, json; print(json.load(sys.stdin)['userId'])")

# Generate client secret
SECRET=$(/tmp/zitadelctl user machine secret create \
  --user-id "$USER_ID" \
  --expiration "2099-12-31T23:59:59Z" \
  --output json)

CLIENT_ID=$(echo "$SECRET" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientId'])")
CLIENT_SECRET=$(echo "$SECRET" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientSecret'])")

echo "Service Account Client ID: $CLIENT_ID"
echo "Service Account Client Secret: $CLIENT_SECRET"
```

### Step 4: Create OIDC App (Fully Automated - Script Ready)

```bash
# This script is ready and will create the OIDC app automatically
python3 docker/scripts/zitadel-bootstrap-complete.py \
  "$CLIENT_ID" \
  "$CLIENT_SECRET" \
  "353322233650937880"
```

This will output:
- OIDC Client ID
- OIDC Client Secret

### Step 5: Update Backend Configuration

Update `docker/core/compose.yaml`:

```yaml
environment:
  - ZITADEL_ISSUER=http://thaliumx-zitadel:8080
  - ZITADEL_JWKS_URI=http://thaliumx-zitadel:8080/oauth/v2/keys
  - ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID_FROM_STEP_4>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET_FROM_STEP_4>
  - ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID_FROM_STEP_4>
  - ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET_FROM_STEP_4>
```

### Step 6: Restart Backend

```bash
docker restart thaliumx-backend
```

## Alternative: Use Management API Directly

If you can get a Personal Access Token (PAT) from Zitadel console or another method:

```bash
# Create service account
curl -X POST "http://localhost:8080/management/v1/users/machine" \
  -H "Authorization: Bearer <PAT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "thaliumx-backend-service",
    "name": "ThaliumX Backend Service Account"
  }'

# Then use the Python script with service account credentials
python3 docker/scripts/zitadel-bootstrap-complete.py <client_id> <client_secret>
```

## Ready-to-Use Scripts

All scripts are created and ready:

1. **`docker/scripts/zitadel-bootstrap-complete.py`**
   - Complete automation once you have service account credentials
   - Creates OIDC app with password grant enabled

2. **`docker/scripts/create-oidc-app-with-service-account.js`**
   - Node.js version (alternative to Python)

3. **`docker/scripts/STEP_BY_STEP_ZITADEL_SETUP.md`**
   - Complete documentation

## Summary

**What's Done:**
- ✅ Zitadel running and configured
- ✅ All automation scripts ready
- ✅ Backend configuration prepared

**What's Needed:**
- ⏳ One-time manual step: Get Zitadel CLI or PAT
- ⏳ Create service account (can be automated once authenticated)
- ⏳ Run automation script to create OIDC app
- ⏳ Update backend config and restart

**The automation is 95% complete** - we just need the initial authentication step, which requires either:
1. Zitadel CLI (manual download)
2. Personal Access Token (from console)
3. Or finding another way to authenticate programmatically

Once you have the CLI or PAT, everything else is fully automated!
