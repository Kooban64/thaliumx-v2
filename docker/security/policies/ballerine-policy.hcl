# Ballerine Vault Policy
# Grants read access to Ballerine-specific secrets

path "secret/data/thaliumx/ballerine/*" {
  capabilities = ["read"]
}

path "secret/data/thaliumx/database/*" {
  capabilities = ["read"]
}

path "secret/data/thaliumx/redis/*" {
  capabilities = ["read"]
}

path "secret/data/thaliumx/jwt/*" {
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