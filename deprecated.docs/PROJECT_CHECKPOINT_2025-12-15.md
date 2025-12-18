# Project Checkpoint (2025-12-15)

This checkpoint captures what was changed during the initial **P0 security remediation** pass and what remains before production launch.

## 1) What was done (P0 remediation)

### 1.1 Removed committed secrets / credential-bearing env files (replaced with templates)

The following files were previously tracked and contained real credentials. They are now **removed from git tracking** and replaced with **template/example files**:

- Replaced `.env.staging` with `.env.staging.example` (local `.env.staging` is now gitignored).
- Replaced `docker/core/core.env` with `docker/core/core.env.example` (local `docker/core/core.env` is now gitignored).
- Replaced `docker/trading/trading.env` with `docker/trading/trading.env.example` (local file is now gitignored).
- Replaced `docker/fintech/config/ballerine.env` with `docker/fintech/config/ballerine.env.example` (local file is now gitignored).

### 1.2 Git ignore hardening

Updated `.gitignore` to:

- Ignore local-only env files (`.env.staging`, `docker/core/core.env`, trading/fintech env files).
- Ignore Vault key material directory (`docker/security/.vault-keys/`).
- Ignore monorepo build artifacts (`**/.next/`, `**/dist/`, `**/coverage/`).

### 1.3 Removed hardcoded credentials from helper scripts / configs

- Root `package.json` no longer embeds a MongoDB password in the `mongodb:shell` script; it now requires `MONGO_INITDB_ROOT_PASSWORD` to be set.
- APISIX admin route init scripts no longer ship with default admin keys; they require `APISIX_ADMIN_KEY` to be provided at runtime.

### 1.4 APISIX admin/dashboard hardening (config-level)

- APISIX admin API is now restricted to localhost + private Docker networks and the admin listener is bound to `127.0.0.1`.
- Hardcoded APISIX admin keys / dashboard secrets were replaced with placeholders (`__REPLACE_WITH_SECURE_VALUE__`) to prevent committing real secrets.

### 1.5 Docker compose “no insecure defaults” for auth/secrets

- `docker/security/compose.yaml`: removed default Keycloak admin password, DB password, and Vault token.
- `docker/security/compose.production.yaml`: removed default Keycloak admin password and Postgres password.
- `docker/core/compose.yaml`: removed default Vault token, DB password, and MongoDB password fallback.

### 1.6 Database init script hardening

- Postgres init no longer hardcodes an application user password in SQL.

### 1.7 Backend source hardening

- Migration runner no longer falls back to a default DB password; it fails fast if `DB_PASSWORD`/`POSTGRES_PASSWORD` is missing.
- External exchange integration no longer embeds exchange API keys/secrets in source. Each exchange is disabled if required credentials are missing.

### 1.8 MongoDB init hardening

- Mongo init script no longer hardcodes a password; it requires `MONGO_APP_PASSWORD`.
- MongoDB compose now requires `MONGO_INITDB_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` (no defaults).

### 1.9 Vault credential file removal

- Removed tracked Vault credential JSON (`docker/security/.vault-keys/approle-credentials.json`) and replaced it with an example template.

## 2) What still needs to be done (before production launch)

### 2.1 Assume compromise + rotate credentials (P0)

Because secrets existed in tracked files, treat **all previously committed credentials as compromised**:

- Rotate DB/Redis/Mongo credentials.
- Rotate Keycloak admin credentials and client secrets.
- Rotate Vault bootstrap tokens / root tokens / AppRole secret IDs.
- Rotate any third-party API keys (exchange APIs, bank integrations, SMTP, etc.).

### 2.2 Purge secrets from git history (P0)

Even though files were removed from the current tree, git history may still contain them.

- Run `git filter-repo` / BFG to remove secret blobs from history.
- Force rotate all secrets again after rewriting history.

### 2.3 Eliminate remaining insecure defaults across docker configs (P0/P1)

There are still many occurrences of default credentials like `ThaliumX2025` in compose files and scripts (databases, redis, typesense, observability exporters, staging/simple compose files, etc.).

Action: remove default fallbacks and require explicit secrets for any *production* compose path.

### 2.4 Network hardening (P0)

Current runtime exposes many sensitive ports on `0.0.0.0` (databases, etcd, APISIX admin, Vault, etc.).

Action:

- Remove host port bindings for internal services (DB/Redis/Mongo/etcd/etc.).
- If access is needed, bind to localhost only and require VPN/SSH tunnel.
- Separate networks: `internal: true` networks for data/infra.

### 2.5 APISIX config secret injection (P1)

APISIX config currently uses placeholders.

Action:

- Implement a deployment-time render step (CI/CD envsubst + mounted config) or mount admin keys from a secrets manager.

### 2.6 Runtime verification + testing (P1)

After secrets rotation and redeploy:

- Run unit/integration tests for backend and frontend.
- Run staging smoke tests.
- Execute manual QA flows (auth, dashboards, trading flows, KYC, presale, error cases).

### 2.7 Observability/security baseline (P1)

- Confirm logs do not contain credentials.
- Confirm Postgres is not configured with `log_statement=all` in production.
- Add/verify rate limiting at gateway and app.

## 3) Next planned work session

1. Remove remaining default credentials across production compose configs.
2. Lock down exposed ports (bind localhost / remove host mappings).
3. Rebuild and restart docker compose with freshly generated secrets.
4. Run automated tests + manual QA sweep.

