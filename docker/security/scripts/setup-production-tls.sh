#!/bin/bash
# ===========================================
# ThaliumX Production TLS Setup Script
# ===========================================
# This script generates TLS certificates for Vault and Zitadel
# For production, replace with certificates from a trusted CA

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"
VAULT_TLS_DIR="${CONFIG_DIR}/vault/tls"
ZITADEL_TLS_DIR="${CONFIG_DIR}/zitadel/tls"

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
mkdir -p "${ZITADEL_TLS_DIR}"

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
# Generate Zitadel Certificate
# ===========================================
echo ""
echo "Generating Zitadel certificate..."

ZITADEL_KEY="${ZITADEL_TLS_DIR}/tls.key"
ZITADEL_CSR="${ZITADEL_TLS_DIR}/tls.csr"
ZITADEL_CERT="${ZITADEL_TLS_DIR}/tls.crt"
ZITADEL_EXT="${ZITADEL_TLS_DIR}/zitadel.ext"

# Create extension file for Zitadel
cat > "${ZITADEL_EXT}" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = thaliumx-zitadel
DNS.2 = zitadel
DNS.3 = localhost
DNS.4 = auth.thaliumx.local
DNS.5 = auth.thaliumx.com
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate key and CSR
openssl genrsa -out "${ZITADEL_KEY}" 2048

openssl req -new \
    -key "${ZITADEL_KEY}" \
    -out "${ZITADEL_CSR}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${ORG_UNIT}/CN=thaliumx-zitadel"

# Sign with CA
openssl x509 -req \
    -in "${ZITADEL_CSR}" \
    -CA "${CA_CERT}" \
    -CAkey "${CA_KEY}" \
    -CAcreateserial \
    -out "${ZITADEL_CERT}" \
    -days ${CERT_VALIDITY} \
    -sha256 \
    -extfile "${ZITADEL_EXT}"

# Copy CA cert to Zitadel TLS dir
cp "${CA_CERT}" "${ZITADEL_TLS_DIR}/ca.crt"

# Set permissions
chmod 600 "${ZITADEL_KEY}"
chmod 644 "${ZITADEL_CERT}"
chmod 644 "${ZITADEL_TLS_DIR}/ca.crt"

echo "Zitadel certificate generated: ${ZITADEL_CERT}"

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
echo "  Zitadel Certificate:  ${ZITADEL_CERT}"
echo "  Zitadel Key:          ${ZITADEL_KEY}"
echo ""
echo "IMPORTANT: For production deployment:"
echo "  1. Replace these self-signed certificates with certificates from a trusted CA"
echo "  2. Store the CA key securely (consider using HSM)"
echo "  3. Set up certificate rotation before expiry"
echo "  4. Add the CA certificate to client trust stores"
echo ""