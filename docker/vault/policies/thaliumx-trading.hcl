# Thaliumx Trading Services Policy
# =================================
# Policy for trading services (dingir, liquibook, quantlib)

# Read database credentials for trading
path "database/creds/thaliumx-trading" {
  capabilities = ["read"]
}

# Read KV secrets for trading services
path "kv/data/thaliumx/trading/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/trading/*" {
  capabilities = ["read", "list"]
}

# Read shared secrets
path "kv/data/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

# Transit encryption for trading data
path "transit/encrypt/thaliumx-trading" {
  capabilities = ["update"]
}

path "transit/decrypt/thaliumx-trading" {
  capabilities = ["update"]
}

# HMAC for order signing
path "transit/hmac/thaliumx-trading" {
  capabilities = ["update"]
}

path "transit/verify/thaliumx-trading" {
  capabilities = ["update"]
}

# Read exchange API keys
path "kv/data/thaliumx/exchange-keys/*" {
  capabilities = ["read"]
}

# Read market data provider credentials
path "kv/data/thaliumx/market-data/*" {
  capabilities = ["read"]
}

# Read messaging credentials (Kafka)
path "kv/data/thaliumx/messaging/*" {
  capabilities = ["read"]
}

# Read cache credentials (Redis)
path "kv/data/thaliumx/cache/*" {
  capabilities = ["read"]
}

# Token self-management
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}

# Cubbyhole for temporary secrets
path "cubbyhole/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}