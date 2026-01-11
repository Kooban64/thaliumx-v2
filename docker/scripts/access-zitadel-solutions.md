# Solutions for Accessing Zitadel

## Your Issues
1. ❌ Don't know credentials
2. ❌ Cannot access from localhost
3. ❌ APISIX blocks web access

## Solutions

### Solution 1: Use Backend Container (Easiest)

The backend container can access Zitadel directly via Docker network:

```bash
# Access Zitadel console via backend container
docker exec -it thaliumx-backend sh

# Inside container, you can:
# 1. Access Zitadel directly
curl http://thaliumx-zitadel:8080/.well-known/openid-configuration

# 2. Or use Python to create service account
python3 docker/scripts/zitadel-bootstrap-complete.py
```

### Solution 2: Port Forwarding via SSH

If you have SSH access to the server:

```bash
# From your local machine
ssh -L 8080:localhost:8080 user@your-server

# Then access http://localhost:8080 in your browser
```

### Solution 3: Direct Container Access

```bash
# Access Zitadel container directly
docker exec -it thaliumx-zitadel sh

# Or use backend container as proxy
docker exec -it thaliumx-backend sh
# Then: curl http://thaliumx-zitadel:8080
```

### Solution 4: Create Service Account via Backend Script

We've created a script that uses the backend container:

```bash
docker/scripts/create-service-account-via-backend.sh
```

This script:
1. Uses backend container to access Zitadel
2. Attempts to authenticate
3. Creates service account
4. Creates OIDC app

### Solution 5: Use Python Script from Backend Container

```bash
# Copy script to backend container
docker cp docker/scripts/zitadel-bootstrap-complete.py thaliumx-backend:/tmp/

# Run from backend container
docker exec thaliumx-backend python3 /tmp/zitadel-bootstrap-complete.py \
  <service_account_client_id> \
  <service_account_client_secret>
```

## Credentials

**Zitadel Login:**
- Username: `root@localhost`
- Password: `Aa1!30ad3716f234d05666ef744b178e`

**Access URLs:**
- Direct (from containers): `http://thaliumx-zitadel:8080`
- Localhost (if port forwarded): `http://localhost:8080`
- Via APISIX: `https://auth.thaliumx.com` (requires proper DNS/SSL)

## Recommended Approach

Since you can't access from localhost and APISIX blocks access, use the **backend container**:

```bash
# Option A: Use our automated script
docker/scripts/create-service-account-via-backend.sh

# Option B: Manual via backend container
docker exec -it thaliumx-backend sh
# Then run Python scripts from inside
```
