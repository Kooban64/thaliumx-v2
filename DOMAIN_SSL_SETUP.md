# Domain SSL Setup Status for thaliumx.com and thal.thaliumx.com

## Current Status

### ✅ Routes Configured
Both domains have routes configured in APISIX:
- **thaliumx.com**: Route #1 - Main landing page
- **thal.thaliumx.com**: Routes #3, #30 - Token presale site

### ⚠️ Certificates Status
- **Let's Encrypt Certificates**: Not yet obtained
- **Current Certificates**: Self-signed (for localhost only)
- **SSL Objects in APISIX**: Need to be created for domain-specific SNI

## What Needs to Be Done

### 1. Obtain Let's Encrypt Certificates

**Prerequisites:**
- DNS records must point to your server:
  - `thaliumx.com` → Your server IP
  - `www.thaliumx.com` → Your server IP  
  - `thal.thaliumx.com` → Your server IP
- Port 80 must be accessible for ACME challenges

**Steps:**
```bash
cd docker/ssl-certs
./scripts/obtain-certs.sh
```

This will:
- Start nginx for ACME challenge
- Obtain certificates for all three domains
- Store certificates in `data/certbot/conf/live/thaliumx.com/`

### 2. Setup Certificates for APISIX

```bash
cd docker/apisix
./scripts/setup-letsencrypt-certs.sh
```

This will:
- Copy certificates to APISIX directory
- Copy certificates to APISIX container
- Restart APISIX

### 3. Create SSL Objects in APISIX (SNI)

APISIX needs SSL objects configured for SNI (Server Name Indication) to serve the correct certificate for each domain.

**Option A: Wildcard Certificate (Recommended)**
If you have a wildcard certificate `*.thaliumx.com`, create one SSL object:

```bash
# Read certificate content
CERT=$(cat docker/ssl-certs/data/certbot/conf/live/thaliumx.com/fullchain.pem | sed 's/$/\\n/' | tr -d '\n')
KEY=$(cat docker/ssl-certs/data/certbot/conf/live/thaliumx.com/privkey.pem | sed 's/$/\\n/' | tr -d '\n')

# Create SSL object via etcd
docker exec thaliumx-etcd etcdctl put /apisix/ssls/1 "{
  \"id\": \"1\",
  \"snis\": [\"thaliumx.com\", \"www.thaliumx.com\", \"thal.thaliumx.com\", \"*.thaliumx.com\"],
  \"cert\": \"$CERT\",
  \"key\": \"$KEY\",
  \"status\": 1
}"
```

**Option B: Domain-Specific Certificates**
If you have separate certificates, create SSL objects for each domain.

### 4. Verify Configuration

```bash
# Check SSL objects
docker exec thaliumx-etcd etcdctl get --prefix /apisix/ssls

# Test HTTPS
curl -I https://thaliumx.com
curl -I https://thal.thaliumx.com
```

## Current Configuration Analysis

### Routes (✅ Configured)
- Route #1: `thaliumx.com/*` → Frontend upstream
- Route #3: `thal.thaliumx.com/` → Redirects to `/token-presale`
- Route #30: `thal.thaliumx.com/*` → Frontend upstream
- All routes have `http_to_https: true` redirect enabled

### SSL Configuration (⚠️ Needs Setup)
- APISIX config: Uses `/tmp/certs/server.crt` and `/tmp/certs/server.key`
- Current: Self-signed certificate (localhost only)
- Needed: Let's Encrypt certificates with SNI configuration

## Will It Work?

### Currently: ❌ No
- Certificates don't exist for the domains
- SSL objects not configured in APISIX
- Browser will show certificate errors

### After Setup: ✅ Yes
Once you:
1. ✅ Obtain Let's Encrypt certificates
2. ✅ Copy certificates to APISIX
3. ✅ Create SSL objects in APISIX with SNI
4. ✅ Verify DNS points to your server

Then both domains will work with valid SSL certificates.

## Quick Setup Script

I'll create a script to automate the SSL object creation. Here's what needs to happen:

```bash
#!/bin/bash
# Setup SSL objects in APISIX for thaliumx.com and thal.thaliumx.com

CERT_FILE="docker/ssl-certs/data/certbot/conf/live/thaliumx.com/fullchain.pem"
KEY_FILE="docker/ssl-certs/data/certbot/conf/live/thaliumx.com/privkey.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Error: Certificates not found. Run obtain-certs.sh first."
    exit 1
fi

# Read and escape certificate content
CERT=$(cat "$CERT_FILE" | sed 's/$/\\n/' | tr -d '\n' | sed 's/"/\\"/g')
KEY=$(cat "$KEY_FILE" | sed 's/$/\\n/' | tr -d '\n' | sed 's/"/\\"/g')

# Create SSL object JSON
SSL_JSON="{\"id\":\"1\",\"snis\":[\"thaliumx.com\",\"www.thaliumx.com\",\"thal.thaliumx.com\",\"*.thaliumx.com\"],\"cert\":\"$CERT\",\"key\":\"$KEY\",\"status\":1}"

# Store in etcd
echo "$SSL_JSON" | docker exec -i thaliumx-etcd etcdctl put /apisix/ssls/1

echo "SSL object created in APISIX"
echo "Restart APISIX: docker restart thaliumx-apisix"
```

## Summary

**Current State:**
- ✅ Routes configured for both domains
- ✅ HTTP to HTTPS redirect enabled
- ❌ Let's Encrypt certificates not obtained
- ❌ SSL objects not created in APISIX

**To Make It Work:**
1. Ensure DNS points to your server
2. Run `docker/ssl-certs/scripts/obtain-certs.sh`
3. Run `docker/apisix/scripts/setup-letsencrypt-certs.sh`
4. Create SSL objects in APISIX (script above)
5. Restart APISIX

After these steps, both `thaliumx.com` and `thal.thaliumx.com` will work with valid SSL certificates.
