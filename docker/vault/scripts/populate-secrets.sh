#!/bin/bash
# ThaliumX Vault Secrets Population Script
# =========================================
# This script populates Vault with all secrets from the .secrets directory
# Run this after init-vault.sh and setup-secrets.sh
#
# Usage: ./populate-secrets.sh [--secrets-dir /path/to/.secrets]
#
# Prerequisites:
# - Vault must be initialized and unsealed
# - VAULT_ADDR and VAULT_TOKEN must be set
# - jq must be installed

set -e

# Configuration
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
SECRETS_DIR="${SECRETS_DIR:-/home/ubuntu/thaliumx/.secrets}"
KV_MOUNT_PATH="${KV_MOUNT_PATH:-kv}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

log_secret() {
    echo -e "${CYAN}[SECRET]${NC} $1"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --secrets-dir)
                SECRETS_DIR="$2"
                shift 2
                ;;
            --vault-addr)
                VAULT_ADDR="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--secrets-dir /path/to/.secrets] [--vault-addr http://vault:8200]"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Install with: apt-get install jq"
        exit 1
    fi
    
    # Check if secrets directory exists
    if [ ! -d "$SECRETS_DIR" ]; then
        log_error "Secrets directory not found: $SECRETS_DIR"
        exit 1
    fi
    
    # Check Vault connection
    if ! vault status -address="$VAULT_ADDR" &> /dev/null; then
        log_error "Cannot connect to Vault at $VAULT_ADDR"
        exit 1
    fi
    
    # Check if Vault is unsealed
    if vault status -address="$VAULT_ADDR" 2>&1 | grep -q "Sealed.*true"; then
        log_error "Vault is sealed. Please unseal first."
        exit 1
    fi
    
    # Check authentication
    if ! vault token lookup -address="$VAULT_ADDR" &> /dev/null; then
        log_error "Not authenticated to Vault. Please set VAULT_TOKEN or login."
        exit 1
    fi
    
    log_info "All prerequisites met"
}

# Store a secret in Vault
store_secret() {
    local path="$1"
    shift
    local data="$@"
    
    vault kv put -address="$VAULT_ADDR" "${KV_MOUNT_PATH}/${path}" $data
    log_secret "Stored: ${KV_MOUNT_PATH}/${path}"
}

# Populate database secrets
populate_database_secrets() {
    log_section "Populating Database Secrets"
    
    # PostgreSQL/Citus
    store_secret "thaliumx/database/postgres" \
        host="thaliumx-citus-coordinator" \
        port="5432" \
        database="thaliumx" \
        username="thaliumx" \
        password="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    # MongoDB
    store_secret "thaliumx/database/mongodb" \
        host="thaliumx-mongodb" \
        port="27017" \
        database="thaliumx" \
        username="thaliumx" \
        password="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    # Redis
    store_secret "thaliumx/database/redis" \
        host="thaliumx-redis" \
        port="6379" \
        password="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    log_info "Database secrets populated"
}

# Populate JWT and encryption secrets
populate_security_secrets() {
    log_section "Populating Security Secrets"
    
    # JWT secrets
    store_secret "thaliumx/jwt/config" \
        secret="$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)" \
        refresh_secret="$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)" \
        expires_in="15m" \
        refresh_expires_in="7d" \
        issuer="thaliumx" \
        audience="thaliumx-users"
    
    # Encryption key
    store_secret "thaliumx/encryption/config" \
        algorithm="aes-256-gcm" \
        key="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    log_info "Security secrets populated"
}

# Populate SMTP secrets from .secrets/smtp.info
populate_smtp_secrets() {
    log_section "Populating SMTP Secrets"
    
    local smtp_file="${SECRETS_DIR}/smtp.info"
    
    if [ -f "$smtp_file" ]; then
        # Parse smtp.info file
        local smtp_user=$(grep -E "^smtp_user" "$smtp_file" | cut -d'"' -f2)
        local smtp_password=$(grep -E "^smtp_password" "$smtp_file" | cut -d'"' -f2)
        local smtp_server=$(grep -E "^smtp_server" "$smtp_file" | cut -d'"' -f2)
        local smtp_port=$(grep -E "^smtp_port" "$smtp_file" | awk '{print $3}')
        
        store_secret "thaliumx/smtp/config" \
            host="${smtp_server:-smtp.gmail.com}" \
            port="${smtp_port:-587}" \
            user="${smtp_user}" \
            password="${smtp_password}" \
            from="${smtp_user}"
        
        log_info "SMTP secrets populated from smtp.info"
    else
        log_warn "smtp.info not found, creating placeholder"
        store_secret "thaliumx/smtp/config" \
            host="smtp.gmail.com" \
            port="587" \
            user="placeholder@example.com" \
            password="placeholder" \
            from="noreply@thaliumx.com"
    fi
}

# Populate blockchain secrets
populate_blockchain_secrets() {
    log_section "Populating Blockchain Secrets"
    
    # Testnet admin wallet
    local testnet_wallet="${SECRETS_DIR}/testnet-admin-wallet"
    if [ -f "$testnet_wallet" ]; then
        local address=$(grep -E "^Address:" "$testnet_wallet" | awk '{print $2}')
        local private_key=$(grep -E "^Private Key:" "$testnet_wallet" | awk '{print $3}')
        local mnemonic=$(grep -E "^Mnemonic:" "$testnet_wallet" | cut -d':' -f2 | xargs)
        
        store_secret "thaliumx/blockchain/testnet-admin" \
            address="${address}" \
            private_key="${private_key}" \
            mnemonic="${mnemonic}" \
            network="bsc-testnet" \
            chain_id="97"
        
        log_info "Testnet admin wallet secrets populated"
    fi
    
    # Mainnet admin wallet (if exists)
    local mainnet_wallet="${SECRETS_DIR}/admin-wallet-mainnet"
    if [ -f "$mainnet_wallet" ]; then
        local address=$(head -1 "$mainnet_wallet")
        local mnemonic=$(grep -E "^slab" "$mainnet_wallet" || sed -n '4p' "$mainnet_wallet")
        local private_key=$(grep -E "^[a-f0-9]{64}$" "$mainnet_wallet" || sed -n '8p' "$mainnet_wallet")
        
        store_secret "thaliumx/blockchain/mainnet-admin" \
            address="${address}" \
            private_key="${private_key}" \
            mnemonic="${mnemonic}" \
            network="bsc-mainnet" \
            chain_id="56" \
            warning="USE_HARDWARE_WALLET_FOR_PRODUCTION"
        
        log_warn "Mainnet wallet stored - USE HARDWARE WALLET FOR PRODUCTION!"
    fi
    
    # Contract addresses
    local contracts_file="${SECRETS_DIR}/testnet-token-deployed-contracts-addr"
    if [ -f "$contracts_file" ]; then
        # Parse contract addresses
        local token_addr=$(grep "ThaliumToken:" "$contracts_file" | awk '{print $2}')
        local presale_addr=$(grep "ThaliumPresale:" "$contracts_file" | awk '{print $2}')
        local vesting_addr=$(grep "ThaliumVesting:" "$contracts_file" | awk '{print $2}')
        local dex_addr=$(grep "ThaliumDEX:" "$contracts_file" | awk '{print $2}')
        local nft_addr=$(grep "ThaliumNFT:" "$contracts_file" | awk '{print $2}')
        local governance_addr=$(grep "ThaliumGovernance:" "$contracts_file" | awk '{print $2}')
        local staking_addr=$(grep "ThaliumStaking:" "$contracts_file" | awk '{print $2}')
        local bridge_addr=$(grep "ThaliumBridge:" "$contracts_file" | awk '{print $2}')
        local oracle_addr=$(grep "ThaliumOracle:" "$contracts_file" | awk '{print $2}')
        
        store_secret "thaliumx/blockchain/contracts-testnet" \
            token="${token_addr}" \
            presale="${presale_addr}" \
            vesting="${vesting_addr}" \
            dex="${dex_addr}" \
            nft="${nft_addr}" \
            governance="${governance_addr}" \
            staking="${staking_addr}" \
            bridge="${bridge_addr}" \
            oracle="${oracle_addr}" \
            network="bsc-testnet"
        
        log_info "Contract addresses populated"
    fi
}

# Populate exchange credentials from .secrets/exchange-chain.info
populate_exchange_secrets() {
    log_section "Populating Exchange Credentials"
    
    local exchange_file="${SECRETS_DIR}/exchange-chain.info"
    
    if [ -f "$exchange_file" ]; then
        # Bybit
        local bybit_key=$(grep -A1 "^Bybit" "$exchange_file" | grep "API key:" | awk '{print $3}')
        local bybit_secret=$(grep -A2 "^Bybit" "$exchange_file" | grep "Secret:" | awk '{print $2}')
        if [ -n "$bybit_key" ]; then
            store_secret "thaliumx/exchange-credentials/bybit" \
                api_key="${bybit_key}" \
                api_secret="${bybit_secret}"
        fi
        
        # Kucoin
        local kucoin_passphrase=$(grep -A1 "^Kucoin" "$exchange_file" | grep "Passphrase:" | awk '{print $3}')
        local kucoin_key=$(grep -A2 "^Kucoin" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        local kucoin_secret=$(grep -A3 "^Kucoin" "$exchange_file" | grep "Secret:" | awk '{print $2}')
        if [ -n "$kucoin_key" ]; then
            store_secret "thaliumx/exchange-credentials/kucoin" \
                api_key="${kucoin_key}" \
                api_secret="${kucoin_secret}" \
                passphrase="${kucoin_passphrase}"
        fi
        
        # Kraken
        local kraken_key=$(grep -A1 "^Kraken" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        local kraken_private=$(grep -A2 "^Kraken" "$exchange_file" | grep "Private Key:" | awk '{print $3}')
        if [ -n "$kraken_key" ]; then
            store_secret "thaliumx/exchange-credentials/kraken" \
                api_key="${kraken_key}" \
                private_key="${kraken_private}"
        fi
        
        # OKX
        local okx_passphrase=$(grep -A1 "^OKX" "$exchange_file" | grep "Passphrase:" | awk '{print $2}')
        local okx_key=$(grep -A2 "^OKX" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        local okx_secret=$(grep -A3 "^OKX" "$exchange_file" | grep "Secret:" | awk '{print $2}')
        if [ -n "$okx_key" ]; then
            store_secret "thaliumx/exchange-credentials/okx" \
                api_key="${okx_key}" \
                api_secret="${okx_secret}" \
                passphrase="${okx_passphrase}"
        fi
        
        # Valr
        local valr_key=$(grep -A1 "^Valr" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        local valr_secret=$(grep -A2 "^Valr" "$exchange_file" | grep "Secret:" | awk '{print $2}')
        if [ -n "$valr_key" ]; then
            store_secret "thaliumx/exchange-credentials/valr" \
                api_key="${valr_key}" \
                api_secret="${valr_secret}"
        fi
        
        # Bitstamp
        local bitstamp_key=$(grep -A1 "^Bitstamp" "$exchange_file" | grep "API Key" | awk '{print $4}')
        local bitstamp_secret=$(grep -A2 "^Bitstamp" "$exchange_file" | grep "Secret" | awk '{print $3}')
        if [ -n "$bitstamp_key" ]; then
            store_secret "thaliumx/exchange-credentials/bitstamp" \
                api_key="${bitstamp_key}" \
                api_secret="${bitstamp_secret}"
        fi
        
        # Binance
        local binance_key=$(grep -A1 "^Binance" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        local binance_secret=$(grep -A2 "^Binance" "$exchange_file" | grep "API Secret:" | awk '{print $3}')
        if [ -n "$binance_key" ]; then
            store_secret "thaliumx/exchange-credentials/binance" \
                api_key="${binance_key}" \
                api_secret="${binance_secret}"
        fi
        
        log_info "Exchange credentials populated"
    else
        log_warn "exchange-chain.info not found"
    fi
}

# Populate API keys from .secrets/chain.info
populate_api_keys() {
    log_section "Populating API Keys"
    
    local chain_file="${SECRETS_DIR}/chain.info"
    
    if [ -f "$chain_file" ]; then
        # BscScan
        local bscscan_key=$(grep -A1 "^BscScan" "$chain_file" | grep "API:" | awk '{print $2}')
        if [ -n "$bscscan_key" ]; then
            store_secret "thaliumx/api-keys/bscscan" api_key="${bscscan_key}"
        fi
        
        # EtherScan
        local etherscan_key=$(grep -A1 "^EtherScan" "$chain_file" | grep "API:" | awk '{print $2}')
        if [ -n "$etherscan_key" ]; then
            store_secret "thaliumx/api-keys/etherscan" api_key="${etherscan_key}"
        fi
        
        # TronScan
        local tronscan_key=$(grep -A1 "^TronScan" "$chain_file" | grep "API:" | awk '{print $2}')
        if [ -n "$tronscan_key" ]; then
            store_secret "thaliumx/api-keys/tronscan" api_key="${tronscan_key}"
        fi
        
        # Alchemy
        local alchemy_key=$(grep -A1 "^Alchemy" "$chain_file" | grep "API:" | awk '{print $2}')
        if [ -n "$alchemy_key" ]; then
            store_secret "thaliumx/api-keys/alchemy" api_key="${alchemy_key}"
        fi
        
        # Ankr
        local ankr_key=$(grep -A1 "^Ankr" "$chain_file" | grep "API:" | awk '{print $2}')
        if [ -n "$ankr_key" ]; then
            store_secret "thaliumx/api-keys/ankr" api_key="${ankr_key}"
        fi
        
        # Infura
        local infura_key=$(grep -A1 "^Infura" "$chain_file" | grep "API:" | awk '{print $2}')
        local infura_secret=$(grep -A2 "^Infura" "$chain_file" | grep "Secret:" | awk '{print $2}')
        if [ -n "$infura_key" ]; then
            store_secret "thaliumx/api-keys/infura" \
                project_id="${infura_key}" \
                project_secret="${infura_secret}"
        fi
        
        log_info "Chain API keys populated"
    fi
    
    # Additional API keys from exchange-chain.info
    local exchange_file="${SECRETS_DIR}/exchange-chain.info"
    if [ -f "$exchange_file" ]; then
        # CoinGecko
        local coingecko_key=$(grep -A1 "^CoinGecko" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        if [ -n "$coingecko_key" ]; then
            store_secret "thaliumx/api-keys/coingecko" api_key="${coingecko_key}"
        fi
        
        # CoinCap
        local coincap_key=$(grep -A1 "^CoinCap" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        if [ -n "$coincap_key" ]; then
            store_secret "thaliumx/api-keys/coincap" api_key="${coincap_key}"
        fi
        
        # BlockCypher
        local blockcypher_key=$(grep -A1 "^BlockCypher" "$exchange_file" | grep "Token:" | awk '{print $2}')
        if [ -n "$blockcypher_key" ]; then
            store_secret "thaliumx/api-keys/blockcypher" token="${blockcypher_key}"
        fi
        
        # Quicknode
        local quicknode_key=$(grep -A1 "^Quicknode" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        if [ -n "$quicknode_key" ]; then
            store_secret "thaliumx/api-keys/quicknode" api_key="${quicknode_key}"
        fi
        
        # 0x
        local zeroex_key=$(grep -A1 "^0x" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        if [ -n "$zeroex_key" ]; then
            store_secret "thaliumx/api-keys/0x" api_key="${zeroex_key}"
        fi
        
        # Moralis
        local moralis_key=$(grep -A1 "^Moralis" "$exchange_file" | grep -v "^$" | tail -1)
        if [ -n "$moralis_key" ]; then
            store_secret "thaliumx/api-keys/moralis" api_key="${moralis_key}"
        fi
        
        # The Graph
        local thegraph_key=$(grep -A1 "^The Graph" "$exchange_file" | grep "API Key:" | awk '{print $3}')
        if [ -n "$thegraph_key" ]; then
            store_secret "thaliumx/api-keys/thegraph" api_key="${thegraph_key}"
        fi
        
        log_info "Additional API keys populated"
    fi
}

# Populate banking/fintech secrets
populate_banking_secrets() {
    log_section "Populating Banking Secrets"
    
    # Nedbank Deposit API
    local nedbank_deposit="${SECRETS_DIR}/nedbank-deposit"
    if [ -f "$nedbank_deposit" ]; then
        local api_key=$(head -1 "$nedbank_deposit" | grep "key:" | awk '{print $2}')
        local base_url=$(grep "GET:" "$nedbank_deposit" | head -1 | awk '{print $2}' | sed 's|/Transactions.*||')
        
        store_secret "thaliumx/banking/nedbank-deposit" \
            api_key="${api_key}" \
            base_url="${base_url}" \
            account_number="1309630755"
        
        log_info "Nedbank deposit secrets populated"
    fi
    
    # OFAC API
    local ofac_file="${SECRETS_DIR}/ofac"
    if [ -f "$ofac_file" ]; then
        # Extract API key from the Postman collection
        local ofac_key=$(grep -o '"apiKey":"[^"]*"' "$ofac_file" | head -1 | cut -d'"' -f4)
        
        if [ -n "$ofac_key" ]; then
            store_secret "thaliumx/compliance/ofac" \
                api_key="${ofac_key}" \
                base_url="https://api.ofac-api.com/v4"
            
            log_info "OFAC API secrets populated"
        fi
    fi
    
    # SecureCitizen KYC
    local securecitizen_file="${SECRETS_DIR}/secure-citizen"
    if [ -f "$securecitizen_file" ]; then
        # Extract credentials from Postman collection
        local client_id=$(grep -o '"client_id","value":"[^"]*"' "$securecitizen_file" | cut -d'"' -f6)
        local client_secret=$(grep -o '"client_secret","value":"[^"]*"' "$securecitizen_file" | cut -d'"' -f6)
        local username=$(grep -o '"username","value":"[^"]*"' "$securecitizen_file" | cut -d'"' -f6)
        local password=$(grep -o '"password","value":"[^"]*"' "$securecitizen_file" | cut -d'"' -f6)
        
        store_secret "thaliumx/kyc/secure-citizen" \
            client_id="${client_id}" \
            client_secret="${client_secret}" \
            username="${username}" \
            password="${password}" \
            base_url="https://citizen.uat.securecitizen.cloud" \
            token_url="https://sts.uat.securecitizen.cloud/connect/token"
        
        log_info "SecureCitizen KYC secrets populated"
    fi
}

# Populate Keycloak secrets
populate_keycloak_secrets() {
    log_section "Populating Keycloak Secrets"
    
    store_secret "thaliumx/keycloak/admin" \
        username="admin" \
        password="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)" \
        realm="master"
    
    store_secret "thaliumx/keycloak/client" \
        client_id="thaliumx-backend" \
        client_secret="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    log_info "Keycloak secrets populated"
}

# Populate APISIX gateway secrets
populate_gateway_secrets() {
    log_section "Populating Gateway Secrets"
    
    store_secret "thaliumx/gateway/apisix" \
        admin_key="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)" \
        viewer_key="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    log_info "Gateway secrets populated"
}

# Populate Typesense secrets
populate_search_secrets() {
    log_section "Populating Search Secrets"
    
    store_secret "thaliumx/search/typesense" \
        api_key="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)" \
        host="thaliumx-typesense" \
        port="8108"
    
    log_info "Search secrets populated"
}

# Populate observability secrets
populate_observability_secrets() {
    log_section "Populating Observability Secrets"
    
    store_secret "thaliumx/observability/grafana" \
        admin_user="admin" \
        admin_password="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    
    store_secret "thaliumx/observability/metrics" \
        token="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
    
    log_info "Observability secrets populated"
}

# Print summary
print_summary() {
    log_section "Secrets Population Complete!"
    
    echo "Secrets stored in Vault:"
    vault kv list -address="$VAULT_ADDR" "${KV_MOUNT_PATH}/thaliumx/" 2>/dev/null || true
    
    echo ""
    log_info "Next steps:"
    log_info "1. Update docker/core/core.env to use Vault"
    log_info "2. Update docker/.env to remove hardcoded passwords"
    log_info "3. Configure services to use Vault AppRole authentication"
    log_info "4. Test all services with Vault integration"
    log_info "5. Rotate any secrets that were previously exposed"
}

# Main execution
main() {
    parse_args "$@"
    
    log_info "Starting Vault secrets population..."
    log_info "Secrets directory: $SECRETS_DIR"
    log_info "Vault address: $VAULT_ADDR"
    
    check_prerequisites
    
    # Populate all secrets
    populate_database_secrets
    populate_security_secrets
    populate_smtp_secrets
    populate_blockchain_secrets
    populate_exchange_secrets
    populate_api_keys
    populate_banking_secrets
    populate_keycloak_secrets
    populate_gateway_secrets
    populate_search_secrets
    populate_observability_secrets
    
    print_summary
    
    log_info "Vault secrets population complete!"
}

main "$@"