# Zitadel Local Development Setup Guide

## Current Issues

1. **Password grant not supported**: Zitadel v2 requires an OIDC application to be created with password grant enabled
2. **Service account credentials invalid**: Backend is using "test" credentials which don't exist
3. **Instance configuration**: Zitadel is configured for `auth.thaliumx.com` but running locally

## Solution Steps

### Step 1: Start Zitadel with Local Configuration

Zitadel needs to be started with proper local configuration. The current setup uses:
- External domain: `auth.thaliumx.com` (production)
- For local: Should use `localhost` or internal domain

**Option A: Use the production stack script (recommended)**
```bash
cd /home/ubuntu/thaliumx-v1
docker/scripts/prod-v1-stack.sh start
```

**Option B: Manual start with local config**
```bash
# Set environment variables for local development
export ZITADEL_EXTERNAL_DOMAIN=localhost
export ZITADEL_EXTERNAL_PORT=8080
export ZITADEL_TLS_MODE=disabled

# Start using compose
docker compose -f docker/compose/prod-v1/identity.yml up -d
```

### Step 2: Access Zitadel Console

Once Zitadel is running:

1. **Access the console**:
   - URL: `http://localhost:8080` (if port is exposed)
   - Or via internal network: `http://thaliumx-zitadel:8080`

2. **Login**:
   - Username: `root@localhost` (or `root@auth.thaliumx.com` if using production domain)
   - Password: Check `.secrets/generated/zitadel-firstadmin-password`
   - Current password: `Aa1!30ad3716f234d05666ef744b178e`

### Step 3: Create OIDC Application

1. **Navigate to Projects**:
   - Go to: **Projects** > **Default Project** (or create a new project)

2. **Create OIDC Application**:
   - Click **"New Application"**
   - Select **"OIDC"**
   - Name: `thaliumx-backend-local`
   - Grant Types: **Enable both**:
     - ✓ Client Credentials (for service account/Management API)
     - ✓ Password (for user login)
   - Response Types: `Token` or `Code`
   - Click **"Create"**

3. **Generate Client Secret**:
   - In the application details page
   - Click **"Generate Client Secret"** (or **"Actions"** > **"Generate Client Secret"**)
   - **IMPORTANT**: Copy the **Client ID** and **Client Secret** immediately
   - The secret will not be displayed again

### Step 4: Update Backend Configuration

Update the backend environment variables with the OIDC application credentials:

**For `docker/core/compose.yaml` (local development):**
```yaml
environment:
  - ZITADEL_ISSUER=http://thaliumx-zitadel:8080
  - ZITADEL_JWKS_URI=http://thaliumx-zitadel:8080/oauth/v2/keys
  - ZITADEL_SERVICE_ACCOUNT_ID=<your-client-id>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<your-client-secret>
  - ZITADEL_OIDC_CLIENT_ID=<your-client-id>
  - ZITADEL_OIDC_CLIENT_SECRET=<your-client-secret>
```

**For `docker/compose/prod-v1/applications.yml` (production):**
```yaml
environment:
  - ZITADEL_ISSUER=http://thaliumx-zitadel:8080
  - ZITADEL_JWKS_URI=http://thaliumx-zitadel:8080/oauth/v2/keys
  - ZITADEL_SERVICE_ACCOUNT_ID=<your-client-id>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<your-client-secret>
  - ZITADEL_OIDC_CLIENT_ID=<your-client-id>
  - ZITADEL_OIDC_CLIENT_SECRET=<your-client-secret>
```

### Step 5: Restart Backend

```bash
docker restart thaliumx-backend
```

### Step 6: Verify Setup

1. **Check backend logs**:
   ```bash
   docker logs thaliumx-backend | grep -i zitadel
   ```
   Look for:
   - `✅ Zitadel credentials loaded`
   - No errors about "client not found" or "password not supported"

2. **Test registration**:
   - Try registering a new user via the frontend
   - Check that Zitadel user is created successfully

3. **Test login**:
   - Try logging in with the registered user
   - Verify that OIDC token is obtained

## Troubleshooting

### "password not supported" Error

**Cause**: OIDC application doesn't have password grant enabled

**Solution**: 
1. Go to Zitadel console
2. Navigate to your OIDC application
3. Edit the application
4. Enable "Password" grant type
5. Save changes

### "client not found" Error

**Cause**: Invalid service account credentials

**Solution**:
1. Verify Client ID and Secret in backend environment
2. Check that the OIDC application exists in Zitadel
3. Regenerate client secret if needed

### "Instance not found" Error

**Cause**: Zitadel external domain mismatch

**Solution**:
1. Check Zitadel logs: `docker logs thaliumx-zitadel`
2. Verify `--externalDomain` matches how you're accessing Zitadel
3. For local dev, use `localhost` or internal domain

### Cannot Access Zitadel Console

**Cause**: Port not exposed or wrong URL

**Solution**:
1. Check if port is exposed: `docker port thaliumx-zitadel`
2. If not, add port mapping to compose file:
   ```yaml
   ports:
     - "8080:8080"
   ```
3. Or use port forwarding: `docker exec -it thaliumx-zitadel ...`

## Quick Reference

- **Zitadel Console**: `http://localhost:8080` (if port exposed)
- **Root Username**: `root@localhost`
- **Root Password**: See `.secrets/generated/zitadel-firstadmin-password`
- **OIDC Token Endpoint**: `http://thaliumx-zitadel:8080/oauth/v2/token`
- **Management API**: `http://thaliumx-zitadel:8080/management/v1/`

## Next Steps After Setup

1. Create test users in Zitadel
2. Test user registration flow
3. Test user login flow
4. Verify JWT tokens are issued correctly
5. Test password reset flow (if implemented)
