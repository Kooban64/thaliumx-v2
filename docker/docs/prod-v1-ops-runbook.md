# ThaliumX prod-v1 Operator Runbook

This repo has a single, canonical production Docker Compose stack under [`docker/compose/prod-v1/`](docker/compose/prod-v1:1).

The supported operator entrypoint is [`thaliumxctl.sh`](thaliumxctl.sh:1) (repo-root wrapper for [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh:1)).

## 1) Day-0 / Day-1 operations

### Start (full stack; recommended)

Runs the hardened bring-up script (includes readiness waits + init jobs):

```bash
./thaliumxctl.sh up
```

### Start fast (compose up only)

Does **not** run init jobs (use only for debugging):

```bash
./thaliumxctl.sh up-fast
```

### Status / Doctor

```bash
./thaliumxctl.sh status
./thaliumxctl.sh doctor
```

### Non-interactive `docker compose` access (full file set)

If you need to run an arbitrary `docker compose` subcommand (e.g. `ps`, `logs`, `config`) **without** manually repeating the full prod-v1 file list, use the wrapper:

```bash
docker/scripts/prod-v1-compose.sh production ps
docker/scripts/prod-v1-compose.sh production logs -f --tail=200
docker/scripts/prod-v1-compose.sh production config --services
```

Under the hood, both call [`docker/scripts/prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1), which validates:

- expected long-running containers exist
- health checks are passing
- common Vault secret-format problems are flagged as **warnings**

### Stop / Down

Stop (containers remain):

```bash
./thaliumxctl.sh stop
```

Down (remove containers; preserves named volumes):

```bash
./thaliumxctl.sh down
```

## 2) “Why do I see fewer running containers than expected?”

prod-v1 includes **one-shot init jobs** that intentionally exit after completing (they may show as `Exited (0)`):

- `vault-unseal` (profile: `init-jobs`)
- `keycloak-post-import-seed` (profile: `init-jobs`)
- `apisix-init` (default set; seeds routes into ETCD)

The presence of exited init containers is normal. Use [`docker/scripts/prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1) (or `thaliumxctl doctor`) to differentiate expected init jobs vs. missing long-running services.

## 2b) Will everything survive a restart or rebuild without manual intervention?

### Host reboot / Docker daemon restart

- **Long-running services** are configured with `restart: unless-stopped` across the prod-v1 compose set (databases, backend, gateway, monitoring, etc.), so they should come back automatically.
- **One-shot init jobs** intentionally use `restart: "no"` and will not “stay running” (e.g. `apisix-init`, `kafka-init`, `vault-unseal`, `keycloak-post-import-seed`).

Important security caveat:

- **Vault may come up sealed after a host restart.** That is expected Vault behavior unless you configure auto-unseal. If Vault is sealed, any service that relies on Vault-sourced secrets may restart-loop until Vault is unsealed.

Recommended boot-safe operator action (idempotent):

```bash
./thaliumxctl.sh up
```

This uses the hardened runner and replays required init jobs (see [`docker/scripts/prod-v1-stack.sh`](docker/scripts/prod-v1-stack.sh:1)).

### Rebuild / recreate

- A rebuild (`./thaliumxctl.sh up-build`) is designed to be **repeatable** and will re-run init jobs.
- If you destroy named volumes (e.g. `docker compose down -v`), data persistence is lost and you should expect to rerun bootstrap/init flows.

## 3) Auth provider (Zitadel)

### What "auth provider" means in this stack

There are **two separate concerns**:

1. **Gateway routing for `/auth`** (APISIX)
   - APISIX routes `/auth` to Zitadel
   - This is seeded into ETCD by [`docker/gateway/scripts/init-apisix-routes.sh`](docker/gateway/scripts/init-apisix-routes.sh:1) via the one-shot service `apisix-init` in [`docker/compose/prod-v1/gateway.yml`](docker/compose/prod-v1/gateway.yml:1)

2. **Backend JWT acceptance**
   - The backend accepts Zitadel JWTs
   - Implemented in [`authenticateToken()`](docker/backend/src/middleware/error-handler.ts:363)

### Reseed routes (idempotent)

Use the interactive helper:

```bash
./thaliumxctl.sh reseed-gateway
```

### Auth provider status (prod-v1)

- prod-v1 uses **Zitadel as the identity provider**.
- Legacy auth is disabled by default and kept only for rollback.
  - In Compose, legacy auth is behind profile `legacy-keycloak` (see [`keycloak`](docker/compose/prod-v1/applications.yml:15)).
  - Enable it only when you explicitly need rollback/testing:

```bash
docker/scripts/prod-v1-compose.sh production --profile legacy-keycloak up -d keycloak
```

This force-recreates the one-shot `apisix-init` container and re-applies route definitions into ETCD.

### Reseed to Zitadel (default)

```bash
THALIUMX_AUTH_PROVIDER=zitadel ./thaliumxctl.sh reseed-gateway
```

### Rollback: Legacy auth

```bash
THALIUMX_AUTH_PROVIDER=keycloak ./thaliumxctl.sh reseed-gateway
```

### Backend configuration knobs

Backend OIDC/Zitadel config lives in [`docker/compose/prod-v1/applications.yml`](docker/compose/prod-v1/applications.yml:190) under the `backend:` service:

- `ZITADEL_ISSUER` (default `https://auth.thaliumx.com`)
- `ZITADEL_JWKS_URI` (default `http://zitadel:8080/oauth/v2/keys`)
- `OIDC_ALLOWED_ISSUERS` (optional allowlist; if unset defaults to `ZITADEL_ISSUER`)
- `ZITADEL_AUDIENCE` (optional; if set, enforced)

Legacy auth settings remain unchanged (`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, etc.).

### Frontend (Zitadel PKCE)

The production frontend is configured to use Zitadel (`NEXT_PUBLIC_AUTH_MODE=zitadel`) in [`docker/compose/prod-v1/applications.yml`](docker/compose/prod-v1/applications.yml:432).

Important routing constraint:

- In prod-v1, `/auth/*` on `thaliumx.com` is reserved for the IdP proxy (APISIX routes it to the auth provider).
- The Zitadel OIDC redirect URI must therefore use a **non-`/auth`** path on the main site.

The frontend expects the OIDC redirect URI:

- `https://thaliumx.com/oidc/callback`

Make sure your Zitadel Application (public client, PKCE) includes:

- Redirect URIs: `https://thaliumx.com/oidc/callback`
- Allowed origins / CORS: `https://thaliumx.com`
- Grant type: Authorization Code + PKCE

Client settings used by the UI are:

- Issuer: `NEXT_PUBLIC_ZITADEL_ISSUER` (default `https://auth.thaliumx.com`)
- Client ID: `NEXT_PUBLIC_ZITADEL_CLIENT_ID` (default `thaliumx-frontend`)

## 4) Vault secret-format issues (common failure mode)

Some containers read secrets from Vault and then embed them into:

- URLs (Postgres DSNs, Redis URLs, SMTP URLs)
- JSON blobs
- shell exports

If a password contains special characters (notably `@`, `:`, `/`, `?`, `#`, `&`, `%`, whitespace, or newlines), different consumers may require different encodings.

The stack includes non-fatal checks in [`docker/scripts/prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1) to surface:

- “raw password used where URL-encoding is required”
- “newline/CRLF contamination in secrets”

Operational guideline:

- **Raw-password consumers** should receive the secret as-is (no URL encoding), trimmed of newlines.
- **URL/DSN consumers** should receive a URL-encoded password component.

## 5) Safety notes

- Do not run ad-hoc `docker compose` from other directories; use [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh:1) so the full prod-v1 file set is consistently applied.
- Prefer `status`/`doctor` over counting `docker ps` rows; init jobs exit by design.

## 6) Automated testing (Playwright)

The frontend includes Playwright E2E tests under [`docker/frontend/e2e/`](docker/frontend/e2e:1) with config in [`docker/frontend/playwright.config.ts`](docker/frontend/playwright.config.ts:1).

### Recommended approach for Zitadel-first

1. **Small IdP UI smoke** (optional)
   - A single login test can run against the real Zitadel UI and then persist auth state.
   - Setup test: [`docker/frontend/e2e/zitadel-auth.setup.ts`](docker/frontend/e2e/zitadel-auth.setup.ts:1)

2. **App E2E breadth** (stable)
   - Most tests should reuse the stored auth state and focus on platform flows.
   - Smoke spec: [`docker/frontend/e2e/zitadel-smoke.spec.ts`](docker/frontend/e2e/zitadel-smoke.spec.ts:1)

### Env vars used by the E2E harness

- `NEXT_PUBLIC_AUTH_MODE=zitadel`
- `NEXT_PUBLIC_E2E_TOKEN_PERSIST=1`
  - Stores the access token in localStorage in addition to sessionStorage so Playwright can reuse it.
  - See implementation in [`docker/frontend/src/lib/auth/zitadel.ts`](docker/frontend/src/lib/auth/zitadel.ts:1).
- `E2E_ZITADEL_LOGINNAME` / `E2E_ZITADEL_PASSWORD`
  - Enables the optional UI login setup test.

### Local run (example)

Run the stack (or your test subset), then run Playwright from `docker/`:

```bash
cd docker
NEXT_PUBLIC_AUTH_MODE=zitadel NEXT_PUBLIC_E2E_TOKEN_PERSIST=1 \
E2E_ZITADEL_LOGINNAME='root' E2E_ZITADEL_PASSWORD='...' \
pnpm --filter @thaliumx/frontend test:e2e
```
