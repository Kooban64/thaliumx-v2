# Keycloak Deprecation Inventory (for future removal after Zitadel cutover)

This file is a **map of Keycloak coupling points** in this repo.

Goal:

- Make it straightforward to remove Keycloak **after** Zitadel is fully proven.
- Keep the current system working (no deletions, no functionality loss).

We use the grep-able tag:

- `THALIUMX_KEYCLOAK_DEPRECATE`

You can locate all tagged locations with:

```bash
rg "THALIUMX_KEYCLOAK_DEPRECATE" -n
```

## Primary runtime components

### Keycloak container (prod-v1)

- Keycloak service definition: [`docker/compose/prod-v1/applications.yml`](docker/compose/prod-v1/applications.yml:14)
- One-shot post-import patcher: [`docker/compose/prod-v1/applications.yml`](docker/compose/prod-v1/applications.yml:141)

### APISIX routing that exposes Keycloak under `/auth/*`

- Route generator references Keycloak upstream and OIDC discovery: [`docker/gateway/scripts/init-apisix-routes.sh`](docker/gateway/scripts/init-apisix-routes.sh:1)

### Observability content

- Prometheus scrape job and alerts refer to “keycloak”: [`docker/observability/config/prometheus.yml`](docker/observability/config/prometheus.yml:1)
- Grafana dashboard: [`docker/observability/config/grafana/dashboards/keycloak-dashboard.json`](docker/observability/config/grafana/dashboards/keycloak-dashboard.json:1)

## Backend code coupling

### Keycloak admin API service

- Main integration surface: [`docker/backend/src/services/keycloak.ts`](docker/backend/src/services/keycloak.ts:1)

This is the highest-risk coupling because it uses Keycloak-specific admin behaviors (realms/clients/users/roles).

### REST endpoints explicitly named `/api/keycloak/*`

- Router: [`docker/backend/src/routes/keycloak.ts`](docker/backend/src/routes/keycloak.ts:1)
- Mounted in API app: [`docker/backend/src/index.ts`](docker/backend/src/index.ts:1)

### Token verification path assumes Keycloak endpoints

- Auth middleware uses Keycloak JWKS/introspection URLs: [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:1)

## Secrets / Vault

- Keycloak Vault policy: [`docker/vault/policies/keycloak.hcl`](docker/vault/policies/keycloak.hcl:1)
- Vault seeding helper: [`docker/vault/scripts/populate-keycloak-secrets.sh`](docker/vault/scripts/populate-keycloak-secrets.sh:1)

## Removal sequencing (when ready)

1) Switch OIDC issuer to Zitadel (frontend + gateway + backend verification)
2) Remove Keycloak admin API dependencies from backend:
   - replace with provider-agnostic OIDC + app DB tenancy/roles
3) Remove `/api/keycloak/*` endpoints
4) Remove Keycloak container + post-import seeding job
5) Remove APISIX `/auth/*` proxy routes (or repoint to Zitadel if you keep `/auth` path)
6) Remove Keycloak observability dashboards/alerts
7) Remove Keycloak Vault policy and seeding scripts (if no longer needed)

