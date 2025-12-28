# ThaliumX Secrets Rotation + De-duplication Plan

## Why this is urgent
This repository contained **plaintext production credentials** in [`scripts/seed-vault-secrets.sh`](scripts/seed-vault-secrets.sh:1). Even if they are now removed from the working tree, they may still exist in **git history** and must be treated as **compromised**.

## Target state
- **Vault** (preferred) or **Docker secrets** hold all non-IAM secrets.
- **Keycloak realms** hold only IAM-related secrets/keys (client secrets, realm signing keys) and nothing related to blockchain wallets.
- The legacy Keycloak realms `thaliumx` and `thaliumx-default-tenant` are **deprecated/disabled**.
- ThaliumX production standardizes on **one realm**:
  - `thaliumx-platform`

## What was changed in code
- [`scripts/seed-vault-secrets.sh`](scripts/seed-vault-secrets.sh:1) no longer embeds any credentials. It now requires environment variables.

## Rotation checklist (do ASAP)

### Exchange API keys
Rotate all credentials previously seeded under:
- `kv/fintech/exchanges/bybit`
- `kv/fintech/exchanges/kucoin`
- `kv/fintech/exchanges/kraken`
- `kv/fintech/exchanges/okx`
- `kv/fintech/exchanges/valr`
- `kv/fintech/exchanges/bitstamp`
- `kv/fintech/exchanges/cryptocom`
- `kv/fintech/exchanges/binance`

### Blockchain/provider API keys
Rotate all credentials previously seeded under:
- `kv/fintech/networks/*` (bscscan, etherscan, tronscan, alchemy, ankr, infura)
- `kv/fintech/providers/*` (coingecko, coincap, blockcypher, quicknode, 0x, thegraph, moralis)

### Banking
Rotate:
- `kv/fintech/banking/nedbank` (deposits API key etc.)

### SMTP
Rotate:
- `kv/fintech/smtp`

### Vault hygiene
1. Confirm Vault audit logging is enabled.
2. Confirm Vault access policy scoping for each service.
3. Consider rotating the Vault root token if it was ever used outside initial bootstrap.

## Environment variables required for seeding
The seeding script expects the following environment variables to be set:
- Exchanges: `BYBIT_API_KEY`, `BYBIT_API_SECRET`, `KUCOIN_API_KEY`, `KUCOIN_API_SECRET`, `KUCOIN_API_PASSPHRASE`, `KRAKEN_API_KEY`, `KRAKEN_PRIVATE_KEY`, `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_API_PASSPHRASE`, `VALR_API_KEY`, `VALR_API_SECRET`, `BITSTAMP_API_KEY`, `BITSTAMP_API_SECRET`, `CRYPTOCOM_API_KEY`, `CRYPTOCOM_PASSKEY`, `BINANCE_API_KEY`, `BINANCE_API_SECRET`
- Networks: `BSCSCAN_API_KEY`, `ETHERSCAN_API_KEY`, `TRONSCAN_API_KEY`, `ALCHEMY_API_KEY`, `ANKR_API_KEY`, `INFURA_PROJECT_ID`, `INFURA_PROJECT_SECRET`
- Providers: `COINGECKO_API_KEY`, `COINCAP_API_KEY`, `BLOCKCYPHER_TOKEN`, `QUICKNODE_API_KEY`, `ZEROX_API_KEY`, `THEGRAPH_API_KEY`, `MORALIS_JWT`
- Banking: `NEDBANK_DEPOSITS_API_KEY`, `NEDBANK_DEPOSITS_BASE_URL`, `NEDBANK_ACCOUNT_NUMBER`, `NEDBANK_PAYOUT_BASE_URL`
- SMTP: `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`

## Keycloak note (private keys)
Keycloak **does** store realm signing keys (private key material) internally for token signing/encryption.
That is normal and is visible as key metadata via the Admin API `/keys` endpoint, e.g. [`/admin/realms/{realm}/keys`](docker/scripts/keycloak-post-import-seed.sh:104) usage patterns.

**Blockchain wallet private keys should not be stored in Keycloak**. If you suspect they are, the next step is to identify which storage location they are actually in (Vault paths, Docker secrets, DB rows, filesystem mounts) and rotate them.
