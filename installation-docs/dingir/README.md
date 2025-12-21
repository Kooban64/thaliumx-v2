# Dingir Exchange Installation and Usage Guide

## Overview
Dingir Exchange is a high-performance exchange trading server written in Rust. It provides a fully async, single-threaded, memory-based matching engine capable of thousands of transactions per second.

## Repository Information
- **Repository**: https://github.com/fluidex/dingir-exchange
- **Branch**: master
- **Commit**: 665194c (latest on master)
- **License**: Apache-2.0
- **Date**: 2025-12-15

## Key Features
- High-performance matching engine (thousands TPS)
- Async single-threaded architecture
- gRPC API interface
- User balance management
- Market data notifications
- Order state change notifications
- Redis-like persistence
- Kafka integration

## Dependencies
- **Rust**: Latest stable version
- **CMake**: For building dependencies
- **librdkafka**: Apache Kafka C/C++ client library

## Installation Steps

### 1. Install System Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y cmake librdkafka-dev build-essential

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Clone Repository
```bash
cd docker/trading
git clone https://github.com/fluidex/dingir-exchange.git dingir
cd dingir
# Use latest master (no tagged releases)
```

### 3. Build
```bash
# Build all components
cargo build --release

# Or build specific binaries
cargo build --bin matchengine --release
cargo build --bin restapi --release
```

### 4. Configuration
Key configuration files:
- `config/production.yaml`
- `config/default.yaml`
- Environment variables in `trading.env`

## Usage in Thaliumx Environment
- **Matchengine**: Core trading engine (gRPC port 50051)
- **Restapi**: HTTP interface (port 50053)
- Database: TimescaleDB
- Cache: Redis
- Messaging: Kafka
- Vault: For secrets management

## Docker Integration
Built using multi-stage Dockerfile:
- Base: Rust build environment
- Runtime: Ubuntu with compiled binaries

## Testing
```bash
# Run tests
cargo test

# Integration test with dependencies
# Start required services (Postgres, Redis, Kafka)
docker-compose --file "./orchestra/docker/docker-compose.yaml" up --detach

# Run matchengine
cargo run --bin matchengine

# Test with example client
cd examples/js
npm install
npx ts-node tests/trade.ts
```

## Performance
- Thousands of transactions per second
- Single-threaded async design
- Memory-based for speed

## Release Build
```bash
# Static release build
RUSTFLAGS="-C link-arg=-static -C target-feature=+crt-static" cross build --bin matchengine --target x86_64-unknown-linux-gnu --release

# Docker image
./release/release.sh YOUR_REGISTRY NEW_TAG
```

## Troubleshooting
- Ensure Rust toolchain is installed
- Check librdkafka development headers
- Verify network connectivity for external services
- Check logs in `/app/logs`

## Related Components
- Inspired by Redis and Viabtc Exchange Server
- Complements Peatio for full exchange functionality