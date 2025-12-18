# SSL Configuration Documentation

## Why SSL Was Disabled for Compliance Services

### Current Setup (Internal Docker Network)
- **PostgreSQL**: SSL is **disabled** (`ssl = off` in PostgreSQL configuration)
- **Compliance Services**: SSL connections are **disabled** to match PostgreSQL
- **Reason**: Internal Docker network communication doesn't require SSL encryption

### The Issue
When compliance services (CEX, DEX, NFT, Token, Coordinator) tried to connect to PostgreSQL with SSL enabled, they received the error:
```
The server does not support SSL connections
```

### The Fix
1. **Compliance Services Configuration**: Set `DATABASE_SSL=false` in environment variables
2. **DatabaseService**: Hardcoded `ssl: false` in PostgreSQL connection pool configuration
3. **Backend Service**: Uses `DB_SSL=false` from `core.env` (already configured correctly)

### Files Modified
- `docker/compliance/compose.yaml`: Added `DATABASE_SSL=false` for all compliance services
- `docker/compliance-cex/src/config/index.ts`: Changed default `DATABASE_SSL` from `true` to `false`
- `docker/compliance-cex/src/services/database/DatabaseService.ts`: Hardcoded `ssl: false`
- `docker/compliance-dex/src/config/index.ts`: Already had `DATABASE_SSL` default as `false`
- `docker/compliance-dex/src/services/database/DatabaseService.ts`: Already had `ssl: false`

### For Production with External Access
If you need to enable SSL for production (external database access):

1. **Enable SSL on PostgreSQL**:
   ```yaml
   # In docker/databases/compose.yaml
   environment:
     POSTGRES_SSL: "on"
   volumes:
     - ./ssl/postgres.crt:/var/lib/postgresql/server.crt:ro
     - ./ssl/postgres.key:/var/lib/postgresql/server.key:ro
   ```

2. **Update Compliance Services**:
   - Set `DATABASE_SSL=true` in environment variables
   - Update `DatabaseService.ts` to use SSL configuration:
     ```typescript
     ssl: config.database.ssl ? {
       rejectUnauthorized: false // or true with proper CA cert
     } : false
     ```

3. **Update Backend Service**:
   - Set `DB_SSL=true` in `docker/core/core.env`
   - Backend already supports SSL via `dialectOptions.ssl` configuration

### Current Status
✅ All services are configured correctly for internal Docker network (no SSL)
✅ All compliance services are healthy and connecting to PostgreSQL
✅ Backend service is healthy and connecting to Citus (distributed PostgreSQL)

### Security Note
- **Internal Docker Network**: SSL not required (services communicate over isolated network)
- **External Access**: SSL should be enabled for production deployments
- **Network Isolation**: Docker networks provide isolation, but SSL adds encryption layer

