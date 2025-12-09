# BlinkFinance (Blnk) Service for ThaliumX Platform
# ================================================
# Builds from the official blnkfinance/blnk repository
# https://github.com/blnkfinance/blnk
#
# NOTE: v0.7.0 has a hardcoded Typesense API key "blnk-api-key"
# We configure Typesense to use this key instead of patching Blnk.

FROM golang:1.21-alpine AS builder

WORKDIR /go/src/blnk

# Install build dependencies
RUN apk add --no-cache git

# Clone Blnk repository - use v0.7.0 which is compatible with Go 1.21
ARG BLNK_VERSION=v0.7.0
RUN git clone --depth 1 --branch ${BLNK_VERSION} https://github.com/blnkfinance/blnk.git . || \
    git clone --depth 1 https://github.com/blnkfinance/blnk.git .

# Download dependencies
RUN go mod download

# Build the binary (following official Dockerfile pattern)
RUN go build -o /blnk ./cmd/*.go

# Final stage - using debian for pg_dump compatibility
FROM debian:bullseye-slim

# Install runtime dependencies including PostgreSQL client for pg_dump
RUN apt-get update && apt-get install -y wget gnupg2 lsb-release ca-certificates && \
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get install -y postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /blnk /app/blnk
RUN chmod +x /app/blnk

# Create non-root user for security
RUN groupadd -g 1001 blnk && \
    useradd -u 1001 -g blnk -m blnk && \
    mkdir -p /app/data && \
    chown -R blnk:blnk /app

USER blnk

# Expose the default port (Blnk uses 5001 by default, configurable via BLNK_SERVER_PORT)
EXPOSE 5001

# Health check - Blnk returns "server running..." on root endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:5001/ || exit 1

# Start the server from /app directory where blnk.json is expected
CMD ["./blnk", "start"]