#!/bin/bash
# Seed Vault secrets (NO PLAINTEXT SECRETS IN REPO)
# ================================================
# This script writes secrets into Vault, but it must *not* contain any real credentials.
#
# Usage:
#   Export the required env vars (or source them from a secure location) and run.
#
# NOTE: This script is intentionally strict: it fails if required vars are missing.

set -e

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"

echo "Seeding Vault secrets from .secrets directory..."

# Function to write secret to Vault
write_secret() {
    local path=$1
    shift
    echo "Writing secret to kv/fintech/$path"
    docker exec thaliumx-vault vault kv put "kv/fintech/$path" "$@"
}

require_env() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        echo "ERROR: missing required env var: ${name}" >&2
        exit 1
    fi
}

# Exchange API Credentials
echo "=== Seeding Exchange API Credentials ==="

write_secret "exchanges/bybit" \
    api_key="${BYBIT_API_KEY:?BYBIT_API_KEY is required}" \
    api_secret="${BYBIT_API_SECRET:?BYBIT_API_SECRET is required}"

write_secret "exchanges/kucoin" \
    api_key="${KUCOIN_API_KEY:?KUCOIN_API_KEY is required}" \
    api_secret="${KUCOIN_API_SECRET:?KUCOIN_API_SECRET is required}" \
    api_passphrase="${KUCOIN_API_PASSPHRASE:?KUCOIN_API_PASSPHRASE is required}"

write_secret "exchanges/kraken" \
    api_key="${KRAKEN_API_KEY:?KRAKEN_API_KEY is required}" \
    private_key="${KRAKEN_PRIVATE_KEY:?KRAKEN_PRIVATE_KEY is required}"

write_secret "exchanges/okx" \
    api_key="${OKX_API_KEY:?OKX_API_KEY is required}" \
    api_secret="${OKX_API_SECRET:?OKX_API_SECRET is required}" \
    passphrase="${OKX_API_PASSPHRASE:?OKX_API_PASSPHRASE is required}"

write_secret "exchanges/valr" \
    api_key="${VALR_API_KEY:?VALR_API_KEY is required}" \
    api_secret="${VALR_API_SECRET:?VALR_API_SECRET is required}"

write_secret "exchanges/bitstamp" \
    api_key="${BITSTAMP_API_KEY:?BITSTAMP_API_KEY is required}" \
    api_secret="${BITSTAMP_API_SECRET:?BITSTAMP_API_SECRET is required}"

write_secret "exchanges/cryptocom" \
    api_key="${CRYPTOCOM_API_KEY:?CRYPTOCOM_API_KEY is required}" \
    passkey="${CRYPTOCOM_PASSKEY:?CRYPTOCOM_PASSKEY is required}"

write_secret "exchanges/binance" \
    api_key="${BINANCE_API_KEY:?BINANCE_API_KEY is required}" \
    api_secret="${BINANCE_API_SECRET:?BINANCE_API_SECRET is required}"

# Blockchain Network API Keys
echo "=== Seeding Blockchain Network API Keys ==="

write_secret "networks/bscscan" api_key="${BSCSCAN_API_KEY:?BSCSCAN_API_KEY is required}"
write_secret "networks/etherscan" api_key="${ETHERSCAN_API_KEY:?ETHERSCAN_API_KEY is required}"
write_secret "networks/tronscan" api_key="${TRONSCAN_API_KEY:?TRONSCAN_API_KEY is required}"
write_secret "networks/alchemy" api_key="${ALCHEMY_API_KEY:?ALCHEMY_API_KEY is required}"
write_secret "networks/ankr" api_key="${ANKR_API_KEY:?ANKR_API_KEY is required}"
write_secret "networks/infura" \
    project_id="${INFURA_PROJECT_ID:?INFURA_PROJECT_ID is required}" \
    secret="${INFURA_PROJECT_SECRET:?INFURA_PROJECT_SECRET is required}"

# Data Providers
echo "=== Seeding Data Provider API Keys ==="

write_secret "providers/coingecko" api_key="${COINGECKO_API_KEY:?COINGECKO_API_KEY is required}"
write_secret "providers/coincap" api_key="${COINCAP_API_KEY:?COINCAP_API_KEY is required}"
write_secret "providers/blockcypher" token="${BLOCKCYPHER_TOKEN:?BLOCKCYPHER_TOKEN is required}"
write_secret "providers/quicknode" api_key="${QUICKNODE_API_KEY:?QUICKNODE_API_KEY is required}"
write_secret "providers/0x" api_key="${ZEROX_API_KEY:?ZEROX_API_KEY is required}"
write_secret "providers/thegraph" api_key="${THEGRAPH_API_KEY:?THEGRAPH_API_KEY is required}"
write_secret "providers/moralis" jwt="${MORALIS_JWT:?MORALIS_JWT is required}"

# Banking - Nedbank
echo "=== Seeding Banking Credentials ==="

write_secret "banking/nedbank" \
    deposits_api_key="${NEDBANK_DEPOSITS_API_KEY:?NEDBANK_DEPOSITS_API_KEY is required}" \
    deposits_base_url="${NEDBANK_DEPOSITS_BASE_URL:?NEDBANK_DEPOSITS_BASE_URL is required}" \
    account_number="${NEDBANK_ACCOUNT_NUMBER:?NEDBANK_ACCOUNT_NUMBER is required}" \
    payout_base_url="${NEDBANK_PAYOUT_BASE_URL:?NEDBANK_PAYOUT_BASE_URL is required}"

# SMTP
echo "=== Seeding SMTP Credentials ==="

write_secret "smtp" \
    user="${SMTP_USER:?SMTP_USER is required}" \
    password="${SMTP_PASSWORD:?SMTP_PASSWORD is required}" \
    server="${SMTP_HOST:?SMTP_HOST is required}" \
    port="${SMTP_PORT:?SMTP_PORT is required}"

echo ""
echo "=== Vault secrets seeded successfully! ==="
echo ""
echo "To verify, run:"
echo "  docker exec thaliumx-vault vault kv list kv/fintech/"
