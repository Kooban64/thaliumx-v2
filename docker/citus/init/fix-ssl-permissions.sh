#!/bin/bash
# Fix SSL certificate permissions for PostgreSQL
# This script runs as root before PostgreSQL starts

set -e

echo "Fixing SSL certificate permissions..."

# Copy SSL key to a location accessible by postgres user
mkdir -p /var/lib/postgresql/ssl
cp /var/lib/postgresql/certs/server.key /var/lib/postgresql/ssl/server.key
chown postgres:postgres /var/lib/postgresql/ssl/server.key
chmod 600 /var/lib/postgresql/ssl/server.key

echo "SSL certificate permissions fixed"