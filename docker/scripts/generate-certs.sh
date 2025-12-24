#!/usr/bin/env bash
# ThaliumX certificate generator (deploy-time)
#
# Purpose:
# - Generate a local CA and leaf certificates for internal services.
# - Produce the filenames expected by the production compose files under `docker/`.
#
# IMPORTANT:
# - Generated material includes private keys and MUST NOT be committed.
# - Store/ship production certs via a secrets manager or host mounts.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="${DOCKER_DIR}/certs"
CA_DIR="${CERTS_DIR}/ca"

ENVIRONMENT="development"
DOMAIN="thaliumx.local"
FORCE="false"

usage() {
  cat <<'EOF'
Usage: docker/scripts/generate-certs.sh [--environment <name>] [--domain <domain>] [--force]

Generates a CA plus per-service and per-client certificates under docker/certs/.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --environment)
      ENVIRONMENT="$2"; shift 2 ;;
    --domain)
      DOMAIN="$2"; shift 2 ;;
    --force)
      FORCE="true"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

log() { printf '%s\n' "$*"; }

ensure_dirs() {
  mkdir -p "${CA_DIR}"
  mkdir -p "${CERTS_DIR}/services" "${CERTS_DIR}/client" "${CERTS_DIR}/server" "${CERTS_DIR}/bundles"
}

maybe_wipe() {
  if [ "$FORCE" = "true" ]; then
    log "[WARN] --force set; deleting existing ${CERTS_DIR}"
    rm -rf "${CERTS_DIR}"
    ensure_dirs
  fi
}

generate_ca() {
  if [ -f "${CA_DIR}/ca.crt" ] && [ -f "${CA_DIR}/ca.key" ] && [ "$FORCE" != "true" ]; then
    log "[INFO] CA already exists; skipping"
    return
  fi

  log "[INFO] Generating CA (environment=${ENVIRONMENT}, domain=${DOMAIN})"
  openssl genrsa -out "${CA_DIR}/ca.key" 4096
  chmod 600 "${CA_DIR}/ca.key"

  openssl req -new -x509 -days 3650 \
    -key "${CA_DIR}/ca.key" \
    -out "${CA_DIR}/ca.crt" \
    -subj "/C=US/ST=CA/L=SanFrancisco/O=ThaliumX/OU=${ENVIRONMENT}/CN=ThaliumX Internal CA (${DOMAIN})"
  chmod 644 "${CA_DIR}/ca.crt"
}

write_openssl_cnf() {
  # $1 = path
  # $2 = CN
  # $3 = SAN entries, e.g. "DNS:foo,DNS:bar,IP:127.0.0.1"
  cat > "$1" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = US
ST = CA
L = SanFrancisco
O = ThaliumX
OU = ${ENVIRONMENT}
CN = ${2}

[req_ext]
subjectAltName = ${3}
EOF
}

generate_leaf() {
  # $1 = serviceName
  # $2 = CN
  # $3 = SAN
  local name="$1"
  local cn="$2"
  local san="$3"
  local dir="${CERTS_DIR}/services/${name}"

  mkdir -p "$dir"

  local key="$dir/${name}.key"
  local csr="$dir/${name}.csr"
  local crt="$dir/${name}.crt"
  local cnf="$dir/${name}.cnf"
  local chain="$dir/${name}-chain.pem"

  if [ -f "$crt" ] && [ -f "$key" ] && [ "$FORCE" != "true" ]; then
    log "[INFO] ${name} cert already exists; skipping"
  else
    log "[INFO] Generating ${name} certificate"
    openssl genrsa -out "$key" 4096
    chmod 600 "$key"

    write_openssl_cnf "$cnf" "$cn" "$san"
    openssl req -new -key "$key" -out "$csr" -config "$cnf"

    openssl x509 -req -days 825 -sha256 \
      -in "$csr" \
      -CA "${CA_DIR}/ca.crt" \
      -CAkey "${CA_DIR}/ca.key" \
      -CAcreateserial \
      -out "$crt" \
      -extfile "$cnf" \
      -extensions req_ext
    chmod 644 "$crt"
  fi

  # Compose expects these names in many services
 cp -f "${CA_DIR}/ca.crt" "$dir/ca.crt"
 cp -f "$crt" "$dir/server.crt"
 cp -f "$key" "$dir/server.key"
 # Set proper permissions for PostgreSQL (owned by postgres user, UID 70)
 chown 70:70 "$dir/server.key" 2>/dev/null || true
 chmod 600 "$dir/server.key"
 cat "$crt" "${CA_DIR}/ca.crt" > "$chain"
 chmod 644 "$chain" || true
}

generate_client() {
  # $1 = clientName (directory name)
  # $2 = CN
  local name="$1"
  local cn="$2"
  local dir="${CERTS_DIR}/client/${name}"
  mkdir -p "$dir"

  local key="$dir/${name}.key"
  local csr="$dir/${name}.csr"
  local crt="$dir/${name}.crt"
  local cnf="$dir/${name}.cnf"

  if [ -f "$crt" ] && [ -f "$key" ] && [ "$FORCE" != "true" ]; then
    log "[INFO] client ${name} already exists; skipping"
  else
    log "[INFO] Generating client certificate: ${name}"
    openssl genrsa -out "$key" 4096
    chmod 600 "$key"

    cat > "$cnf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
C = US
ST = CA
L = SanFrancisco
O = ThaliumX
OU = ${ENVIRONMENT}
CN = ${cn}
EOF
    openssl req -new -key "$key" -out "$csr" -config "$cnf"

    openssl x509 -req -days 825 -sha256 \
      -in "$csr" \
      -CA "${CA_DIR}/ca.crt" \
      -CAkey "${CA_DIR}/ca.key" \
      -CAcreateserial \
      -out "$crt"
    chmod 644 "$crt"
  fi

  cp -f "${CA_DIR}/ca.crt" "$dir/ca.crt"
}

generate_mongodb_extras() {
  local dir="${CERTS_DIR}/services/mongodb"
  if [ -d "$dir" ]; then
    # Combined PEM expected by some Mongo TLS modes
    if [ -f "$dir/mongodb.crt" ] && [ -f "$dir/mongodb.key" ]; then
      cat "$dir/mongodb.crt" "$dir/mongodb.key" > "$dir/mongodb.pem"
      chmod 600 "$dir/mongodb.pem"
    fi

    # Keyfile for replica set internal auth (must be 6-1024 chars, same across members)
    if [ ! -f "$dir/mongodb-keyfile" ] || [ "$FORCE" = "true" ]; then
      openssl rand -base64 756 | tr -d '\n' > "$dir/mongodb-keyfile"
      chmod 600 "$dir/mongodb-keyfile"
    fi
  fi
}

generate_bundles() {
  cp -f "${CA_DIR}/ca.crt" "${CERTS_DIR}/bundles/ca-bundle.crt"
  cp -f "${CA_DIR}/ca.crt" "${CERTS_DIR}/bundles/all-ca-bundle.crt"
}

main() {
  ensure_dirs
  maybe_wipe
  generate_ca

  # Services (produce both <name>.crt/.key and server.crt/server.key)
  generate_leaf "vault" "thaliumx-vault" "DNS:thaliumx-vault,DNS:vault,DNS:localhost,IP:127.0.0.1"
  generate_leaf "keycloak" "thaliumx-keycloak" "DNS:thaliumx-keycloak,DNS:keycloak,DNS:localhost,IP:127.0.0.1"
  generate_leaf "postgres" "thaliumx-postgres" "DNS:thaliumx-postgres,DNS:postgres,DNS:localhost,IP:127.0.0.1"
  generate_leaf "redis" "thaliumx-redis" "DNS:thaliumx-redis,DNS:redis,DNS:localhost,IP:127.0.0.1"
  generate_leaf "mongodb" "thaliumx-mongodb" "DNS:thaliumx-mongodb,DNS:mongodb,DNS:localhost,IP:127.0.0.1"
  generate_leaf "etcd" "thaliumx-etcd" "DNS:thaliumx-etcd,DNS:etcd,DNS:localhost,IP:127.0.0.1"
  generate_leaf "kafka" "thaliumx-kafka" "DNS:thaliumx-kafka,DNS:kafka,DNS:localhost,IP:127.0.0.1"
  generate_leaf "apisix" "thaliumx-apisix" "DNS:thaliumx-apisix,DNS:apisix,DNS:localhost,DNS:*.${DOMAIN},IP:127.0.0.1"
  generate_leaf "backend" "thaliumx-backend" "DNS:thaliumx-backend,DNS:backend,DNS:localhost,IP:127.0.0.1"
  generate_leaf "fintech" "thaliumx-fintech" "DNS:thaliumx-ballerine-backoffice,DNS:thaliumx-ballerine-workflow,DNS:localhost,IP:127.0.0.1"
  generate_leaf "trading" "thaliumx-trading" "DNS:thaliumx-dingir-restapi,DNS:thaliumx-dingir-matchengine,DNS:localhost,IP:127.0.0.1"
  generate_leaf "timescaledb" "thaliumx-timescaledb" "DNS:thaliumx-timescaledb,DNS:timescaledb,DNS:localhost,IP:127.0.0.1"
  generate_leaf "citus" "thaliumx-citus" "DNS:thaliumx-citus-coordinator,DNS:thaliumx-citus-worker-1,DNS:thaliumx-citus-worker-2,DNS:citus,DNS:localhost,IP:127.0.0.1"

  generate_mongodb_extras

  # Client certs referenced by production compose
  generate_client "backend-service" "thaliumx-backend"
  generate_client "compliance-service" "thaliumx-compliance"
  generate_client "trading-service" "thaliumx-trading"
  generate_client "fintech-service" "thaliumx-fintech"
  generate_client "admin-client" "thaliumx-admin"

  generate_bundles

  log "[SUCCESS] Certificates generated under: ${CERTS_DIR}"
  log "[INFO] NOTE: These files are gitignored; do not commit them."
}

main

