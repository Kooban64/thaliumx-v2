# ThaliumX UI / Menu / CTA Audit Report (Main Platform + Token Presale)

Date: 2025-12-28 (UTC)

## 0) What this report is (and is not)

This is a **UI surface audit** of the deployed Next.js frontend in [`docker/frontend/src/app`](docker/frontend/src/app:1), cross-referenced against the Express backend routes mounted in [`ThaliumXBackend.setupRoutes()`](docker/backend/src/index.ts:419) and the gateway routing configuration in [`init-apisix-routes.sh`](docker/gateway/scripts/init-apisix-routes.sh:1).

For each menu/button/CTA I document:

* **Exact UI action** (href / onClick / form submit)
* **Network calls** it performs (frontend → `/api/*` → backend)
* **Backend requirements** (auth/roles/claims)
* **Status** (Working / Likely / Broken / Placeholder / Misleading)

> “Likely working” means: code contracts match; final confirmation still depends on runtime auth claims, role mapping, and service health.

---

## 1) Runtime state: running containers (what is actually deployed)

From `docker ps` at audit time, the platform is running in **audit profile** (no Wazuh/Ballerine/BLNK). The full running set is:

| Container | Image | Status |
|---|---|---|
| `thaliumx-frontend` | `thaliumx/frontend:1.0.0` | Up (healthy) |
| `thaliumx-backend` | `thaliumx/backend:1.0.0` | Up (healthy) |
| `thaliumx-apisix` | `apache/apisix:3.11.0-debian` | Up (healthy) |
| `thaliumx-apisix-dashboard` | `apache/apisix-dashboard:3.0.1-alpine` | Up (healthy) |
| `thaliumx-keycloak` | `quay.io/keycloak/keycloak:26.4.7` | Up (healthy) |
| `thaliumx-opa` | `openpolicyagent/opa:0.68.0` | Up (healthy) |
| `thaliumx-postgres` | `postgres:16.4-alpine` | Up (healthy) |
| `thaliumx-redis` | `redis:7.4-alpine` | Up (healthy) |
| `thaliumx-kafka` | `confluentinc/cp-kafka:7.8.0` | Up (healthy) |
| `thaliumx-schema-registry` | `confluentinc/cp-schema-registry:7.8.0` | Up (healthy) |
| `thaliumx-kafka-ui` | `provectuslabs/kafka-ui:v0.7.2` | Up (healthy) |
| `thaliumx-mongodb` | `mongo:8.2` | Up (healthy) |
| `thaliumx-etcd` | `quay.io/coreos/etcd:v3.5.15` | Up (healthy) |
| `thaliumx-typesense` | `typesense/typesense:28.0` | Up (healthy) |
| `thaliumx-citus-coordinator` | `citusdata/citus:12.1.6` | Up (healthy) |
| `thaliumx-citus-worker-1` | `citusdata/citus:12.1.6` | Up (healthy) |
| `thaliumx-citus-worker-2` | `citusdata/citus:12.1.6` | Up (healthy) |
| `thaliumx-timescaledb` | `timescale/timescaledb:2.24.0-pg16` | Up (healthy) |
| `thaliumx-vault` | `hashicorp/vault:1.21.1` | Up (healthy) |
| `thaliumx-dingir-restapi` | `thaliumx/dingir:1.0.0` | Up (healthy) |
| `thaliumx-dingir-matchengine` | `thaliumx/dingir:1.0.0` | Up (healthy) |
| `thaliumx-liquibook` | `thaliumx/liquibook:1.0.0` | Up (healthy) |
| `thaliumx-quantlib` | `thaliumx/quantlib:1.0.0` | Up (healthy) |
| `thaliumx-compliance-cex` | `thaliumx/compliance-cex:1.0.0` | Up (healthy) |
| `thaliumx-compliance-dex` | `thaliumx/compliance-dex:1.0.0` | Up (healthy) |
| `thaliumx-compliance-nft` | `thaliumx/compliance-nft:1.0.0` | Up (healthy) |
| `thaliumx-compliance-token` | `thaliumx/compliance-token:1.0.0` | Up (healthy) |
| `thaliumx-compliance-coordinator` | `thaliumx/compliance-coordinator:1.0.0` | Up (healthy) |
| `thaliumx-grafana` | `grafana/grafana:11.2.0` | Up (healthy) |
| `thaliumx-prometheus` | `prom/prometheus:v2.53.0` | Up (healthy) |
| `thaliumx-alertmanager` | `prom/alertmanager:v0.27.0` | Up (healthy) |
| `thaliumx-loki` | `grafana/loki:2.9.6` | Up (healthy) |
| `thaliumx-promtail` | `grafana/promtail:2.9.6` | Up (healthy) |
| `thaliumx-tempo` | `grafana/tempo:2.4.1` | Up (healthy) |
| `thaliumx-otel-collector` | `otel/opentelemetry-collector-contrib:0.112.0` | Up (healthy) |
| `thaliumx-cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | Up (healthy) |
| `thaliumx-blackbox-exporter` | `prom/blackbox-exporter:v0.25.0` | Up (healthy) |
| `thaliumx-postgres-exporter` | `prometheuscommunity/postgres-exporter:v0.16.0` | Up (healthy) |
| `thaliumx-redis-exporter` | `oliver006/redis_exporter:v1.62.0` | Up (healthy) |

One-shot init jobs that already ran and exited successfully:

| Container | Purpose | Status |
|---|---|---|
| `thaliumx-apisix-init` | bootstraps APISIX routes | Exited (0) |
| `thaliumx-kafka-init` | ensures Kafka topics exist | Exited (0) |

### 1.1) “Expected by compose” vs “actually created”

Using the full prod-v1 compose set, **2 expected one-shot services are not present at all** in `docker ps -a`:

| Missing container | Defined in | What it should do | Impact |
|---|---|---|---|
| `thaliumx-vault-unseal` | [`vault-unseal`](docker/compose/prod-v1/infrastructure.yml:48) | auto-unseal Vault at boot | Vault is healthy, so either manually unsealed or already unsealed from previous run; missing container means the one-shot unseal job never ran in this deployment |
| `thaliumx-keycloak-post-import-seed` | [`keycloak-post-import-seed`](docker/compose/prod-v1/applications.yml:141) | patch Keycloak client secrets/redirects after import | If realm import already contains correct settings, UI auth works; otherwise login/redirect issues can appear |

Operational hardening: start the stack via [`prod-v1-stack.sh`](docker/scripts/prod-v1-stack.sh:1) so these one-shot jobs are always executed:

* Audit mode: `docker/scripts/prod-v1-stack.sh audit`
* Full mode: `docker/scripts/prod-v1-stack.sh non-audit`

And verify drift/health via [`prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1).

### 1.2) Non-audit profile services (intentionally not deployed)

If the stack is started with `--profile non-audit`, **10 more containers** are expected (Wazuh + Ballerine + BLNK) and are currently not present:

* `thaliumx-wazuh-manager`, `thaliumx-wazuh-indexer`, `thaliumx-wazuh-dashboard`
* `thaliumx-ballerine-workflow`, `thaliumx-ballerine-backoffice`, `thaliumx-ballerine-postgres`
* `thaliumx-blnkfinance`, `thaliumx-blnkfinance-migrate`
* plus the same two one-shot jobs above


---

---

## 2) Gateway routing reality (affects every `/api/*` call)

APISIX routes are initialized by [`docker/gateway/scripts/init-apisix-routes.sh`](docker/gateway/scripts/init-apisix-routes.sh:1).

### 2.1) Key host/path routing

| Incoming | Routes to | Evidence |
|---|---|---|
| `https://thaliumx.com/*` | Frontend (Next.js) | [`create_route "1"`](docker/gateway/scripts/init-apisix-routes.sh:265) |
| `https://www.thaliumx.com/*` | Redirect → `thaliumx.com` | [`create_route "2"`](docker/gateway/scripts/init-apisix-routes.sh:283) |
| `https://thal.thaliumx.com/` | Frontend rewrite → `/token-presale` | [`create_route "3"`](docker/gateway/scripts/init-apisix-routes.sh:305) |
| `https://thal.thaliumx.com/*` (non-root) | Frontend (no rewrite) | [`create_route "30"`](docker/gateway/scripts/init-apisix-routes.sh:326) |
| `https://thaliumx.com/api/*` | Backend (Express) | [`create_route "4"`](docker/gateway/scripts/init-apisix-routes.sh:351) |

### 2.2) Tenant header injection

APISIX injects default tenant context into `/api/*` requests:

* `X-Tenant-ID: 10000000-0000-0000-0000-000000000000`

Evidence: [`proxy-rewrite.headers`](docker/gateway/scripts/init-apisix-routes.sh:361).

### 2.3) Next.js API routes caveat

Because APISIX routes `/api/*` to the backend, Next.js route handlers under [`docker/frontend/src/app/api`](docker/frontend/src/app/api:1) are not used for `/api/*` in prod.

---

## 3) Authentication model reality (drives “does this CTA work?”)

### 3.1) Backend expects Keycloak Bearer tokens

Backend auth middleware [`authenticateToken`](docker/backend/src/middleware/error-handler.ts:336) is Keycloak-first:

* No token → 401 `MISSING_TOKEN` ([`authenticateToken`](docker/backend/src/middleware/error-handler.ts:351))
* Non-Keycloak token issuer → 401 `INVALID_TOKEN` ([`authenticateToken`](docker/backend/src/middleware/error-handler.ts:359))

It maps token claims into `req.user` and sets:

* `req.user.id` and `req.user.userId` to `sub` ([`payload`](docker/backend/src/middleware/error-handler.ts:480))
* `req.user.roles` from realm/client roles ([`allRoles`](docker/backend/src/middleware/error-handler.ts:469))
* `req.user.role` to a **single selected** role based on a priority list ([`selectedRole`](docker/backend/src/middleware/error-handler.ts:473))
* `req.user.brokerId` from `broker_id`/`brokerId` claim ([`payload.brokerId`](docker/backend/src/middleware/error-handler.ts:487))

### 3.2) Frontend attaches Bearer tokens automatically (when available)

Frontend Keycloak integration:

* Initialize Keycloak: [`initKeycloak()`](docker/frontend/src/lib/auth/keycloak.ts:23)
* Store access token in memory: [`getAccessToken()`](docker/frontend/src/lib/auth/token-store.ts:16)
* Attach `Authorization: Bearer <token>` automatically: [`ApiClient.request()`](docker/frontend/src/lib/api/client.ts:174)

### 3.3) Legacy auth endpoints are disabled

Backend legacy email/password endpoints intentionally return HTTP 410 in [`legacyAuthGone`](docker/backend/src/routes/auth-router.ts:44). If the frontend is configured to show legacy login/register UI, it will be misleading (see §7.2).

---

## 4) UI surface inventory (pages/routes present)

From [`docker/frontend/src/app`](docker/frontend/src/app:1):

### 4.1) “47 menus” note

In the **current deployed Next.js frontend** in this repo, the navigational surface is much smaller than “47 menus”:

* **Global header** in [`RootLayout()`](docker/frontend/src/app/layout.tsx:22): 2 links (`Portfolio`, `Login`).
* **Landing header** in [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:9): 3 anchor links + 2 auth CTAs.
* **Dashboard sidebar** in [`sidebarItems`](docker/frontend/src/app/dashboard/page.tsx:137): 6 items.
* **Admin/Broker pages**: present but mostly “Coming soon” CTAs (no handlers).

If there is another UI (e.g. a separate admin console, backoffice, or broker portal) that contains ~47 menus, it is **not part of** [`docker/frontend/src/app`](docker/frontend/src/app:1) and is therefore **not auditable from this codebase**.

**Marketing / public:**

* `/` (redirects client-side to `/landing`) via [`Home()`](docker/frontend/src/app/page.tsx:6)
* `/landing` via [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:9)
* `/token-presale` via [`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:26)

**Auth:**

* `/auth` via [`AuthPage()`](docker/frontend/src/app/auth/page.tsx:5) → [`AuthClient()`](docker/frontend/src/app/auth/AuthClient.tsx:11)

**App:**

* `/dashboard` via [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:27)
* `/portfolio` via [`PortfolioPage()`](docker/frontend/src/app/portfolio/page.tsx:6)
* `/vesting` via [`VestingPage()`](docker/frontend/src/app/vesting/page.tsx:7)

**Wallet:**

* `/wallet/deposit` via [`DepositPage()`](docker/frontend/src/app/wallet/deposit/page.tsx:12)
* `/wallet/withdraw` via [`WithdrawPage()`](docker/frontend/src/app/wallet/withdraw/page.tsx:23)

**Admin (partially wired):**

* `/admin` via [`PlatformAdmin()`](docker/frontend/src/app/admin/page.tsx:6)
* `/admin/rbac` via [`RBACAdmin()`](docker/frontend/src/app/admin/rbac/page.tsx:8)
* `/admin/policies` via [`PolicyManagement()`](docker/frontend/src/app/admin/policies/page.tsx:51)
* `/broker` via [`BrokerAdmin()`](docker/frontend/src/app/broker/page.tsx:6)

**Legal:**

* `/privacy` via [`PrivacyPage()`](docker/frontend/src/app/privacy/page.tsx:1)
* `/terms` via [`TermsPage()`](docker/frontend/src/app/terms/page.tsx:1)

---

## 5) Global navigation / CTAs (root layout)

Header rendered on all pages by [`RootLayout()`](docker/frontend/src/app/layout.tsx:22):

| UI element | Action (exact) | Expected user-visible behavior | Backend dependency | Status |
|---|---|---|---|---|
| “Portfolio” | `href="/portfolio"` | Go to “My Presale Purchases” page | `GET /api/presale/investments` (auth) | **Likely OK when authenticated**; unauth shows error |
| “Login” | `href="/auth?next=/dashboard"` | Go to auth flow then return to dashboard | Keycloak | **OK** |

---

## 6) Landing page checklist (`/landing`)

Page: [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:9)

### 6.1) Navigation anchors

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Features” | `href="#features"` | Scroll to features section | **OK** |
| “How it works” | `href="#how"` | Scroll to how-it-works section | **OK** (section exists) |
| “Contact” | `href="#contact"` | Scroll to contact section | **OK** (section exists) |

### 6.2) Header CTAs

| UI element | Action (exact) | Expected | Backend dependency | Status |
|---|---|---|---|---|
| “Sign In” | `href="/auth?next=/dashboard"` | Go to Keycloak login | Keycloak | **OK** |
| “Launch App” | `href={appHref}` where `appHref` is `/dashboard` if authed else `/auth?next=/dashboard` | Enter app or auth then enter app | Keycloak + `/api/auth/profile` | **OK** |
| “Continue” (authed only) | `href="/dashboard"` | Return users directly to dashboard | Keycloak silent SSO | **OK** |

### 6.3) Hero CTAs

| UI element | Action (exact) | Expected | Backend dependency | Status |
|---|---|---|---|---|
| “Launch Trading” | `href={appHref}` | Go to trading dashboard | Auth + market data | **OK navigation**; trading submit depends on auth |
| “Join Presale” | `href="/token-presale"` | Navigate to presale page | `GET /api/presale/status` (public) | **OK** |

### 6.4) CTA section

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Create Account” | `href="/auth?next=/dashboard"` | Start Keycloak registration flow | **OK** |
| “Buy THAL” | `href="/token-presale"` | Go to presale page | **OK** |

### 6.5) Footer links

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Privacy” | `href="/privacy"` | Show privacy page | **OK (placeholder content)** |
| “Terms” | `href="/terms"` | Show terms page | **OK (placeholder content)** |

---

## 7) Token presale page checklist (`/token-presale`)

Page: [`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:26)

### 7.1) Header navigation CTAs

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Home” | `href="/landing"` | Back to marketing site | **OK** |
| “Trading” | `href="/dashboard"` | Enter app (auth may redirect) | **OK navigation** |
| “Presale” | `href="/token-presale"` | Current page | **OK** |
| “Sign In” (when not authed) | `href="/auth?next=/token-presale"` | Login then return | **OK** |
| “Launch App” (when not authed) | `href="/dashboard"` | Enter app | **OK navigation** |
| “Back to Dashboard” (when authed) | `href="/dashboard"` | Return to dashboard | **OK navigation** |

### 7.2) Data loading calls

| Functionality | Frontend call | Backend route | Auth? | Status |
|---|---|---|---:|---|
| Presale stats | `GET /api/presale/status` | [`GET /api/presale/status`](docker/backend/src/routes/presale.ts:178) | Public | **OK** |
| THAL price | `GET /api/market/prices/THAL` | [`GET /api/market/prices/:symbol`](docker/backend/src/routes/market-data.ts:20) | Public | **OK** |

### 7.3) Purchase form CTAs

| UI element | Action (exact) | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| “Purchase THAL Tokens” | `<form onSubmit={handlePurchase}>` | `POST /api/presale/investments` | [`POST /api/presale/investments`](docker/backend/src/routes/presale.ts:338) | Required | **Likely OK when authenticated** |
| Quick amount `$50/$100/$500/$1000` | set local state | none | none | n/a | **OK** |
| Payment method radio | set local state | none | none | n/a | **OK** |
| Inline “Sign in” link | navigate | none | none | n/a | **OK** |
| “Back to Home” | `href="/landing"` | none | none | n/a | **OK** |

Notes:

* This page explicitly injects the default tenant ID in headers ([`loadPresaleData()`](docker/frontend/src/app/token-presale/page.tsx:91)).
* It conditionally attaches `Authorization` via [`authzHeaders()`](docker/frontend/src/app/token-presale/page.tsx:67).

---

## 8) Auth page checklist (`/auth`)

Client logic lives in [`AuthClient()`](docker/frontend/src/app/auth/AuthClient.tsx:11).

### 8.1) Keycloak mode CTAs (expected production)

| UI element | Action (exact) | Expected | Status |
|---|---|---|---|
| “Continue” | `kc.login({ redirectUri: <origin + nextPath> })` | Login and return to `next` | **OK** |
| “Create account” | `kc.register({ redirectUri: <origin + nextPath> })` | Register and return to `next` | **OK** |

### 8.2) Legacy mode CTAs (should not be enabled)

If `NEXT_PUBLIC_AUTH_MODE=legacy`, the UI renders [`LoginForm`](docker/frontend/src/components/auth/LoginForm.tsx:27) / [`RegisterForm`](docker/frontend/src/components/auth/RegisterForm.tsx:18).

However the backend explicitly disables legacy email/password auth by returning **HTTP 410** for the legacy routes ([`legacyAuthGone`](docker/backend/src/routes/auth-router.ts:44)).

So in legacy mode, the UI contains **several CTAs that will always fail**:

| UI element | Frontend action | Frontend call | Backend route expectation | Status |
|---|---|---|---|---|
| Login form “Sign In” | submit | `POST /api/auth/login` | legacy login (disabled) | **BROKEN (410 Gone)** |
| MFA step “Verify Code” | submit | `POST /api/auth/verify-mfa` | legacy mfa verify (disabled) | **BROKEN (410 Gone)** |
| “Forgot password?” | toggle view | n/a | n/a | **OK UI** |
| Reset form “Send Reset Link” | submit | `POST /api/auth/reset-password` | legacy password reset (disabled) | **BROKEN (410 Gone)** |
| Register form “Create Account” | submit | `POST /api/auth/register` | legacy registration (disabled) | **BROKEN (410 Gone)** |
| Register success “Continue to Platform” | click | client redirect | n/a | **Misleading (no real auth session is created)** |

Status: **MISLEADING IF ENABLED** (Keycloak-first mode is required for a truthful auth UX in this stack).

---

## 9) Dashboard checklist (`/dashboard`)

Page: [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:27)

### 9.1) Auth gate

Dashboard checks auth via `GET /api/auth/profile` and redirects to `/auth` when unauthorized ([`checkAuth()`](docker/frontend/src/app/dashboard/page.tsx:40)).

Backend profile endpoint: [`GET /api/auth/profile`](docker/backend/src/routes/auth-router.ts:73).

Status: **OK**.

### 9.2) Sidebar menu items

Sidebar items are defined in `sidebarItems` and are either:

* an in-page tab switch (`setActiveTab()`), or
* a hard navigation (`window.location.href = ...`).

Evidence: [`sidebarItems`](docker/frontend/src/app/dashboard/page.tsx:137) and handler in the map ([`onClick`](docker/frontend/src/app/dashboard/page.tsx:191)).

| Menu item | Action (exact) | Expected | Status |
|---|---|---|---|
| Home | `window.location.href='/landing'` | Leave app → marketing site | **OK** |
| Trading | `setActiveTab('trading')` | Show chart + trading panel + web3 connector | **OK** |
| Wallet | `setActiveTab('wallet')` | Show balances + tx list + actions | **Balances likely OK**; tx list is mock |
| Portfolio | `setActiveTab('portfolio')` | Show portfolio analytics | **PLACEHOLDER** (static cards) |
| Analytics | `setActiveTab('analytics')` | Show analytics | **PLACEHOLDER** |
| Settings | `setActiveTab('settings')` | Manage account | **OK** (routes to Keycloak account console) |

### 9.3) Trading tab: CTAs and backend mapping

Component: [`TradingPanel`](docker/frontend/src/components/trading/TradingPanel.tsx:19)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| Buy/Sell toggle | local state | none | none | n/a | **OK** |
| Market/Limit toggle | local state | none | none | n/a | **OK** |
| Submit order | form submit | `POST /api/trading/order` | [`POST /api/trading/order`](docker/backend/src/routes/trading.ts:15) | Required | **Likely OK** |
| Quick amount 25/50/75/100% | button click | `GET /api/wallets/balance/BTC` | [`GET /api/wallets/balance/:currency`](docker/backend/src/routes/wallet-system.ts:280) | Required | **Likely OK** |

Notes:

* Backend trading route forwards into the native CEX layer and depends on token-derived user context ([`mockReq.body`](docker/backend/src/routes/trading.ts:21)).

### 9.4) Web3 wallets tab (inside trading tab)

Component: [`Web3WalletConnector`](docker/frontend/src/components/trading/Web3WalletConnector.tsx:28)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| “Connect MetaMask” | connect + sign + post | `POST /api/web3-wallet/connect` | [`POST /api/web3-wallet/connect`](docker/backend/src/routes/web3-wallet.ts:58) | Required + role | **Conditional** (requires brokerId claim) |
| Load connected wallets | on mount | `GET /api/web3-wallet/wallets` | [`GET /api/web3-wallet/wallets`](docker/backend/src/routes/web3-wallet.ts:137) | Required + role | **Conditional** |
| Enrich wallet balance | per wallet | `GET /api/web3-wallet/:address/balance/:chainId` | [`GET /api/web3-wallet/:address/balance/:chainId`](docker/backend/src/routes/web3-wallet.ts:168) | Required + role | **Conditional** |
| Disconnect | click | `DELETE /api/web3-wallet/:id/disconnect` | [`DELETE /api/web3-wallet/:walletId/disconnect`](docker/backend/src/routes/web3-wallet.ts:98) | Required + role | **Conditional** |
| Copy address | click | clipboard write | none | n/a | **OK** |

Critical dependency: backend requires `tenantId` **and** `brokerId` in the token or returns `USER_CONTEXT_MISSING` ([`web3-wallet.connect`](docker/backend/src/routes/web3-wallet.ts:68)).

Hardening note: the UI now proactively reads `/api/auth/profile` and **disables “Connect MetaMask”** when `brokerId` is missing, so the CTA is no longer a “click → surprise 400” experience ([`loadUserContext()`](docker/frontend/src/components/trading/Web3WalletConnector.tsx:41)).

### 9.5) Wallet tab

Component: [`WalletBalance`](docker/frontend/src/components/trading/WalletBalance.tsx:26)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| Load balances | on mount / refresh | `GET /api/wallets/balances` | [`GET /api/wallets/balances`](docker/backend/src/routes/wallet-system.ts:220) | Required | **Likely OK** |
| Refresh icon | click | same as above | same | Required | **Likely OK** |
| Deposit | link | navigate `/wallet/deposit` | n/a | n/a | **OK** |
| Withdraw | link | navigate `/wallet/withdraw` | n/a | n/a | **OK** |

Wallet tab “Recent Transactions” list is static mock markup in [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:309) and does not call backend.

### 9.6) Settings tab

| UI element | Action (exact) | Expected | Status |
|---|---|---|---|
| “Manage in Account Console” | `window.open(<keycloak account url>)` | Open Keycloak account console | **OK** |

Evidence: [`onClick`](docker/frontend/src/app/dashboard/page.tsx:437).

### 9.7) Sign Out

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Sign Out” | `kc.logout({ redirectUri: <origin>/landing })` | End SSO session and return to landing | **OK** |

Evidence: [`handleLogout()`](docker/frontend/src/app/dashboard/page.tsx:104).

---

## 10) Portfolio page checklist (`/portfolio`)

Page: [`PortfolioPage()`](docker/frontend/src/app/portfolio/page.tsx:6)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| Load purchases | on mount | `GET /api/presale/investments` | [`GET /api/presale/investments`](docker/backend/src/routes/presale.ts:429) | Required | **Likely OK** |

Note: unauthenticated users will see an error string; there is no redirect to login on this page.

---

## 11) Vesting page checklist (`/vesting`)

Page: [`VestingPage()`](docker/frontend/src/app/vesting/page.tsx:7)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| Load schedules | on mount | `GET /api/presale/vesting/user/me` | [`GET /api/presale/vesting/user/me`](docker/backend/src/routes/presale.ts:929) | Required | **Likely OK** |

Backend returns empty list when token does not include `walletAddress` claim ([`vesting/user/me`](docker/backend/src/routes/presale.ts:937)).

---

## 12) Wallet deposit checklist (`/wallet/deposit`)

Page: [`DepositPage()`](docker/frontend/src/app/wallet/deposit/page.tsx:12)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| “Back” | `href="/dashboard"` | Return to dashboard | n/a | n/a | **OK** |
| “Refresh Reference” | click | `GET /api/wallets/reference/persistent/:currency` | [`GET /api/wallets/reference/persistent/:currency`](docker/backend/src/routes/wallet-system.ts:373) | Required | **Likely OK** |

---

## 13) Wallet withdraw checklist (`/wallet/withdraw`)

Page: [`WithdrawPage()`](docker/frontend/src/app/wallet/withdraw/page.tsx:23)

| UI element | Action | Frontend call | Backend route | Auth? | Status |
|---|---|---|---|---:|---|
| “Back” | `href="/dashboard"` | Return to dashboard | n/a | n/a | **OK** |
| Load bank accounts | on mount / refresh | `GET /api/fiat/bank-accounts` | [`GET /api/fiat/bank-accounts`](docker/backend/src/routes/fiat.ts:449) | Required | **OK** (backend returns mock account) |
| “Submit withdrawal” | click | `POST /api/fiat/withdrawals` | [`POST /api/fiat/withdrawals`](docker/backend/src/routes/fiat.ts:227) | Required | **Likely OK** |
| “Deposit instead” | `href="/wallet/deposit"` | Go to deposit page | n/a | n/a | **OK** |

---

## 14) Admin pages checklist

### 14.1) Platform admin (`/admin`)

Page: [`PlatformAdmin()`](docker/frontend/src/app/admin/page.tsx:6)

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Back to App” | link → `/dashboard` | Return to app | **OK** |
| “Users” | opens Keycloak admin console users list | Manage users | **OK** (external) |
| “Clients” | opens Keycloak admin console clients list | Manage OIDC clients | **OK** (external) |
| “Broker Console” | link → `/broker` | Broker admin UI | **PLACEHOLDER** (page exists but no real ops) |
| “Approvals” | disabled button | Approvals workflow UI | **NOT IMPLEMENTED (disabled)** |
| “Manage Policies” | link → `/admin/policies` | Open policy management | **OK navigation** |
| “AML Rules” | link → `/admin/policies?category=aml` | Open AML policy category | **OK navigation** |
| “Security” | link → `/admin/policies?category=security` | Open security policy category | **OK navigation** |
| “Audit Log” | link → `/admin/policies?audit=1` | Open policy audit log view | **OK navigation** |
| “Reports / SAR Filing” | disabled buttons | Compliance reporting | **NOT IMPLEMENTED (disabled)** |

### 14.2) RBAC admin (`/admin/rbac`)

Page: [`RBACAdmin()`](docker/frontend/src/app/admin/rbac/page.tsx:8)

| UI element | Action | Expected | Status |
|---|---|---|---|
| “Back” | link → `/admin` | Return | **OK** |
| “Add” role | disabled button | Create role via backend | **NOT IMPLEMENTED (disabled)** |

### 14.3) Policy management (`/admin/policies`)

Page: [`PolicyManagement()`](docker/frontend/src/app/admin/policies/page.tsx:51)

Frontend uses the centralized API client, which attaches Bearer tokens when present (see [`ApiClient.request()`](docker/frontend/src/lib/api/client.ts:174)).

| UI element | Action | Frontend call(s) | Backend route(s) | Status |
|---|---|---|---|---|
| Category switcher (AML/Security/Trading/RBAC) | click | `GET /api/admin/policies/parameters/:category` | [`GET /api/admin/policies/parameters/:category`](docker/backend/src/routes/policy-management.ts:72) | **Conditional** |
| “Refresh” | click | same GET | same | **Conditional** |
| “Save Changes” | click | `PUT /api/admin/policies/parameters/:category` | [`PUT /api/admin/policies/parameters/:category`](docker/backend/src/routes/policy-management.ts:115) | **Conditional** |
| Preset apply | click+confirm | `POST /api/admin/policies/presets/:preset/apply` | [`POST /api/admin/policies/presets/:preset/apply`](docker/backend/src/routes/policy-management.ts:495) | **Conditional** |
| “Show/Hide Audit Log” | click | `GET /api/admin/policies/audit` | [`GET /api/admin/policies/audit`](docker/backend/src/routes/policy-management.ts:439) | **Conditional** |
| “Evaluate Policy” | click | `POST /api/admin/policies/evaluate` | [`POST /api/admin/policies/evaluate`](docker/backend/src/routes/policy-management.ts:233) | **Conditional** |

Why “Conditional”:

* Backend policy-management uses `requireAdmin` which checks `req.user.role` against `['admin','super_admin','compliance_officer']` ([`requireAdmin`](docker/backend/src/routes/policy-management.ts:26)).
* `authenticateToken` derives `req.user.role` via a priority list ([`selectedRole`](docker/backend/src/middleware/error-handler.ts:473)). If Keycloak role mapping results in `platform-admin` only, the policy UI will 403 even though the user is “admin-ish”.

---

## 15) Broker admin checklist (`/broker`)

Page: [`BrokerAdmin()`](docker/frontend/src/app/broker/page.tsx:6)

Status: **PLACEHOLDER** (no backend calls; only “Back to App” link).

---

## 16) Legal pages checklist

| Page | CTA(s) | Status |
|---|---|---|
| `/privacy` via [`PrivacyPage()`](docker/frontend/src/app/privacy/page.tsx:1) | mailto link | **OK (placeholder content)** |
| `/terms` via [`TermsPage()`](docker/frontend/src/app/terms/page.tsx:1) | mailto link | **OK (placeholder content)** |

---

## 17) Summary: CTA truthfulness (high confidence)

### Working (or very likely)

* Landing page navigation + CTAs are correctly wired (anchors + links) ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:9)).
* Token presale page loads public data and submits purchases when authenticated ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:112)).
* Dashboard auth gate and sign-out flow are wired to Keycloak ([`checkAuth()`](docker/frontend/src/app/dashboard/page.tsx:40), [`handleLogout()`](docker/frontend/src/app/dashboard/page.tsx:104)).
* Wallet balances tab is wired to a real backend endpoint ([`WalletBalance.loadBalances()`](docker/frontend/src/components/trading/WalletBalance.tsx:36)).
* Deposit/withdraw pages are wired to backend endpoints (with the caveat that bank accounts are currently mock) ([`DepositPage.refresh()`](docker/frontend/src/app/wallet/deposit/page.tsx:36), [`WithdrawPage.submit()`](docker/frontend/src/app/wallet/withdraw/page.tsx:77)).

### Placeholder / misleading

* Dashboard “Portfolio” and “Analytics” tabs are UI-only placeholders (static content) ([`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:355)).
* `/broker` is still placeholder (no backend calls) ([`BrokerAdmin()`](docker/frontend/src/app/broker/page.tsx:6)).
* `/admin/rbac` “Add” is not implemented (now explicitly disabled, so it is no longer a dead CTA) ([`RBACAdmin()`](docker/frontend/src/app/admin/rbac/page.tsx:8)).
* Legacy login/register UI is misleading if enabled, because backend returns 410 for those routes ([`legacyAuthGone`](docker/backend/src/routes/auth-router.ts:44)).

### Conditional (depends on token claims / role mapping)

* Web3 wallet connect/list/disconnect requires `tenantId` and `brokerId` claims in the token ([`USER_CONTEXT_MISSING`](docker/backend/src/routes/web3-wallet.ts:68)).
* Policy management requires backend `req.user.role` to be one of `admin|super_admin|compliance_officer` ([`requireAdmin`](docker/backend/src/routes/policy-management.ts:26)).

---

## 18) Highest priority fixes (to make CTAs “truthful”)

1) **Fix admin role mapping** so Keycloak-admin users are recognized by policy-management.

* Option A (preferred): change policy-management to use shared RBAC middleware: [`requireRole()`](docker/backend/src/middleware/error-handler.ts:511) with aliases.
* Option B: expand `requireAdmin` to accept role names used in Keycloak (`platform-admin`, etc.) and/or check `req.user.roles`.

2) **Remove or implement placeholder CTAs** on `/admin` and `/admin/rbac`.

* `/admin` top-level CTAs were hardened: key actions now navigate to real destinations and non-implemented ones are disabled (no silent no-ops) ([`PlatformAdmin()`](docker/frontend/src/app/admin/page.tsx:6)).

3) **Decide what “Portfolio” means in-dashboard** (the `/portfolio` route is real; the dashboard tab is placeholder). Either wire it or remove the tab.

4) **Ensure tokens include broker context** if Web3 wallet is a core feature (set `broker_id` claim at Keycloak) so those CTAs are not “conditionally broken”.

---

## 19) QA checkbox list (manual verification) — Landing + Presale

Use this as a **click-through acceptance checklist** in a browser.

### 19.1) Main landing page (`/landing`)

- [ ] Header link `Features` scrolls to `#features` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:54))
- [ ] Header link `How it works` scrolls to `#how` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:56))
- [ ] Header link `Contact` scrolls to `#contact` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:57))
- [ ] Header CTA `Sign In` navigates to `/auth?next=/dashboard` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:71))
- [ ] Header CTA `Launch App`:
  - [ ] unauth → `/auth?next=/dashboard`
  - [ ] authed → `/dashboard`
  ([`appHref`](docker/frontend/src/app/landing/page.tsx:42))
- [ ] Hero CTA `Launch Trading` follows same behavior as `Launch App` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:92))
- [ ] Hero CTA `Join Presale` navigates to `/token-presale` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:96))
- [ ] CTA section `Create Account` opens Keycloak registration flow (via `/auth` page, `Create account` button) ([`AuthClient`](docker/frontend/src/app/auth/AuthClient.tsx:101))
- [ ] CTA section `Buy THAL` navigates to `/token-presale` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:196))
- [ ] Footer link `Privacy` opens `/privacy` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:206))
- [ ] Footer link `Terms` opens `/terms` ([`LandingPage()`](docker/frontend/src/app/landing/page.tsx:207))

### 19.2) Token presale landing page (`/token-presale` and `https://thal.thaliumx.com/`)

- [ ] `https://thal.thaliumx.com/` loads the presale UI (rewritten to `/token-presale`) ([`create_route "3"`](docker/gateway/scripts/init-apisix-routes.sh:305))
- [ ] Header nav `Home` opens `/landing` ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:184))
- [ ] Header nav `Trading` opens `/dashboard` ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:185))
- [ ] Header nav `Presale` stays on `/token-presale` ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:186))
- [ ] Stats grid renders without exceptions:
  - [ ] `Total Raised`
  - [ ] `Target`
  - [ ] `Participants`
  - [ ] `Time Remaining`
  (populated by [`GET /api/presale/status`](docker/backend/src/routes/presale.ts:178))
- [ ] Price label `1 THAL = $X` loads from [`GET /api/market/prices/:symbol`](docker/backend/src/routes/market-data.ts:20)
- [ ] When **not authenticated**:
  - [ ] “Sign in to purchase tokens” banner is visible ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:307))
  - [ ] Amount input is disabled ([`disabled={...!isAuthenticated}`](docker/frontend/src/app/token-presale/page.tsx:326))
  - [ ] Submit CTA is disabled ([`disabled={...!isAuthenticated}`](docker/frontend/src/app/token-presale/page.tsx:384))
- [ ] When **authenticated**:
  - [ ] Amount input accepts values
  - [ ] Quick amount buttons set amount
  - [ ] Submit CTA posts to [`POST /api/presale/investments`](docker/backend/src/routes/presale.ts:338)
- [ ] Footer links `Home/Trading/Presale` behave as expected ([`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:488))
