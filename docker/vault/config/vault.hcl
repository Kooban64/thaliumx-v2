# Thaliumx Vault Production Configuration
# Following HashiCorp vendor documentation exactly
# Updated: 2025-12-17T05:41:10.000Z

storage "raft" {
  path = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_cert_file = "/vault/userconfig/tls/vault.crt"
  tls_key_file = "/vault/userconfig/tls/vault.key"
}

cluster_addr = "https://vault-temp:8201"

ui = true
disable_mlock = false