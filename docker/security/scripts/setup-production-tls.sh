#!/bin/bash
# ===========================================
# ThaliumX Production TLS Setup Script
# ===========================================
# This script generates TLS certificates for Vault and Keycloak
# For production, replace with certificates from a trusted CA

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"
VAULT_TLS_DIR="${CONFIG_DIR}/vault/tls"
KEYCLOAK_TLS_DIR="${CONFIG_DIR}/keycloak/tls"

# Certificate validity (days)
CA_VALIDITY=3650  # 10 years
CERT_VALIDITY=365 # 1 year

# Organization details
COUNTRY="US"
STATE="California"
LOCALITY="San Francisco"
ORGANIZATION="ThaliumX"
ORG_UNIT="Security"

echo "=== ThaliumX Production TLS Setup ==="
echo ""

# Create directories
mkdir -p "${VAULT_TLS_DIR}"
mkdir -p "${KEYCLOAK_TLS_DIR}"

# ===========================================
# Generate CA Certificate
# ===========================================
echo "Generating CA certificate..."

CA_KEY="${CONFIG_DIR}/ca.key"
CA_CERT="${CONFIG_DIR}/ca.crt"

if [ ! -f "${CA_KEY}" ]; then
    openssl genrsa -out "${CA_KEY}" 4096
    
    openssl req -x509 -new -nodes \
        -key "${CA_KEY}" \
        -sha256 \
        -days ${CA_VALIDITY} \
        -out "${CA_CERT}" \
        -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${ORG_UNIT}/CN=ThaliumX Root CA"
    
    echo "CA certificate generated: ${CA_CERT}"
else
    echo "CA certificate already exists, skipping..."
fi

# ===========================================
# Generate Vault Certificate
# ===========================================
echo ""
echo "Generating Vault certificate..."

VAULT_KEY="${VAULT_TLS_DIR}/vault.key"
VAULT_CSR="${VAULT_TLS_DIR}/vault.csr"
VAULT_CERT="${VAULT_TLS_DIR}/vault.crt"
VAULT_EXT="${VAULT_TLS_DIR}/vault.ext"

# Create extension file for Vault
cat > "${VAULT_EXT}" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = thaliumx-vault
DNS.2 = vault
DNS.3 = localhost
DNS.4 = vault.thaliumx.local
DNS.5 = vault.thaliumx.com
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate key and CSR
openssl genrsa -out "${VAULT_KEY}" 2048

openssl req -new \
    -key "${VAULT_KEY}" \
    -out "${VAULT_CSR}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${ORG_UNIT}/CN=thaliumx-vault"

# Sign with CA
openssl x509 -req \
    -in "${VAULT_CSR}" \
    -CA "${CA_CERT}" \
    -CAkey "${CA_KEY}" \
    -CAcreateserial \
    -out "${VAULT_CERT}" \
    -days ${CERT_VALIDITY} \
    -sha256 \
    -extfile "${VAULT_EXT}"

# Copy CA cert to Vault TLS dir
cp "${CA_CERT}" "${VAULT_TLS_DIR}/ca.crt"

# Set permissions
chmod 600 "${VAULT_KEY}"
chmod 644 "${VAULT_CERT}"
chmod 644 "${VAULT_TLS_DIR}/ca.crt"

echo "Vault certificate generated: ${VAULT_CERT}"

# ===========================================
# Generate Keycloak Certificate
# ===========================================
echo ""
echo "Generating Keycloak certificate..."

KEYCLOAK_KEY="${KEYCLOAK_TLS_DIR}/tls.key"
KEYCLOAK_CSR="${KEYCLOAK_TLS_DIR}/tls.csr"
KEYCLOAK_CERT="${KEYCLOAK_TLS_DIR}/tls.crt"
KEYCLOAK_EXT="${KEYCLOAK_TLS_DIR}/keycloak.ext"

# Create extension file for Keycloak
cat > "${KEYCLOAK_EXT}" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = thaliumx-keycloak
DNS.2 = keycloak
DNS.3 = localhost
DNS.4 = auth.thaliumx.local
DNS.5 = auth.thaliumx.com
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate key and CSR
openssl genrsa -out "${KEYCLOAK_KEY}" 2048

openssl req -new \
    -key "${KEYCLOAK_KEY}" \
    -out "${KEYCLOAK_CSR}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${ORG_UNIT}/CN=thaliumx-keycloak"

# Sign with CA
openssl x509 -req \
    -in "${KEYCLOAK_CSR}" \
    -CA "${CA_CERT}" \
    -CAkey "${CA_KEY}" \
    -CAcreateserial \
    -out "${KEYCLOAK_CERT}" \
    -days ${CERT_VALIDITY} \
    -sha256 \
    -extfile "${KEYCLOAK_EXT}"

# Copy CA cert to Keycloak TLS dir
cp "${CA_CERT}" "${KEYCLOAK_TLS_DIR}/ca.crt"

# Set permissions
chmod 600 "${KEYCLOAK_KEY}"
chmod 644 "${KEYCLOAK_CERT}"
chmod 644 "${KEYCLOAK_TLS_DIR}/ca.crt"

echo "Keycloak certificate generated: ${KEYCLOAK_CERT}"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=== TLS Setup Complete ==="
echo ""
echo "Generated files:"
echo "  CA Certificate:       ${CA_CERT}"
echo "  Vault Certificate:    ${VAULT_CERT}"
echo "  Vault Key:            ${VAULT_KEY}"
echo "  Keycloak Certificate: ${KEYCLOAK_CERT}"
echo "  Keycloak Key:         ${KEYCLOAK_KEY}"
echo ""
echo "IMPORTANT: For production deployment:"
echo "  1. Replace these self-signed certificates with certificates from a trusted CA"
echo "  2. Store the CA key securely (consider using HSM)"
echo "  3. Set up certificate rotation before expiry"
echo "  4. Add the CA certificate to client trust stores"
echo ""