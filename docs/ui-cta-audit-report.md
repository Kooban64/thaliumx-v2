# ThaliumX UI / Menu / CTA Audit Report (Main Platform + Token Presale)

Date: 2025-12-28 (UTC)

## 0) Scope / What I audited

This report covers the **Next.js “Exchange Frontend”** in [`docker/frontend/package.json`](docker/frontend/package.json:1) and how its **menus / buttons / CTAs** map to backend routes implemented by the **Express “Backend Server”** in [`docker/backend/src/index.ts`](docker/backend/src/index.ts:1).

It also includes a snapshot of the currently running Docker containers (to validate what is actually deployed).

### Important routing note (affects every /api call)

In production v1, APISIX routes:

* `GET/POST/etc /api/*` → **backend** (Express)
* `/*` → **frontend** (Next.js)

This is configured by APISIX route init scripts, see [`docker/apisix/scripts/setup-apisix-routes.sh`](docker/apisix/scripts/setup-apisix-routes.sh:167).

Implication:

* Any Next.js API routes under [`docker/frontend/src/app/api`](docker/frontend/src/app/api:1) are **not used** in prod if APISIX is routing `/api/*` to the backend.
* Frontend fetches like `fetch('/api/...')` are reaching the backend directly.

---

## 1) Runtime state: containers/services running

Snapshot from `docker ps` (2025-12-28):

* Gateway: `thaliumx-apisix` (80/443 published)
* Frontend: `thaliumx-frontend` (Next.js)
* Backend: `thaliumx-backend` (Express)
* Keycloak: `thaliumx-keycloak`
* OPA: `thaliumx-opa`
* Compliance: `thaliumx-compliance-cex`, `thaliumx-compliance-dex`, `thaliumx-compliance-nft`, `thaliumx-compliance-token`
* Trading engine: `thaliumx-dingir-matchengine`, `thaliumx-dingir-restapi`
* Data/messaging/obs: Postgres, Redis, Kafka, Prometheus, Grafana, Loki, Tempo, etc.

All of the above were “Up (healthy)” at time of inspection.

---

## 2) Auth model reality check (this drives “does this CTA work?”)

Backend middleware [`authenticateToken`](docker/backend/src/middleware/error-handler.ts:336) is **Keycloak-first** and rejects requests without a Bearer token:

* No token → 401 `MISSING_TOKEN` ([`authenticateToken`](docker/backend/src/middleware/error-handler.ts:351))
* Non-Keycloak token → 401 `INVALID_TOKEN` ([`authenticateToken`](docker/backend/src/middleware/error-handler.ts:359))

So any frontend calls relying on cookies only (e.g. `credentials: 'include'` without `Authorization`) are expected to fail.

Frontend’s Keycloak integration is in [`initKeycloak()`](docker/frontend/src/lib/auth/keycloak.ts:23) and stores the token in an in-memory store [`getAccessToken()`](docker/frontend/src/lib/auth/token-store.ts:16).

---

## 3) Frontend route inventory (pages that exist)

From [`docker/frontend/src/app`](docker/frontend/src/app:1):

**Public / marketing:**

* `/` (client redirect) → `/landing` via [`Home()`](docker/frontend/src/app/page.tsx:6)
* `/landing` via [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:7)
* `/token-presale` via [`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:26)

**Auth:**

* `/auth` via [`AuthPage()`](docker/frontend/src/app/auth/page.tsx:5) and [`AuthClient`](docker/frontend/src/app/auth/AuthClient.tsx:11)

**App:**

* `/dashboard` via [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:27)
* `/portfolio` via [`PortfolioPage()`](docker/frontend/src/app/portfolio/page.tsx:5)
* `/vesting` via [`VestingPage()`](docker/frontend/src/app/vesting/page.tsx:7)

**Admin (UI placeholders):**

* `/admin` via [`PlatformAdmin()`](docker/frontend/src/app/admin/page.tsx:6)
* `/admin/rbac` via [`RBACAdmin()`](docker/frontend/src/app/admin/rbac/page.tsx:8)
* `/admin/policies` via [`PolicyManagement()`](docker/frontend/src/app/admin/policies/page.tsx:48)
* `/broker` via [`BrokerAdmin()`](docker/frontend/src/app/broker/page.tsx:6)

**Wallet flows:**

* `/wallet/deposit` via [`DepositPage()`](docker/frontend/src/app/wallet/deposit/page.tsx:14)
* `/wallet/withdraw` via [`WithdrawPage()`](docker/frontend/src/app/wallet/withdraw/page.tsx:26)

**Legal:**

* `/privacy` via [`PrivacyPage()`](docker/frontend/src/app/privacy/page.tsx:1)
* `/terms` via [`TermsPage()`](docker/frontend/src/app/terms/page.tsx:1)

---

## 4) Global navigation / CTAs (root layout)

Header links rendered on all pages (root layout): [`RootLayout()`](docker/frontend/src/app/layout.tsx:22)

| UI element | Location | Action | Expected | Actual status | Evidence |
|---|---:|---|---|---|---|
| “Portfolio” link | Header | Navigate to `/portfolio` | Show logged-in user’s portfolio/presale purchases | **Loads page**, but **API call likely fails in Keycloak mode** (no Authorization header) | [`layout.tsx`](docker/frontend/src/app/layout.tsx:32), [`PortfolioPage()`](docker/frontend/src/app/portfolio/page.tsx:10) |
| “Login” link | Header | Navigate to `/auth?next=/dashboard` | Start Keycloak sign-in then redirect to dashboard | **OK** in Keycloak mode | [`layout.tsx`](docker/frontend/src/app/layout.tsx:36), [`AuthClient`](docker/frontend/src/app/auth/AuthClient.tsx:83) |

---

## 5) Landing page checklist (/landing)

Page: [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:7)

### 5.1) Navigation links

| UI element | Action | Expected | Actual status | Notes / risks |
|---|---|---|---|---|
| “Features” | Anchor `#features` | Scroll to features section | **OK** | Static anchor [`landing/page.tsx`](docker/frontend/src/app/landing/page.tsx:32) |
| “How it works” | Anchor `#how` | Scroll to section | **OK** | Section exists (`<section id="how">`) in [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:108) |
| “Contact” | Anchor `#contact` | Scroll to contact section | **OK** | Section exists (`<section id="contact">`) in [`LandingPage()`](docker/frontend/src/app/landing/page.tsx:146) |

### 5.2) Primary CTAs (header)

| UI element | Action | Expected | Actual status | Backend dependency |
|---|---|---|---|---|
| “Sign In” | Go to `/auth?next=/dashboard` | Keycloak login | **OK** | Keycloak client-side login via [`AuthClient`](docker/frontend/src/app/auth/AuthClient.tsx:86) |
| “Launch App” | Go to `/dashboard` | Load dashboard; redirect to login if not authed | **OK navigation**; **dashboard internals partially broken** | Backend profile check is valid but later user API call is wrong (see §7). |

### 5.3) Hero CTAs (main)

| UI element | Action | Expected | Actual status | Backend dependency |
|---|---|---|---|---|
| “Launch Trading” | Go to `/dashboard` | Trading UI | **OK navigation**; trading actions mostly broken (see §7.2) | Requires `/api/trading/order` with Bearer token (missing) |
| “Join Presale” | Go to `/token-presale` | Presale landing + purchase | **OK** | Uses backend `/api/presale/status` (public) + `/api/presale/investments` (protected) |

### 5.4) CTA section

| UI element | Action | Expected | Actual status | Notes |
|---|---|---|---|---|
| “Create Account” | Go to `/auth?next=/dashboard` | Keycloak register | **OK** in Keycloak mode | Uses [`kc.register()`](docker/frontend/src/app/auth/AuthClient.tsx:101) |
| “Buy THAL” | Go to `/token-presale` | Presale page | **OK** | See §6 |

### 5.5) Footer links

| UI element | Action | Expected | Actual status | Notes |
|---|---|---|---|---|
| “Privacy” | Go to `/privacy` | Legal page | **OK** | Implemented as placeholder in [`PrivacyPage()`](docker/frontend/src/app/privacy/page.tsx:1) |
| “Terms” | Go to `/terms` | Legal page | **OK** | Implemented as placeholder in [`TermsPage()`](docker/frontend/src/app/terms/page.tsx:1) |

---

## 6) Token presale page checklist (/token-presale)

Page: [`TokenPresalePage()`](docker/frontend/src/app/token-presale/page.tsx:26)

### 6.1) Header navigation

| UI element | Action | Expected | Actual status | Notes |
|---|---|---|---|---|
| “Home” | `/landing` | Back to landing | **OK** | [`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:183) |
| “Trading” | `/dashboard` | Back to app | **OK navigation** | Dashboard issues in §7 |
| “Presale” | `/token-presale` | Stay here | **OK** | |
| “Sign In” (if not authed) | `/auth?next=/token-presale` | Keycloak login then return | **OK** | [`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:189) |
| “Launch App” (if not authed) | `/dashboard` | Enter app (will redirect to login) | **OK navigation** | |
| “Back to Dashboard” (if authed) | `/dashboard` | Back to app | **OK navigation** | |

### 6.2) Data loading calls

| Functionality | Frontend call | Expected backend route | Exists in backend? | Auth required? | Status |
|---|---|---|---:|---:|---|
| Presale stats | `GET /api/presale/status` | `GET /api/presale/status` | ✅ | ❌ public | **OK** (backend explicitly marks it public) [`presale.ts`](docker/backend/src/routes/presale.ts:171) |
| THAL price | `GET /api/market/prices/THAL` | `GET /api/market/prices/:symbol` | ✅ | ❌ public | **OK** [`market-data.ts`](docker/backend/src/routes/market-data.ts:17) |

### 6.3) Purchase form / buttons

| UI element | Action | Frontend call | Backend route | Backend auth? | Actual status | Findings |
|---|---|---|---|---:|---|---|
| “Purchase THAL Tokens” | Submit purchase | `POST /api/presale/investments` | `POST /api/presale/investments` | ✅ Bearer required | **Should work only when Keycloak authed** | Frontend correctly attaches `Authorization` via [`authzHeaders()`](docker/frontend/src/app/token-presale/page.tsx:67) |
| Quick amount `$50/$100/$500/$1000` | Set amount field | none | none | n/a | **OK** | Pure client state [`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:400) |
| Payment method radio | Toggle USDT vs bank transfer | none | none | n/a | **OK** | Pure client state |
| “Sign in” link inside alert | Navigate to auth | `/auth?next=/token-presale` | n/a | n/a | **OK** | [`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:307) |
| “Back to Home” | Navigate to landing | `/landing` | n/a | n/a | **OK** | [`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:469) |

### 6.4) Data contract mismatches / risks

* The purchase call includes both `brokerCode` (header `X-Broker-Code`) and `referralCode` (body) ([`token-presale/page.tsx`](docker/frontend/src/app/token-presale/page.tsx:138)). Backend reads `x-broker-code` header and/or `req.query.brokerCode` ([`presale.ts`](docker/backend/src/routes/presale.ts:347)). This is compatible.
* The presale status endpoint is public in backend, but the frontend still sends `credentials: 'include'` and may send `Authorization` when present. This is fine.

---

## 7) Main app dashboard checklist (/dashboard)

Page: [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:27)

### 7.1) Sidebar menu items (tabs)

Sidebar buttons are **client-only tab switches**, not route changes (see `sidebarItems` in [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:149)).

| Menu item | UI action | Expected | Actual status |
|---|---|---|---|
| Trading | Set active tab | Show chart + trading panel | **Renders**, but trading actions are **broken** (see §7.2) |
| Wallet | Set active tab | Show balances + tx list | **Broken** (balances endpoint mismatch; see §7.3) |
| Portfolio | Set active tab | Portfolio overview | **Static mock cards** (no backend) |
| Analytics | Set active tab | Analytics | **Placeholder text** |
| Settings | Set active tab | Update profile | **Broken** (“Save Changes” has no handler; see §7.4) |

### 7.2) Trading tab: CTAs/actions vs backend

Component: [`TradingPanel`](docker/frontend/src/components/trading/TradingPanel.tsx:18)

| UI element | Frontend call | Backend route expected | Exists in backend? | Auth included? | Status | Notes |
|---|---|---|---:|---:|---|---|
| Buy/Sell toggle | none | none | n/a | n/a | **OK** | UI-only |
| Market/Limit toggle | none | none | n/a | n/a | **OK** | UI-only |
| Submit order | `POST /api/trading/order` | `POST /api/trading/order` | ✅ ([`trading.ts`](docker/backend/src/routes/trading.ts:15)) | ✅ via [`apiClient`](docker/frontend/src/lib/api/client.ts:174) | **LIKELY OK** | Depends on user being authenticated + backend trading service health |
| Quick amount 25/50/75/100% | `GET /api/wallets/balance/BTC` | `GET /api/wallets/balance/:currency` | ✅ ([`wallet-system.ts`](docker/backend/src/routes/wallet-system.ts:272)) | ✅ via [`apiClient`](docker/frontend/src/lib/api/client.ts:174) | **LIKELY OK** | Uses available_balance returned by backend |

### 7.3) Wallet tab: balances + actions

Component: [`WalletBalance`](docker/frontend/src/components/trading/WalletBalance.tsx:25)

| UI element | Frontend call | Backend route expected | Exists in backend? | Auth included? | Status | Notes |
|---|---|---|---:|---:|---|---|
| Load balances | `GET /api/wallets/balances` | `GET /api/wallets/balances` | ✅ ([`wallet-system.ts`](docker/backend/src/routes/wallet-system.ts:216)) | ✅ via [`apiClient`](docker/frontend/src/lib/api/client.ts:174) | **LIKELY OK** | Aggregates wallet balances + uses market-data pricing best-effort |
| Refresh button | same as above | same | ✅ | ✅ | **LIKELY OK** | |
| Deposit button | navigate to `/wallet/deposit` | n/a | n/a | n/a | **OK navigation** | Page implemented in [`DepositPage()`](docker/frontend/src/app/wallet/deposit/page.tsx:14) |
| Withdraw button | navigate to `/wallet/withdraw` | n/a | n/a | n/a | **OK navigation** | Page implemented in [`WithdrawPage()`](docker/frontend/src/app/wallet/withdraw/page.tsx:26) |

#### 7.3.1) Deposit page (`/wallet/deposit`)

| UI element | Frontend call | Backend route | Auth | Status |
|---|---|---|---:|---|
| Refresh Reference | `GET /api/wallets/reference/persistent/:currency` | ✅ ([`wallet-system.ts`](docker/backend/src/routes/wallet-system.ts:389)) | ✅ | **LIKELY OK** |

#### 7.3.2) Withdraw page (`/wallet/withdraw`)

| UI element | Frontend call | Backend route | Auth | Status |
|---|---|---|---:|---|
| Load bank accounts | `GET /api/fiat/bank-accounts` | ✅ ([`fiat.ts`](docker/backend/src/routes/fiat.ts:449)) | ✅ | **OK** (currently mock data) |
| Submit withdrawal | `POST /api/fiat/withdrawals` | ✅ ([`fiat.ts`](docker/backend/src/routes/fiat.ts:227)) | ✅ | **LIKELY OK** |

### 7.4) Settings tab: profile update

In [`Dashboard()`](docker/frontend/src/app/dashboard/page.tsx:422) the inputs are uncontrolled and “Save Changes” has no `onClick` / submit.

Status: **NOT IMPLEMENTED** (UI appears interactive but does nothing).

### 7.5) Authentication + user loading

Dashboard checks auth via `GET /api/auth/profile` with Bearer token in Keycloak mode ([`Dashboard`](docker/frontend/src/app/dashboard/page.tsx:37)).

Status: **OK** (dashboard uses the `/api/auth/profile` response directly; it no longer calls a non-existent `/api/user/profile`).

---

## 8) Portfolio page checklist (/portfolio)

Page: [`PortfolioPage()`](docker/frontend/src/app/portfolio/page.tsx:5)

| UI element | Frontend call | Backend route expected | Exists? | Auth included? | Status |
|---|---|---|---:|---:|---|
| Load “My Presale Purchases” | `GET /api/presale/investments` | `GET /api/presale/investments` | ✅ | ❌ **NO Bearer token** | **FAIL** in Keycloak mode |

Backend requires Bearer token via [`authenticateToken`](docker/backend/src/middleware/error-handler.ts:336). The frontend only uses cookies ([`portfolio/page.tsx`](docker/frontend/src/app/portfolio/page.tsx:10)).

---

## 9) Vesting page checklist (/vesting)

Page: [`VestingPage()`](docker/frontend/src/app/vesting/page.tsx:7)

| UI element | Frontend call | Backend route expected | Exists? | Auth included? | Status |
|---|---|---|---:|---:|---|
| Load vesting schedules | `GET /api/presale/vesting/user/me` | `GET /api/presale/vesting/user/me` | ✅ | ✅ Bearer token | **LIKELY OK** |

Note: backend returns empty list if no wallet address in token ([`presale.ts`](docker/backend/src/routes/presale.ts:937)).

---

## 10) Admin pages checklist (UI vs backend)

### 10.1) `/admin`

Page: [`PlatformAdmin()`](docker/frontend/src/app/admin/page.tsx:6)

Most buttons are placeholders (no `onClick`, no `href`).

| UI element | Expected backend linkage | Actual status |
|---|---|---|
| Users / Brokers / Allocations | likely `/api/admin/users`, `/api/brokers`, allocation endpoints | **NOT IMPLEMENTED** (no action handlers) |
| Approvals / AML Rules / Security / Reports / Audit Log / SAR Filing | various | **NOT IMPLEMENTED** |
| Open RBAC | `/admin/rbac` | **OK navigation** |
| Manage Policies | `/admin/policies` | **OK navigation** |

### 10.2) `/admin/rbac`

Page: [`RBACAdmin()`](docker/frontend/src/app/admin/rbac/page.tsx:8)

| UI element | Expected backend route | Exists? | Actual status |
|---|---|---:|---|
| “Add” role button | likely `POST /api/rbac/...` | ✅ (RBAC exists) | **NOT IMPLEMENTED** (no handler) |

### 10.3) `/admin/policies`

Page: [`PolicyManagement()`](docker/frontend/src/app/admin/policies/page.tsx:48)

This page makes real fetches to:

* `GET /api/admin/policies/parameters/:category`
* `PUT /api/admin/policies/parameters/:category`
* `POST /api/admin/policies/evaluate`
* `GET /api/admin/policies/presets`
* `POST /api/admin/policies/presets/:preset/apply`
* `GET /api/admin/policies/audit`
* `GET /api/admin/policies/health`

Backend routes exist in [`policy-management.ts`](docker/backend/src/routes/policy-management.ts:39) and are mounted at `/api/admin/policies` ([`index.ts`](docker/backend/src/index.ts:646)).

**But** the frontend does **not** attach a Bearer token for these calls. Backend mounts `/api/admin` behind [`authenticateToken`](docker/backend/src/index.ts:41) and additional `requireAdmin` in [`policy-management.ts`](docker/backend/src/routes/policy-management.ts:25).

Status: **FAIL** (expected 401/403 unless APISIX injects auth).

Also, `API_BASE = NEXT_PUBLIC_API_URL || '/api'` ([`admin/policies/page.tsx`](docker/frontend/src/app/admin/policies/page.tsx:46)) can produce incorrect URLs if `NEXT_PUBLIC_API_URL` is set to a full origin without `/api`.

---

## 11) Web3 wallet connector checklist

Component: [`Web3WalletConnector`](docker/frontend/src/components/trading/Web3WalletConnector.tsx:27)

Backend: mounted at `/api/web3-wallet` ([`index.ts`](docker/backend/src/index.ts:644))

### 11.1) Contract + auth alignment

This component uses [`apiClient`](docker/frontend/src/lib/api/client.ts:91) which automatically:

* prefixes requests with `/api/...`
* attaches `Authorization: Bearer <token>` when a Keycloak token exists
* unwraps backend responses (`{ success, data }`) into `response.data`

| Feature | Frontend call | Backend route | Status | Key risks |
|---|---|---|---|---|
| Load wallets | `GET /api/web3-wallet/wallets` | ✅ ([`web3-wallet.ts`](docker/backend/src/routes/web3-wallet.ts:137)) | **LIKELY OK** | Backend requires `brokerId` claim; missing `broker_id` in token causes 400 `USER_CONTEXT_MISSING` |
| Connect wallet | `POST /api/web3-wallet/connect` | ✅ ([`web3-wallet.ts`](docker/backend/src/routes/web3-wallet.ts:58)) | **LIKELY OK** | Same `brokerId` claim requirement; also backend validation middleware must accept the posted fields |
| Disconnect wallet | `DELETE /api/web3-wallet/:id/disconnect` | ✅ ([`web3-wallet.ts`](docker/backend/src/routes/web3-wallet.ts:98)) | **LIKELY OK** | Role requirements: `user`/`broker-admin`/`platform-admin` |

---

## 12) Summary: what is working vs broken

### Works (navigation / public content)

* Marketing/landing rendering + navigation between `/landing`, `/token-presale`, `/auth`, `/dashboard`.
* Landing anchors `#features/#how/#contact` work.
* Legal pages `/privacy` and `/terms` exist (placeholders).
* Presale status + price loads (public backend endpoints).
* Presale investment submission should work when authenticated (token included).
* Vesting page likely works (token included).
* Wallet tab balance loading should work (`/api/wallets/balances`).
* Wallet Deposit + Withdraw pages now exist and are reachable from Wallet tab.

### Broken (high confidence)

* Dashboard tabs “Portfolio/Analytics/Settings” are still largely **mock/placeholder** (no backend persistence for settings; analytics is placeholder; portfolio tab is mock cards).
* Admin `/admin` and `/admin/rbac` still contain multiple placeholder buttons with no handlers.
* Web3 wallet flows may fail if the Keycloak token does not include `broker_id` (backend requires broker context for connect/list).

### Not implemented (UI present but no backend hook)

* Dashboard “Settings → Save Changes” button.
* Admin `/admin` buttons for Users/Brokers/Allocations/Approvals/AML Rules/Security/Reports/Audit Log/SAR Filing.
* RBAC page “Add” button.
* Dashboard “Settings → Save Changes” is intentionally routed to Keycloak Account Console (no in-app save).
* Admin `/admin` buttons for Users/Brokers/Allocations/Approvals/AML Rules/Security/Reports/Audit Log/SAR Filing.
* RBAC page “Add” button.

---

## 13) Highest priority fixes (to make CTAs truthful)

1. **Broker context in Keycloak tokens:** ensure `broker_id` (or `brokerId`) is present, otherwise Web3 and some wallet flows return `USER_CONTEXT_MISSING` ([`web3-wallet.ts`](docker/backend/src/routes/web3-wallet.ts:68)).
2. **Replace placeholder CTAs with real routes or remove them:** `/admin` buttons and `/admin/rbac` “Add” are still no-ops.
3. **Implement real portfolio + analytics tabs (dashboard):** currently static cards/placeholder text.
4. **Harden wallet system consistency:** some wallet-system routes use `(req as any).user?.id` vs `userId`. Standardize to `req.user.userId` ([`wallet-system.ts`](docker/backend/src/routes/wallet-system.ts:27)).
