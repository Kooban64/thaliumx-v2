# Quick Fix: Access Zitadel and Create Service Account

## Your Credentials (Now Available!)

```
Username: root@zitadel.localhost
Password: Aa1!30ad3716f234d05666ef744b178e
```

**Note**: The username is `root@zitadel.localhost` (not `root@localhost`). This is the actual username format stored in Zitadel's database.

## Problem Summary
- ✅ Zitadel is running
- ✅ Credentials are available
- ❌ Can't access from localhost (network/APISIX blocking)
- ❌ Password grant not enabled (needs OIDC app first)

## Solution: SSH Port Forwarding

This is the **easiest and most reliable** solution:

### Step 1: Set Up Port Forwarding

From your **local machine** (not the server):

```bash
ssh -L 8080:localhost:8080 ubuntu@your-server-ip
```

Replace `your-server-ip` with your actual server IP address.

### Step 2: Access Zitadel Console

Once SSH port forwarding is active, open your browser and go to:

```
http://localhost:8080
```

### Step 3: Login

- **Username**: `root@zitadel.localhost` ← **Important: Use this exact format!**
- **Password**: `Aa1!30ad3716f234d05666ef744b178e`

**If `root@zitadel.localhost` doesn't work, also try:**
- `root@localhost`
- `root@auth.thaliumx.com`

### Step 4: Create Service Account

1. Navigate to **Service Users** (or **Users** > **Service Users**)
2. Click **New** or **Create**
3. Enter:
   - **Username**: `thaliumx-backend-service`
   - **Name**: `ThaliumX Backend Service Account`
   - **Description**: `Service account for backend API`
4. Click **Create**
5. In the service user details, click **Actions** > **Generate Client Secret**
6. **IMPORTANT**: Copy the **Client ID** and **Client Secret** immediately

### Step 5: Create OIDC App (Automated)

Once you have the service account credentials, run from the server:

```bash
cd /home/ubuntu/thaliumx-v1

# Copy the OIDC app creation script to backend
docker cp docker/scripts/create-oidc-app-with-service-account.js thaliumx-backend:/tmp/

# Run it with your service account credentials
docker exec thaliumx-backend node /tmp/create-oidc-app-with-service-account.js \
  <SERVICE_ACCOUNT_CLIENT_ID> \
  <SERVICE_ACCOUNT_CLIENT_SECRET> \
  353322233650937880
```

This will automatically create the OIDC app with password grant enabled!

### Step 6: Update Backend Configuration

From the output, you'll get OIDC client ID and secret. Update `docker/core/compose.yaml`:

```yaml
environment:
  - ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET>
  - ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>
```

### Step 7: Restart Backend

```bash
docker restart thaliumx-backend
```

## Alternative: If SSH Port Forwarding Doesn't Work

### Option A: Use Backend Container Network

```bash
# Access backend container
docker exec -it thaliumx-backend sh

# From inside, try to access Zitadel
# But you'll still need a way to interact with the console
```

### Option B: Temporarily Expose Zitadel on Different Port

```bash
# Add another port mapping
docker run -d --name thaliumx-zitadel-temp \
  --network thaliumx-net \
  -p 9080:8080 \
  ... (same config as existing zitadel)
```

Then access via port 9080.

## Summary

**The easiest path forward:**
1. ✅ Use SSH port forwarding to access Zitadel console
2. ✅ Login with credentials provided above
3. ✅ Create service account manually (one-time)
4. ✅ Run automation script to create OIDC app
5. ✅ Update backend config and restart

**All automation scripts are ready** - you just need that one manual step to create the service account via the console!
