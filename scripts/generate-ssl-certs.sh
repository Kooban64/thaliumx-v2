#!/bin/bash
# ThaliumX SSL Certificate Generation Script
# Generates all required SSL certificates for production deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/certs"

# Certificate validity in days
CA_VALIDITY=3650
CERT_VALIDITY=365

# Organization details
COUNTRY="ZA"
STATE="Gauteng"
CITY="Johannesburg"
ORG="ThaliumX"
OU="Infrastructure"

log_info "Starting SSL certificate generation..."
log_info "Certificates will be stored in: $CERTS_DIR"

# Clean up existing broken structure
rm -rf "$CERTS_DIR"

# Create directory structure
mkdir -p "$CERTS_DIR/ca"
mkdir -p "$CERTS_DIR/services/postgres"
mkdir -p "$CERTS_DIR/services/redis"
mkdir -p "$CERTS_DIR/services/mongodb"
mkdir -p "$CERTS_DIR/services/vault"
mkdir -p "$CERTS_DIR/services/keycloak"
mkdir -p "$CERTS_DIR/services/apisix"
mkdir -p "$CERTS_DIR/client/backend-service"

# Generate CA private key
log_info "Generating CA private key..."
openssl genrsa -out "$CERTS_DIR/ca/ca.key" 4096
chmod 600 "$CERTS_DIR/ca/ca.key"

# Generate CA certificate
log_info "Generating CA certificate..."
openssl req -new -x509 -days $CA_VALIDITY \
    -key "$CERTS_DIR/ca/ca.key" \
    -out "$CERTS_DIR/ca/ca.crt" \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$OU/CN=ThaliumX Root CA"
chmod 644 "$CERTS_DIR/ca/ca.crt"

# Function to generate service certificate
generate_service_cert() {
    local service=$1
    local cn=$2
    local san=$3
    local dir="$CERTS_DIR/services/$service"
    
    log_info "Generating certificate for $service ($cn)..."
    
    # Generate private key
    openssl genrsa -out "$dir/server.key" 2048
    chmod 600 "$dir/server.key"
    
    # Create CSR config with SAN
    cat > "$dir/csr.conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
OU = $service
CN = $cn

[req_ext]
subjectAltName = $san
EOF
    
    # Generate CSR
    openssl req -new \
        -key "$dir/server.key" \
        -out "$dir/server.csr" \
        -config "$dir/csr.conf"
    
    # Create extension config
    cat > "$dir/ext.conf" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = $san
EOF
    
    # Sign certificate with CA
    openssl x509 -req \
        -in "$dir/server.csr" \
        -CA "$CERTS_DIR/ca/ca.crt" \
        -CAkey "$CERTS_DIR/ca/ca.key" \
        -CAcreateserial \
        -out "$dir/server.crt" \
        -days $CERT_VALIDITY \
        -extfile "$dir/ext.conf"
    chmod 644 "$dir/server.crt"
    
    # Clean up temporary files
    rm -f "$dir/csr.conf" "$dir/ext.conf" "$dir/server.csr"
    
    log_success "Certificate generated for $service"
}

# Generate certificates for each service
generate_service_cert "postgres" "thaliumx-postgres" \
    "DNS:thaliumx-postgres,DNS:thaliumx-citus-coordinator,DNS:thaliumx-citus-worker-1,DNS:thaliumx-citus-worker-2,DNS:localhost,IP:127.0.0.1"

generate_service_cert "redis" "thaliumx-redis" \
    "DNS:thaliumx-redis,DNS:localhost,IP:127.0.0.1"

generate_service_cert "mongodb" "thaliumx-mongodb" \
    "DNS:thaliumx-mongodb,DNS:localhost,IP:127.0.0.1"

generate_service_cert "vault" "thaliumx-vault" \
    "DNS:thaliumx-vault,DNS:localhost,IP:127.0.0.1"

generate_service_cert "keycloak" "thaliumx-keycloak" \
    "DNS:thaliumx-keycloak,DNS:localhost,IP:127.0.0.1"

generate_service_cert "apisix" "thaliumx-apisix" \
    "DNS:thaliumx-apisix,DNS:localhost,DNS:*.thaliumx.com,IP:127.0.0.1"

# Generate MongoDB combined PEM file (cert + key)
log_info "Creating MongoDB combined PEM file..."
cat "$CERTS_DIR/services/mongodb/server.crt" "$CERTS_DIR/services/mongodb/server.key" > "$CERTS_DIR/services/mongodb/mongodb.pem"
chmod 600 "$CERTS_DIR/services/mongodb/mongodb.pem"

# Generate client certificate for backend service
log_info "Generating client certificate for backend service..."
CLIENT_DIR="$CERTS_DIR/client/backend-service"

openssl genrsa -out "$CLIENT_DIR/client.key" 2048
chmod 600 "$CLIENT_DIR/client.key"

cat > "$CLIENT_DIR/csr.conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
OU = backend-service
CN = thaliumx-backend
EOF

openssl req -new \
    -key "$CLIENT_DIR/client.key" \
    -out "$CLIENT_DIR/client.csr" \
    -config "$CLIENT_DIR/csr.conf"

cat > "$CLIENT_DIR/ext.conf" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl x509 -req \
    -in "$CLIENT_DIR/client.csr" \
    -CA "$CERTS_DIR/ca/ca.crt" \
    -CAkey "$CERTS_DIR/ca/ca.key" \
    -CAcreateserial \
    -out "$CLIENT_DIR/client.crt" \
    -days $CERT_VALIDITY \
    -extfile "$CLIENT_DIR/ext.conf"
chmod 644 "$CLIENT_DIR/client.crt"

rm -f "$CLIENT_DIR/csr.conf" "$CLIENT_DIR/ext.conf" "$CLIENT_DIR/client.csr"

# Copy CA cert to all service directories for convenience
for service in postgres redis mongodb vault keycloak apisix; do
    cp "$CERTS_DIR/ca/ca.crt" "$CERTS_DIR/services/$service/"
done
cp "$CERTS_DIR/ca/ca.crt" "$CLIENT_DIR/"

log_success "All SSL certificates generated successfully!"
echo ""
echo "Certificate structure:"
find "$CERTS_DIR" -type f -name "*.crt" -o -name "*.key" -o -name "*.pem" | sort