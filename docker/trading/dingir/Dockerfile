# Multi-stage build for Dingir Exchange (Rust)
#
# NOTE:
# - `docker/compose/prod-v1/trading.yml` expects this file to exist.
# - The Rust toolchain is pinned by `rust-toolchain` to 1.56.0.

FROM rust:1.56-alpine AS builder

# Install build dependencies (git required for Cargo git dependencies)
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    librdkafka-dev \
    postgresql-dev \
    protobuf-dev \
    protoc \
    cmake \
    make \
    gcc \
    g++ \
    git

# Some upstream build scripts (e.g. `orchestra`) require rustfmt to be available
RUN rustup component add rustfmt

WORKDIR /app

# Copy manifests first for better layer caching
COPY Cargo.toml Cargo.lock ./

# Copy source code + runtime configs
COPY src ./src
COPY migrations ./migrations
COPY config ./config

# Build the application
RUN cargo build --release

# Runtime stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    librdkafka \
    postgresql-client \
    curl \
    jq \
    su-exec

# Create app user
RUN addgroup -g 1001 -S dingir && \
    adduser -S dingir -u 1001 -G dingir

WORKDIR /app

# Copy binaries from builder stage
COPY --from=builder /app/target/release/restapi /app/restapi
COPY --from=builder /app/target/release/matchengine /app/matchengine

# Copy configuration files
COPY --from=builder /app/config ./config
COPY --from=builder /app/migrations ./migrations

# Change ownership to app user
RUN chown -R dingir:dingir /app

USER dingir

# Expose ports
EXPOSE 50051 50053

# Default entrypoint (compose overrides this per service)
CMD ["./restapi"]
