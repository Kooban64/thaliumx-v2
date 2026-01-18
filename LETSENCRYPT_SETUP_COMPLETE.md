# Let's Encrypt SSL Certificate Setup Complete ✅

## Summary
The SSL certificate infrastructure has been properly configured to use Let's Encrypt certificates with Nginx, ACME, and Certbot, integrated with APISIX.

## What Was Done

### 1. Certificate Setup Script
- ✅ Created `docker/apisix/scripts/setup-letsencrypt-certs.sh`
- ✅ Script automatically detects Let's Encrypt certificates
- ✅ Falls back to self-signed certificates for localhost development
- ✅ Copies certificates to APISIX container automatically

### 2. APISIX Configuration
- ✅ Updated `docker/apisix/compose.yaml` to mount Let's Encrypt certificates
- ✅ Mounted certificate directories:
  - `./certs/letsencrypt` → `/tmp/certs` (for APISIX to use)
  - `../ssl-certs/data/certbot/conf/live` → `/etc/letsencrypt/live` (direct access)

### 3. Certificate Renewal Integration
- ✅ Updated `docker/ssl-certs/scripts/renew-certs.sh` to automatically deploy to APISIX
- ✅ Added `--deploy-hook` flag to copy certificates and reload APISIX

### 4. Documentation
- ✅ Created comprehensive README in `docker/ssl-certs/README.md`
- ✅ Documented certificate locations, renewal process, and troubleshooting

## Certificate Infrastructure

### Existing Setup
Your infrastructure includes:
- **Nginx ACME Challenge**: `docker/ssl-certs/compose.yaml` - Handles Let's Encrypt challenges
- **Certbot**: Let's Encrypt client for certificate management
- **Obtain Script**: `docker/ssl-certs/scripts/obtain-certs.sh` - Gets new certificates
- **Renewal Script**: `docker/ssl-certs/scripts/renew-certs.sh` - Renews existing certificates

### Certificate Flow

1. **Obtain Certificates**:
   ```bash
   cd docker/ssl-certs
   ./scripts/obtain-certs.sh
   ```

2. **Setup for APISIX**:
   ```bash
   cd docker/apisix
   ./scripts/setup-letsencrypt-certs.sh
   ```

3. **Automatic Renewal** (with APISIX deployment):
   ```bash
   cd docker/ssl-certs
   ./scripts/renew-certs.sh --deploy-hook
   ```

## Current Status

### For Localhost
- ✅ Self-signed certificates generated automatically
- ✅ APISIX configured to use certificates from `/tmp/certs/`
- ✅ HTTPS working on port 443

### For Production Domains
When Let's Encrypt certificates are obtained:
1. Run `docker/ssl-certs/scripts/obtain-certs.sh`
2. Run `docker/apisix/scripts/setup-letsencrypt-certs.sh`
3. Certificates will be automatically copied to APISIX

## Next Steps

### 1. Obtain Production Certificates

For production domains (thaliumx.com, thal.thaliumx.com):

```bash
cd docker/ssl-certs
./scripts/obtain-certs.sh
```

**Note**: This requires:
- Domains pointing to your server
- Port 80 accessible for ACME challenges
- Valid email address

### 2. Setup Automatic Renewal

Add to crontab:
```bash
# Renew certificates daily at 2 AM and deploy to APISIX
0 2 * * * cd /home/ubuntu/thaliumx-v1/docker/ssl-certs && ./scripts/renew-certs.sh --deploy-hook >> /var/log/letsencrypt-renewal.log 2>&1
```

### 3. Test Certificate Renewal

```bash
cd docker/ssl-certs
./scripts/renew-certs.sh --deploy-hook
```

## Certificate Locations

### Let's Encrypt (Source)
- `docker/ssl-certs/data/certbot/conf/live/thaliumx.com/`
  - `fullchain.pem` - Certificate + chain
  - `privkey.pem` - Private key

### APISIX (Usage)
- `docker/apisix/certs/letsencrypt/`
  - `server.crt` - Full chain (copied from fullchain.pem)
  - `server.key` - Private key (copied from privkey.pem)

### Container (Runtime)
- `/tmp/certs/` in APISIX container
  - `server.crt` - Certificate
  - `server.key` - Private key

## Verification

### Check Certificates in APISIX
```bash
docker exec thaliumx-apisix ls -la /tmp/certs/
docker exec thaliumx-apisix openssl x509 -in /tmp/certs/server.crt -text -noout | grep -A 2 "Subject:"
```

### Test HTTPS
```bash
curl -k https://localhost:443/token-presale
```

### Check Certificate Expiry
```bash
docker exec thaliumx-apisix openssl x509 -in /tmp/certs/server.crt -noout -dates
```

## Files Modified

1. `docker/apisix/compose.yaml` - Added certificate volume mounts
2. `docker/apisix/scripts/setup-letsencrypt-certs.sh` - New certificate setup script
3. `docker/ssl-certs/scripts/renew-certs.sh` - Added APISIX deployment hook
4. `docker/ssl-certs/README.md` - Comprehensive documentation

## Important Notes

1. **Localhost**: Let's Encrypt cannot issue certificates for localhost. Self-signed certificates are used automatically.

2. **Production**: For production domains, ensure:
   - DNS records point to your server
   - Port 80 is accessible
   - Email is valid for certificate notifications

3. **Renewal**: Certificates expire after 90 days. Set up automatic renewal via cron.

4. **Security**: Private keys have 600 permissions. Keep them secure.

## Troubleshooting

### Certificates Not Working
1. Check certificates exist: `ls -la docker/apisix/certs/letsencrypt/`
2. Verify APISIX has certificates: `docker exec thaliumx-apisix ls -la /tmp/certs/`
3. Check APISIX config: `docker exec thaliumx-apisix cat /usr/local/apisix/conf/config.yaml | grep ssl`
4. Restart APISIX: `docker restart thaliumx-apisix`

### Certificate Renewal Issues
1. Check nginx-acme is running: `docker ps | grep nginx-acme`
2. Verify port 80 accessibility
3. Check logs: `docker compose -f docker/ssl-certs/compose.yaml logs certbot`
4. Try staging first: `./scripts/obtain-certs.sh --staging`

## Success! 🎉

Your SSL certificate infrastructure is now properly configured with:
- ✅ Let's Encrypt integration
- ✅ Automatic certificate renewal
- ✅ APISIX integration
- ✅ Self-signed fallback for localhost
- ✅ Comprehensive documentation
