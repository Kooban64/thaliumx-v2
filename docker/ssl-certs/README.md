# ThaliumX SSL Certificate Service

This service handles SSL certificate management using Let's Encrypt with ACME challenge verification.

## Overview

The SSL certificate service uses:
- **Certbot**: Official Let's Encrypt client for obtaining and renewing certificates
- **Nginx**: Lightweight web server for handling ACME HTTP-01 challenges

## Directory Structure

```
ssl-certs/
├── compose.yaml           # Docker Compose configuration
├── config/
│   └── nginx-acme.conf    # Nginx configuration for ACME challenges
├── scripts/
│   ├── obtain-certs.sh    # Script to obtain new certificates
│   └── renew-certs.sh     # Script to renew existing certificates
├── data/
│   └── certbot/
│       ├── conf/          # Certificate storage (created automatically)
│       ├── www/           # ACME challenge files (created automatically)
│       └── logs/          # Certbot logs (created automatically)
└── README.md
```

## Domains Configured

- `thaliumx.com` - Main landing page
- `www.thaliumx.com` - WWW redirect
- `thal.thaliumx.com` - Token presale page

## Prerequisites

1. DNS records must be configured and propagated:
   - `thaliumx.com` → `52.54.125.124`
   - `www.thaliumx.com` → `52.54.125.124`
   - `thal.thaliumx.com` → `52.54.125.124`

2. Port 80 must be accessible from the internet for ACME challenges

3. Docker and Docker Compose must be installed

## Usage

### Obtaining New Certificates

```bash
cd docker/ssl-certs

# For production certificates
./scripts/obtain-certs.sh

# For testing (uses Let's Encrypt staging environment)
./scripts/obtain-certs.sh --staging

# With custom email
./scripts/obtain-certs.sh --email your-email@example.com

# Force renewal of existing certificates
./scripts/obtain-certs.sh --force-renewal
```

### Renewing Certificates

```bash
cd docker/ssl-certs

# Simple renewal
./scripts/renew-certs.sh

# Renewal with automatic deployment to APISIX
./scripts/renew-certs.sh --deploy-hook
```

### Manual Certificate Operations

```bash
# Start nginx for ACME challenges
docker compose up -d thaliumx-nginx-acme

# Run certbot manually
docker compose run --rm thaliumx-certbot certonly \
  --webroot -w /var/www/certbot \
  -d thaliumx.com -d www.thaliumx.com -d thal.thaliumx.com \
  --email admin@thaliumx.com \
  --agree-tos --non-interactive

# Check certificate status
docker compose run --rm thaliumx-certbot certificates

# Stop services
docker compose down
```

## Certificate Files

After successful certificate obtainment, files are located at:

```
data/certbot/conf/live/thaliumx.com/
├── fullchain.pem    # Full certificate chain (use for SSL)
├── privkey.pem      # Private key (use for SSL)
├── cert.pem         # Domain certificate only
└── chain.pem        # Intermediate certificates
```

## Deploying to APISIX

After obtaining certificates, copy them to the APISIX gateway:

```bash
# Create SSL directory in gateway config
mkdir -p ../gateway/config/ssl

# Copy certificates
cp data/certbot/conf/live/thaliumx.com/fullchain.pem ../gateway/config/ssl/
cp data/certbot/conf/live/thaliumx.com/privkey.pem ../gateway/config/ssl/

# Reload APISIX (if running)
docker exec thaliumx-apisix apisix reload
```

Or use the renewal script with deploy hook:
```bash
./scripts/renew-certs.sh --deploy-hook
```

## Automatic Renewal

Let's Encrypt certificates are valid for 90 days. Set up a cron job for automatic renewal:

```bash
# Edit crontab
crontab -e

# Add renewal job (runs daily at 3 AM)
0 3 * * * cd /path/to/thaliumx/docker/ssl-certs && ./scripts/renew-certs.sh --deploy-hook >> /var/log/certbot-renewal.log 2>&1
```

## Troubleshooting

### Certificate Obtainment Fails

1. **DNS not propagated**: Verify DNS records are correct
   ```bash
   dig thaliumx.com
   dig thal.thaliumx.com
   ```

2. **Port 80 blocked**: Ensure firewall allows HTTP traffic
   ```bash
   sudo ufw allow 80/tcp
   ```

3. **Rate limits**: Let's Encrypt has rate limits. Use `--staging` for testing

### Check Logs

```bash
# Certbot logs
cat data/certbot/logs/letsencrypt.log

# Nginx logs
docker compose logs thaliumx-nginx-acme
```

### Test ACME Challenge

```bash
# Start nginx
docker compose up -d thaliumx-nginx-acme

# Create test file
echo "test" > data/certbot/www/.well-known/acme-challenge/test

# Test from another machine
curl http://thaliumx.com/.well-known/acme-challenge/test
```

## Security Notes

- Private keys are stored in `data/certbot/conf/` - keep this directory secure
- The `data/` directory is gitignored to prevent accidental commits of certificates
- Use appropriate file permissions for certificate files (600 for private keys)

## Network Configuration

This service uses the `thaliumx-net` network for consistency with other ThaliumX services.

Container names:
- `thaliumx-nginx-acme` - Nginx for ACME challenges
- `thaliumx-certbot` - Certbot for certificate management