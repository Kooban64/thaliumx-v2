#!/bin/bash
# Kafka Production Entrypoint Script
# Sets environment variables from Docker secrets

set -e

# Read Kafka admin password from secret
export KAFKA_ADMIN_PASSWORD=$(cat /run/secrets/kafka-password)

# Confluent Kafka images expect keystore/truststore credentials files when SSL is enabled.
# We generate these credential files at runtime from the Docker secret so we don't store
# any keystore passwords in the repo.
mkdir -p /etc/kafka/secrets
for f in kafka_keystore_creds kafka_truststore_creds kafka_sslkey_creds; do
  printf "%s" "$KAFKA_ADMIN_PASSWORD" > "/etc/kafka/secrets/$f"
  chmod 600 "/etc/kafka/secrets/$f"
done

# IMPORTANT (Production v1 / strict audit mode):
# The Confluent cp-kafka entrypoint only auto-populates truststore location/password when
# client-auth is enabled. However, Kafka performs an internal SSL self-check at startup.
# To avoid embedding secrets in compose, we export the truststore settings at runtime
# from the Docker secret.
export KAFKA_SSL_TRUSTSTORE_LOCATION="/etc/kafka/secrets/${KAFKA_SSL_TRUSTSTORE_FILENAME:-kafka.truststore.jks}"
export KAFKA_SSL_TRUSTSTORE_PASSWORD="$KAFKA_ADMIN_PASSWORD"

# Execute the original entrypoint
exec /etc/confluent/docker/run
