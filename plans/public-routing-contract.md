# ThaliumX Public Routing Contract (APISIX)

This is the expected externally visible behavior when APISIX is the only public entrypoint.

## Domains

### [`thaliumx.com`](docker/gateway/scripts/init-apisix-routes.sh:232)
- `/` and all frontend paths are served by the frontend upstream.
- `/api/*` is proxied to the backend upstream.

### [`thal.thaliumx.com`](docker/gateway/scripts/init-apisix-routes.sh:267)
- `/` **must** rewrite to `/token-presale` (token sale landing).
- All other paths (`/*`) are served by the frontend upstream without rewrite.

### [`auth.thaliumx.com`](docker/gateway/scripts/init-apisix-routes.sh:544)
- `/` redirects to `/auth`.
- `/auth/*` proxies to Keycloak (running under `/auth`).

## Auth expectations

### API authorization
- Protected APIs use **Keycloak bearer tokens** validated at the gateway via the APISIX `openid-connect` plugin.
- Public endpoints are carved out by higher priority routes:
  - `/api/csrf-token`
  - `/api/presale/status`
  - `/api/market/prices/*`

See protected route creation in [`init-apisix-routes.sh`](docker/gateway/scripts/init-apisix-routes.sh:477).

## Smoke test
Run the repo smoke test:
- [`docker/scripts/gateway-smoke-test.sh`](docker/scripts/gateway-smoke-test.sh:1)

