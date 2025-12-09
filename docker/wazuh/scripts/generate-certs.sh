#!/bin/bash
# Wazuh SSL Certificate Generation Script
# ========================================
# Generates self-signed certificates for Wazuh components

set -e

CERTS_DIR="$(dirname "$0")/../config/wazuh_indexer_ssl_certs"
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo "Generating Wazuh SSL certificates..."

# Generate Root CA
echo "Creating Root CA..."
openssl genrsa -out root-ca-key.pem 2048
openssl req -new -x509 -sha256 -key root-ca-key.pem -subj "/C=US/ST=California/L=California/O=Thaliumx/OU=Security/CN=root-ca" -out root-ca.pem -days 3650

# Copy root-ca for manager
cp root-ca.pem root-ca-manager.pem

# Generate Admin cert
echo "Creating Admin certificate..."
openssl genrsa -out admin-key-temp.pem 2048
openssl pkcs8 -inform PEM -outform PEM -in admin-key-temp.pem -topk8 -nocrypt -v1 PBE-SHA1-3DES -out admin-key.pem
openssl req -new -key admin-key.pem -subj "/C=US/ST=California/L=California/O=Thaliumx/OU=Security/CN=admin" -out admin.csr
openssl x509 -req -in admin.csr -CA root-ca.pem -CAkey root-ca-key.pem -CAcreateserial -sha256 -out admin.pem -days 3650
rm admin-key-temp.pem admin.csr

# Generate Indexer cert
echo "Creating Indexer certificate..."
openssl genrsa -out wazuh.indexer-key-temp.pem 2048
openssl pkcs8 -inform PEM -outform PEM -in wazuh.indexer-key-temp.pem -topk8 -nocrypt -v1 PBE-SHA1-3DES -out wazuh.indexer-key.pem
cat > indexer.ext << EOF
subjectAltName = DNS:thaliumx-wazuh-indexer, DNS:localhost, IP:127.0.0.1
EOF
openssl req -new -key wazuh.indexer-key.pem -subj "/C=US/ST=California/L=California/O=Thaliumx/OU=Security/CN=thaliumx-wazuh-indexer" -out wazuh.indexer.csr
openssl x509 -req -in wazuh.indexer.csr -CA root-ca.pem -CAkey root-ca-key.pem -CAcreateserial -sha256 -out wazuh.indexer.pem -days 3650 -extfile indexer.ext
rm wazuh.indexer-key-temp.pem wazuh.indexer.csr indexer.ext

# Generate Manager/Filebeat cert
echo "Creating Manager certificate..."
openssl genrsa -out wazuh.manager-key-temp.pem 2048
openssl pkcs8 -inform PEM -outform PEM -in wazuh.manager-key-temp.pem -topk8 -nocrypt -v1 PBE-SHA1-3DES -out wazuh.manager-key.pem
cat > manager.ext << EOF
subjectAltName = DNS:thaliumx-wazuh-manager, DNS:localhost, IP:127.0.0.1
EOF
openssl req -new -key wazuh.manager-key.pem -subj "/C=US/ST=California/L=California/O=Thaliumx/OU=Security/CN=thaliumx-wazuh-manager" -out wazuh.manager.csr
openssl x509 -req -in wazuh.manager.csr -CA root-ca.pem -CAkey root-ca-key.pem -CAcreateserial -sha256 -out wazuh.manager.pem -days 3650 -extfile manager.ext
rm wazuh.manager-key-temp.pem wazuh.manager.csr manager.ext

# Generate Dashboard cert
echo "Creating Dashboard certificate..."
openssl genrsa -out wazuh.dashboard-key-temp.pem 2048
openssl pkcs8 -inform PEM -outform PEM -in wazuh.dashboard-key-temp.pem -topk8 -nocrypt -v1 PBE-SHA1-3DES -out wazuh.dashboard-key.pem
cat > dashboard.ext << EOF
subjectAltName = DNS:thaliumx-wazuh-dashboard, DNS:localhost, IP:127.0.0.1
EOF
openssl req -new -key wazuh.dashboard-key.pem -subj "/C=US/ST=California/L=California/O=Thaliumx/OU=Security/CN=thaliumx-wazuh-dashboard" -out wazuh.dashboard.csr
openssl x509 -req -in wazuh.dashboard.csr -CA root-ca.pem -CAkey root-ca-key.pem -CAcreateserial -sha256 -out wazuh.dashboard.pem -days 3650 -extfile dashboard.ext
rm wazuh.dashboard-key-temp.pem wazuh.dashboard.csr dashboard.ext

# Set permissions
chmod 400 *-key.pem
chmod 444 *.pem

echo "Certificates generated successfully in $CERTS_DIR"
ls -la