# Thaliumx Vault Server Configuration - Production
# =================================================
# Following HashiCorp production setup guide exactly
# Updated: 2025-12-17T05:05:20.000Z

storage "raft" {
  path = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address = "0.0.0.0:18200"
  tls_cert_file = "/vault/userconfig/tls/vault.crt"
  tls_key_file = "/vault/userconfig/tls/vault.key"
}

cluster_addr = "https://vault:18201"

ui = true
disable_mlock = false