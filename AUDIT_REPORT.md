# ThaliumX v1 – Code/Config Security Audit Report

Date: 2025-12-25

## Scope

This audit is based on:

1. Repository-wide static scans for common secret patterns, insecure defaults, and Docker hardening gaps.
2. Targeted manual review of the highest-risk areas surfaced by scans (Docker orchestration, Keycloak bootstrap, trading stack configs).

It does **not** include:

* Full SAST/DAST runs, dependency CVE enumeration across every lockfile, or runtime penetration testing.

## Executive Summary (Top Critical Issues)

### 1) Real private keys and TLS material are committed to the repo (Critical)

Multiple production-like private keys are present in version control, including CA keys.

Examples:

* Vault TLS private key: [docker/vault/tls/vault.key:1](docker/vault/tls/vault.key:1)
* Citus/Postgres SSL private key: [docker/citus/ssl/server.key:1](docker/citus/ssl/server.key:1)
* Wazuh indexer/dashboard/admin/root CA private keys: [docker/wazuh/config/wazuh_indexer_ssl_certs/root-ca-key.pem:1](docker/wazuh/config/wazuh_indexer_ssl_certs/root-ca-key.pem:1)
* CA private key used by other service certs: [docker/certs/ca/ca.key:1](docker/certs/ca/ca.key:1)
* Many service keys under `docker/certs/services/*/*.key`: e.g. [docker/certs/services/vault/vault.key:1](docker/certs/services/vault/vault.key:1)

**Impact:** If this repository has ever been shared outside a tightly controlled perimeter, assume compromise of TLS trust and mutual-TLS identity. Attackers can impersonate services, decrypt traffic (in some scenarios), and/or sign leaf certificates.

**Immediate remediation:**

* Rotate/re-issue all impacted certificates and all downstream identities.
* Treat the entire PKI chain as compromised (especially any CA keys present).
* Purge from git history (BFG / filter-repo) and add guardrails (pre-commit + CI secret scanning).

---

### 2) Hard-coded Vault tokens, DB passwords, JWT secrets, and API keys in compose/config (Critical)

Direct secrets are embedded into production-like compose files and `.env`.

Examples:

* Vault token hard-coded in “safe” trading stack: [docker/compose/prod-v1/trading-safe.yml:43](docker/compose/prod-v1/trading-safe.yml:43)
* DB password + Redis password hard-coded in commands/env: [docker/compose/prod-v1/trading-safe.yml:27](docker/compose/prod-v1/trading-safe.yml:27), [docker/compose/prod-v1/trading-safe.yml:35](docker/compose/prod-v1/trading-safe.yml:35)
* “Production” JWT secret hard-coded: [docker/compose/prod-v1/trading-safe.yml:201](docker/compose/prod-v1/trading-safe.yml:201)
* Infura project ID embedded: [docker/compose/prod-v1/trading-safe.yml:197](docker/compose/prod-v1/trading-safe.yml:197)
* Repo `.env` contains Vault dev root token and Vault token: [docker/.env:43](docker/.env:43)

**Impact:** Total compromise of secrets management boundaries. Anyone with repo access can authenticate to Vault, databases, and JWT-protected APIs.

**Immediate remediation:**

* Rotate all tokens/secrets referenced in committed files.
* Replace with injected secrets via Vault AppRole/Kubernetes auth/Vault Agent templates (or Docker secrets in Swarm).
* Add policy enforcement: forbid `VAULT_TOKEN=` in repository configs (except templated placeholders).

---

### 3) Default credentials / insecure bootstrap credentials exist in multiple stacks (Critical)

#### Grafana default password

Grafana uses a default password fallback:

* [docker/observability/compose.yaml:63](docker/observability/compose.yaml:63)

#### Keycloak admin password fallback to `admin`

Keycloak client config uses a fallback admin password when env is unset:

* [docker/backend/src/services/keycloak.ts:760](docker/backend/src/services/keycloak.ts:760)
* The fallback is set here: [docker/backend/src/services/keycloak.ts:791](docker/backend/src/services/keycloak.ts:791)

#### Platform and tenant bootstrap users seeded with default passwords

This code seeds multiple high-privilege users with default passwords if env is missing:

* Platform admin default: [docker/backend/src/services/keycloak.ts:1676](docker/backend/src/services/keycloak.ts:1676)
* Tenant admin default: [docker/backend/src/services/keycloak.ts:1864](docker/backend/src/services/keycloak.ts:1864)

**Impact:** In production or misconfigured deployments, takeover of Grafana/Keycloak and platform administration.

**Immediate remediation:**

* Remove all default-password fallbacks for production paths.
* Require explicit env/secret manager inputs at boot (fail fast).
* If bootstrap users are required: generate one-time passwords and force rotation on first login.

---

### 4) Repo contains runtime data directories with restricted permissions (Critical / Hygiene)

During repository inspection, `find` hit permission errors consistent with committed runtime data (e.g., Vault raft state):

* `find: ‘docker/vault/data/raft’: Permission denied` (observed during audit)

**Impact:** Operational data leakage risk; also breaks tooling and indicates environment artifacts are being committed.

**Immediate remediation:**

* Remove runtime state directories from the repo and git history.
* Enforce `.gitignore` for all `data/`, `raft/`, `wal/`, etc.

---

### 5) `node_modules/` appears committed in several locations (Critical / Supply chain + repo health)

Manifest enumeration showed massive nested `node_modules` directories under `docker/*` and `ballerine/*`.

Example symptom from repo scans: private key fixtures found under vendored dependencies (not an app secret, but indicates vendored deps):

* [ballerine/node_modules/.pnpm/ssh2@1.16.0/node_modules/ssh2/test/fixtures/id_rsa:1](ballerine/node_modules/.pnpm/ssh2@1.16.0/node_modules/ssh2/test/fixtures/id_rsa:1)

**Impact:**

* You cannot reliably audit dependencies if vendored directories drift from lockfiles.
* Inflated attack surface and accidental secret inclusion.
* Source control performance and reviewability collapse.

**Immediate remediation:**

* Remove all `node_modules/` from git and enforce ignore rules.
* Rebuild from lockfiles in CI.

## High Severity Findings

### A) Use of `:latest` image tags in production-like compose files

Using `:latest` prevents reproducible deploys and can silently introduce CVEs or breaking changes.

Examples:

* Vault: [docker/vault/docker-compose.yml:5](docker/vault/docker-compose.yml:5)
* Certbot: [docker/ssl-certs/compose.yaml:27](docker/ssl-certs/compose.yaml:27)
* Kafka UI: [docker/kafka/compose.yaml:68](docker/kafka/compose.yaml:68)
* Multiple internal images: [docker/compose/prod-v1/applications.yml:129](docker/compose/prod-v1/applications.yml:129)

**Remediation:** pin to specific immutable tags (or digests `@sha256:`) and define an upgrade process.

### B) Plain HTTP to Vault used in “prod-v1” trading stacks

Examples:

* [docker/compose/prod-v1/trading-safe.yml:43](docker/compose/prod-v1/trading-safe.yml:43)

**Impact:** Vault token exposure on the internal network; makes MITM feasible inside the cluster.

**Remediation:** enforce TLS-only Vault, validate CA bundle, and remove `VAULT_TOKEN` from env paths in favor of AppRole + short-lived tokens.

### C) Secrets echoed to logs

Trading command echoes URLs that contain credentials:

* [docker/compose/prod-v1/trading-safe.yml:34](docker/compose/prod-v1/trading-safe.yml:34)

**Impact:** credential leakage via container logs / centralized logging.

**Remediation:** never log DSNs; log only redacted connection targets.

## Medium Severity Findings

### A) Insecure TLS verification bypass in staging script

Staging deploy script uses `curl -k` / `--insecure`:

* [deploy-staging.sh:328](deploy-staging.sh:328)

**Impact:** normalizes MITM; can mask invalid cert chains or configuration errors.

**Remediation:** remove `-k`, provide correct CA bundle, and fail deployment if TLS validation fails.

### B) Password policy minimums appear weak for a financial platform

Keycloak realm password policy is set to `length(8)` and allows relatively short passwords:

* [docker/backend/src/services/keycloak.ts:1074](docker/backend/src/services/keycloak.ts:1074)

**Remediation:** set stronger policies (length >= 12–14, breach checks if available, lockouts, MFA enforcement for admin roles).

### C) Blockchain contracts tooling uses placeholder RPC endpoints but still supports raw private key injection

The Hardhat configuration expects a single `PRIVATE_KEY` environment variable for signing, and includes placeholder RPC URLs:

* Accounts from `process.env.PRIVATE_KEY`: [blockchain-contracts/hardhat.config.js:29](blockchain-contracts/hardhat.config.js:29)
* Infura placeholder URL: [blockchain-contracts/hardhat.config.js:34](blockchain-contracts/hardhat.config.js:34)
* Fork mode references Alchemy with placeholder: [blockchain-contracts/package.json:24](blockchain-contracts/package.json:24)

**Impact:** This is not automatically insecure, but it encourages developer workflows where raw private keys are placed into shell env / `.env` files, which frequently end up in shell history, CI logs, or accidental commits.

**Remediation:**

* Prefer hardware wallets / remote signers for production deploys.
* If a key must exist: load it only from a secret manager (Vault transit signing, KMS, etc.), not from plaintext `.env`.

## Structural / Operational Risk Observations

### 1) Multiple overlapping “prod” compose stacks

Repository contains many archived and active production compose variants, increasing misconfiguration risk:

* `docker/compose/archive/*` vs `docker/compose/prod-v1/*` (see file listing produced during audit)

**Risk:** teams may deploy the wrong variant (e.g., a legacy “no-tls” stack).

**Remediation:**

* Reduce to a single supported deployment path.
* Gate deprecated stacks behind explicit `profiles` or move them out of the main repo.

## Prioritized Remediation Plan

### P0 (within 24–48h)

1. Rotate/revoke all committed secrets: Vault root/dev tokens, JWT secrets, DB passwords, Infura/API keys.
2. Rotate PKI: assume CA compromise if any CA private keys were committed (e.g. [docker/certs/ca/ca.key:1](docker/certs/ca/ca.key:1)).
3. Remove `node_modules/` from the repo; rebuild from lockfiles.
4. Purge secrets and private keys from git history.

### P1 (this week)

1. Replace all default credentials and password fallbacks; enforce fail-fast configuration in production.
2. Remove `:latest` tags; pin image digests.
3. Move “safe/trading” hard-coded secrets to a proper secret delivery mechanism.

### P2 (this month)

1. Establish CI security checks (secret scanning + IaC scanning + dependency scanning).
2. Normalize deployment artifacts and remove legacy compose stacks.
3. Add threat modeling and security requirements for each service boundary.
