# Ballerine Configuration Guide

## Overview

Ballerine is a KYC/KYB workflow service that requires specific configuration for bcrypt salt values. This document explains the critical configuration requirements to prevent service failures.

## Critical Configuration Requirements

### 1. BCRYPT_SALT

**Purpose**: Used by the PasswordService for hashing user passwords.

**Format**: Must be a valid bcrypt salt string in the format:
```
$Vers$log2(NumRounds)$saltvalue
```

**Example**:
```yaml
BCRYPT_SALT: "$2b$10$.8CHAioRfbSk8KiRGNqNyu"
```

**Requirements**:
- Must be exactly 29 characters
- Format: `$2b$` (version) + `10$` (cost factor) + 22 characters of base64 salt
- Can also be a number (e.g., `10`) which tells bcrypt to generate a new salt each time

**How to generate**:
```javascript
const bcrypt = require('bcrypt');
const salt = bcrypt.genSaltSync(10);
console.log(salt); // e.g., $2b$10$.8CHAioRfbSk8KiRGNqNyu
```

### 2. HASHING_KEY_SECRET_BASE64

**Purpose**: Used by the API key hashing utility (`/app/dist/src/customer/api-key/utils.js`) for hashing API keys.

**Format**: Must be a Base64-encoded valid bcrypt salt string.

**Example**:
```yaml
HASHING_KEY_SECRET_BASE64: "JDJiJDEwJEJUbzBtd2pWRFpXcGtxNHNxUWozWmU="
```

**Decoded value**: `$2b$10$BTo0mwjVDZWpkq4sqQj3Ze`

**How to generate**:
```javascript
const bcrypt = require('bcrypt');
const { Base64 } = require('js-base64');
const salt = bcrypt.genSaltSync(10);
console.log('Salt:', salt);
console.log('Base64:', Base64.encode(salt));
```

**Alternative**: You can use `HASHING_KEY_SECRET` instead (plain text bcrypt salt), but `HASHING_KEY_SECRET_BASE64` takes precedence if both are set.

### 3. DB_URL (not DATABASE_URL)

**Purpose**: Prisma database connection string.

**Important**: Ballerine's Prisma schema uses `DB_URL`, not `DATABASE_URL`. Both should be set for compatibility:

```yaml
DB_URL: postgresql://ballerine:password@host:5432/ballerine
DATABASE_URL: postgresql://ballerine:password@host:5432/ballerine
```

## Common Errors and Solutions

### Error: "Invalid salt. Salt must be in the form of: $Vers$log2(NumRounds)$saltvalue"

**Cause**: Either `BCRYPT_SALT` or `HASHING_KEY_SECRET` is not a valid bcrypt salt format.

**Solution**:
1. Generate valid bcrypt salts using the commands above
2. Ensure `BCRYPT_SALT` is exactly 29 characters
3. Ensure `HASHING_KEY_SECRET_BASE64` decodes to a valid 29-character bcrypt salt

### Error: "Environment variable not found: DB_URL"

**Cause**: Ballerine expects `DB_URL`, not `DATABASE_URL`.

**Solution**: Set both `DB_URL` and `DATABASE_URL` to the same PostgreSQL connection string.

### Error: "Authentication failed against database server"

**Cause**: Database password mismatch between compose file and persistent volume.

**Solution**: 
```bash
# Update password in running database
docker exec thaliumx-ballerine-postgres psql -U ballerine -d ballerine -c "ALTER USER ballerine WITH PASSWORD 'YourPassword';"
```

## Generating New Salts

If you need to regenerate salts (e.g., for security rotation), run this inside the Ballerine container:

```bash
docker exec thaliumx-ballerine-workflow node -e "
const bcrypt = require('bcrypt');
const { Base64 } = require('js-base64');

// Generate BCRYPT_SALT
const bcryptSalt = bcrypt.genSaltSync(10);
console.log('BCRYPT_SALT:', bcryptSalt);

// Generate HASHING_KEY_SECRET_BASE64
const hashingSalt = bcrypt.genSaltSync(10);
console.log('HASHING_KEY_SECRET_BASE64:', Base64.encode(hashingSalt));
console.log('(Decoded):', hashingSalt);
"
```

## Current Configuration

The current working configuration in `compose.yaml`:

```yaml
BCRYPT_SALT: "$2b$10$.8CHAioRfbSk8KiRGNqNyu"
HASHING_KEY_SECRET_BASE64: "JDJiJDEwJEJUbzBtd2pWRFpXcGtxNHNxUWozWmU="
DB_URL: postgresql://ballerine:ThaliumX2025@thaliumx-ballerine-postgres:5432/ballerine
DATABASE_URL: postgresql://ballerine:ThaliumX2025@thaliumx-ballerine-postgres:5432/ballerine
```

## Service Dependencies

- **ballerine-postgres**: PostgreSQL 15.3 with plv8 extension (required)
- **thaliumx-redis**: Redis for session storage (optional but recommended)

## Health Check

The service exposes health endpoints:
- Live: `GET /api/v1/_health/live`
- Ready: `GET /api/v1/_health/ready`

Test with:
```bash
curl http://localhost:3003/api/v1/_health/live
```

## Troubleshooting Steps

1. **Check logs**: `docker logs thaliumx-ballerine-workflow --tail 100`
2. **Verify environment**: `docker exec thaliumx-ballerine-workflow printenv | grep -E "BCRYPT|HASHING|DB_URL"`
3. **Test database connection**: `docker exec thaliumx-ballerine-postgres psql -U ballerine -d ballerine -c "SELECT 1;"`
4. **Test bcrypt salt**: 
   ```bash
   docker exec thaliumx-ballerine-workflow node -e "
   const bcrypt = require('bcrypt');
   const salt = process.env.BCRYPT_SALT;
   console.log('Salt valid:', bcrypt.hashSync('test', salt));
   "