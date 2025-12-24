# BlnkFinance Vault Policy
# Grants read access to BlnkFinance-specific secrets

path "secret/data/thaliumx/blnk/*" {
  capabilities = ["read"]
}

path "secret/data/thaliumx/database/*" {
  capabilities = ["read"]
}

path "secret/data/thaliumx/redis/*" {
  capabilities = ["read"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow reading own token info
path "auth/token/lookup-self" {
  capabilities = ["read"]
}