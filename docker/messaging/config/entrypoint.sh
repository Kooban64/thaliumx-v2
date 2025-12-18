#!/bin/bash
# Kafka Production Entrypoint Script
# Sets environment variables from Docker secrets

set -e

# Read Kafka admin password from secret
export KAFKA_ADMIN_PASSWORD=$(cat /run/secrets/kafka-password)

# Execute the original entrypoint
exec /etc/confluent/docker/run