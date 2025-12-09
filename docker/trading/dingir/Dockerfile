# Multi-stage build for Dingir Exchange (Rust)
FROM rust:1.70-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    postgresql-dev \
    protobuf-dev \
    protoc \
    cmake \
    make \
    gcc \
    g++

# Install rustfmt
RUN rustup component add rustfmt

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Copy source code
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
    postgresql-client \
    curl

# Create app user
RUN addgroup -g 1001 -S dingir && \
    adduser -S dingir -u 1001 -G dingir

# Set working directory
WORKDIR /app

# Copy binaries from builder stage
COPY --from=builder /app/target/release/restapi /app/restapi
COPY --from=builder /app/target/release/matchengine /app/matchengine

# Copy configuration files
COPY --from=builder /app/config ./config
COPY --from=builder /app/migrations ./migrations

# Change ownership to app user
RUN chown -R dingir:dingir /app

# Switch to app user
USER dingir

# Expose ports
EXPOSE 8080 50051

# Health check (removed for matchengine service - it's gRPC only)

# Run the application (default to restapi)
CMD ["./restapi"]