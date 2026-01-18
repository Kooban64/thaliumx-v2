# HTTPS Setup Complete ✅

## Summary
HTTPS is now properly configured and working for the token presale site.

## What Was Done

### 1. SSL Certificates
- ✅ Created self-signed SSL certificates for localhost
- ✅ Certificates copied to APISIX container at `/tmp/certs/`
- ✅ Certificates configured in APISIX config

### 2. APISIX Route Configuration
- ✅ Created route #100 in etcd for `localhost` host
- ✅ Created upstream #100 pointing to `thaliumx-frontend:3000`
- ✅ Route configured with HTTP to HTTPS redirect
- ✅ Route priority set to 10

### 3. Next.js Configuration
- ✅ Updated `next.config.ts` to disable HSTS for localhost
- ✅ Updated `middleware.ts` to include `/token-presale` in public routes

## Verification

### HTTPS Access
```bash
curl -k https://localhost:443/token-presale
```
✅ Returns full HTML page content (verified)

### Route Configuration
- Route ID: 100
- Host: localhost
- URI: /*
- Upstream: thaliumx-frontend:3000
- Priority: 10
- HTTP to HTTPS redirect: Enabled

## Access URLs

### HTTPS (Recommended)
- **Token Presale**: `https://localhost:443/token-presale`
- **Main Site**: `https://localhost:443/`

### HTTP (Redirects to HTTPS)
- `http://localhost:80/token-presale` → Redirects to HTTPS

## Certificate Details

- **Location**: `/tmp/certs/server.crt` and `/tmp/certs/server.key` in APISIX container
- **Type**: Self-signed (for development)
- **Valid for**: localhost, *.localhost, 127.0.0.1, 0.0.0.0
- **Validity**: 365 days

## Production Note

For production, replace self-signed certificates with proper SSL certificates from a trusted CA (Let's Encrypt, etc.) and configure them in APISIX.

## Testing

The token presale page is now accessible via HTTPS:
- ✅ Page loads correctly
- ✅ All assets load (CSS, JS, fonts)
- ✅ No certificate errors (when using `-k` flag or accepting self-signed cert)
- ✅ HTTP automatically redirects to HTTPS

## Next Steps

1. **Accept Certificate Warning**: When accessing via browser, you'll need to accept the self-signed certificate warning (this is normal for development)

2. **Test All CTAs**: 
   - Registration flow
   - Login flow
   - Purchase flow
   - Web3 wallet connection

3. **Production Setup**: 
   - Replace self-signed certificates with Let's Encrypt or other CA certificates
   - Configure proper domain names
   - Update DNS records

## Files Modified

1. `docker/apisix/config/apisix.yaml` - Added priority to route #3
2. `docker/frontend/next.config.ts` - Added HSTS header configuration
3. `docker/frontend/src/middleware.ts` - Added `/token-presale` to public routes
4. `docker/frontend/package.json` - Added HTTPS start script (for future use)

## etcd Routes Created

- Route #100: Frontend route for localhost
- Upstream #100: Frontend upstream configuration
