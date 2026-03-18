#!/bin/bash
# ===========================================
# ThaliumX Production Secrets Generator
# ===========================================
# This script generates strong random secrets for production deployment.
# Usage: ./generate-production-secrets.sh
#
# Generated secrets should be:
# 1. Stored in HashiCorp Vault
# 2. Or passed as Docker secrets
# 3. Or set as environment variables in CI/CD
#
# NEVER commit generated secrets to version control!

set -e

echo "============================================"
echo "ThaliumX Production Secrets Generator"
echo "============================================"
echo ""

# Function to generate random string
generate_secret() {
    local length=$1
    # Use /dev/urandom for cryptographically secure random bytes
    # Filter to include only alphanumeric characters
    # Use tr to convert and head to limit length
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
}

# Generate 64-character secrets (JWT_SECRET, ENCRYPTION_KEY)
jwt_secret=$(generate_secret 64)
encryption_key=$(generate_secret 64)

# Generate 32-character secrets (METRICS_TOKEN, INTERNAL_REQUEST_TOKEN)
metrics_token=$(generate_secret 32)
internal_request_token=$(generate_secret 32)

# Generate database password (32 char for complexity)
db_password=$(generate_secret 32)

# Generate Redis password (32 char)
redis_password=$(generate_secret 32)

# Generate MongoDB password (32 char)
mongodb_password=$(generate_secret 32)

# Generate TimescaleDB password (32 char)
timescale_password=$(generate_secret 32)

# Generate Kafka SASL password
kafka_password=$(generate_secret 32)

# Generate Typesense API key (32 char)
typesense_api_key=$(generate_secret 32)

# Generate SMTP password (for SendGrid, etc.)
smtp_password=$(generate_secret 32)

# Generate Stripe key
stripe_secret_key=$(generate_secret 32)

# Generate Ballerine API key
ballerine_api_key=$(generate_secret 32)

echo "============================================"
echo "GENERATED SECRETS"
echo "============================================"
echo ""
echo "# Copy these to Vault or use as Docker secrets"
echo ""
echo "# --------------------------------------------------------"
echo "# JWT & ENCRYPTION (64 characters)"
echo "# --------------------------------------------------------"
echo "JWT_SECRET=${jwt_secret}"
echo "ENCRYPTION_KEY=${encryption_key}"
echo ""
echo "# --------------------------------------------------------"
echo "# INTERNAL AUTHENTICATION (32 characters)"
echo "# --------------------------------------------------------"
echo "METRICS_TOKEN=${metrics_token}"
echo "INTERNAL_REQUEST_TOKEN=${internal_request_token}"
echo ""
echo "# --------------------------------------------------------"
echo "# DATABASE CREDENTIALS (32 characters)"
echo "# --------------------------------------------------------"
echo "POSTGRES_PASSWORD=${db_password}"
echo "TIMESCALE_PASSWORD=${timescale_password}"
echo ""
echo "# --------------------------------------------------------"
echo "# CACHE & QUEUE CREDENTIALS (32 characters)"
echo "# --------------------------------------------------------"
echo "REDIS_PASSWORD=${redis_password}"
echo "KAFKA_SASL_PASSWORD=${kafka_password}"
echo ""
echo "# --------------------------------------------------------"
echo "# ADDITIONAL SERVICES"
echo "# --------------------------------------------------------"
echo "MONGODB_PASSWORD=${mongodb_password}"
echo "TYPESENSE_API_KEY=${typesense_api_key}"
echo "SMTP_PASSWORD=${smtp_password}"
echo "STRIPE_SECRET_KEY=${stripe_secret_key}"
echo "BALLERINE_API_KEY=${ballerine_api_key}"
echo ""
echo "============================================"
echo "PRODUCTION .ENV OUTPUT"
echo "============================================"
echo ""

# Output in .env format for direct use
cat << EOF
# ThaliumX Production Environment Variables
# Generated on $(date -u +"%Y-%m-%d %H:%M UTC")
# IMPORTANT: Review and set these in your production environment

# ===================
# DATABASE - SSL REQUIRED
# ===================
DB_SSL=true
POSTGRES_HOST=thaliumx-postgres
POSTGRES_PORT=5432
POSTGRES_USER=thaliumx
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=thaliumx
DATABASE_URL=postgresql://thaliumx:${db_password}@thaliumx-postgres:5432/thaliumx?ssl=true&sslmode=require

# ===================
# REDIS - SSL REQUIRED
# ===================
REDIS_URL=rediss://:${redis_password}@thaliumx-redis:6379?ssl=true
REDIS_HOST=thaliumx-redis
REDIS_PORT=6379
REDIS_PASSWORD=${redis_password}

# ===================
# MONGODB - SSL REQUIRED
# ===================
MONGODB_HOST=thaliumx-mongodb
MONGODB_PORT=27017
MONGODB_USER=thaliumx
MONGODB_PASSWORD=${mongodb_password}
MONGODB_DB=thaliumx

# ===================
# JWT & SECURITY - CRITICAL (64 chars)
# ===================
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=thaliumx
JWT_AUDIENCE=thaliumx-users
ENCRYPTION_KEY=${encryption_key}

# Internal API authentication (32 chars)
INTERNAL_REQUEST_TOKEN=${internal_request_token}

# Metrics endpoint authentication (32 chars)
METRICS_TOKEN=${metrics_token}

# ===================
# KAFKA - SSL REQUIRED
# ===================
KAFKA_BROKERS=thaliumx-kafka:9094
KAFKA_CLIENT_ID=thaliumx-backend
KAFKA_GROUP_ID=thaliumx-group
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_SASL_USERNAME=thaliumx-kafka
KAFKA_SASL_PASSWORD=${kafka_password}

# ===================
# TIMESCALEDB - SSL REQUIRED
# ===================
TIMESCALE_HOST=thaliumx-timescaledb
TIMESCALE_PORT=5432
TIMESCALE_USER=dingir
TIMESCALE_PASSWORD=${timescale_password}
TIMESCALE_DB=exchange
TIMESCALE_SSL=true

# ===================
# BLNKFINANCE / TYPESENSE
# ===================
TYPESENSE_API_KEY=${typesense_api_key}

# ===================
# EMAIL (SMTP)
# ===================
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=${smtp_password}
SMTP_FROM=noreply@thaliumx.com

# ===================
# EXTERNAL SERVICES
# ===================
STRIPE_SECRET_KEY=${stripe_secret_key}
BALLERINE_API_KEY=${ballerine_api_key}
EOF

echo ""
echo "============================================"
echo "VAULT SECRET PATH SUGGESTIONS"
echo "============================================"
echo ""
echo "# Run these commands to store secrets in Vault:"
echo ""
echo "# JWT & Encryption"
echo "vault kv put secret/thaliumx/jwt secret=\"${jwt_secret}\" encryption_key=\"${encryption_key}\""
echo ""
echo "# Database"
echo "vault kv put secret/thaliumx/database postgres_password=\"${db_password}\" timescale_password=\"${timescale_password}\""
echo ""
echo "# Cache & Queue"
echo "vault kv put secret/thaliumx/redis password=\"${redis_password}\""
echo "vault kv put secret/thaliumx/kafka password=\"${kafka_password}\""
echo ""
echo "# API Keys"
echo "vault kv put secret/thaliumx/api-keys metrics_token=\"${metrics_token}\" internal_request_token=\"${internal_request_token}\" typesense_api_key=\"${typesense_api_key}\" ballerine_api_key=\"${ballerine_api_key}\""
echo ""
echo "# External Services"
echo "vault kv put secret/thaliumx/smtp password=\"${smtp_password}\""
echo "vault kv put secret/thaliumx/stripe secret_key=\"${stripe_secret_key}\""
echo ""
echo "============================================"
echo "COMPLETE!"
echo "============================================"
echo "Generated on: $(date -u +"%Y-%m-%d %H:%M UTC")"
