# Liquibook Installation and Usage Guide

## Overview
Liquibook is an open-source order matching engine library written in C++ by Object Computing, Inc. It provides low-level components for order matching in financial exchanges.

## Repository Information
- **Repository**: https://github.com/enewhuis/liquibook
- **Version**: v2.0.0 (latest stable release)
- **License**: Apache-2.0
- **Release Date**: 2023-08

## Key Features
- High-performance order matching (2.0-2.5 million inserts/second)
- Supports buy/sell orders with various properties
- Depth book maintenance
- Header-only library (no compilation required for core usage)
- Compatible with existing order models

## Dependencies
Liquibook has no runtime dependencies. For building tests and examples:
- **MPC** (Makefile/Project Creator): http://www.ociweb.com/products/mpc
- **Perl**: Required for MPC (pre-installed on most Linux systems)
- **Boost** (optional, for unit tests): http://www.boost.org/
- **QuickFAST** (optional, for market data examples): https://github.com/objectcomputing/quickfast

## Installation Steps

### 1. Clone Repository
```bash
cd docker/trading
git clone https://github.com/enewhuis/liquibook.git liquibook
cd liquibook
git checkout v2.0.0
```

### 2. Core Library Usage (Header-Only)
No compilation required. Simply:
- Add `liquibook/src` to your include path
- Include `<book/order_book.h>` in your source code

### 3. Building Tests and Examples (Optional)
```bash
# Install dependencies
sudo apt update
sudo apt install build-essential perl

# Install Boost (for unit tests)
sudo apt install libboost-all-dev

# Set environment variables
export BOOST_ROOT=/usr/include/boost
export LIQUIBOOK_ROOT=$(pwd)

# Generate build files
$MPC_ROOT/mwc.pl -type make liquibook.mwc

# Build
make depend
make all
```

### 4. Environment Setup
```bash
# Source environment script
. ./env.sh
```

## Usage in Thaliumx Environment
- Integrated as Node.js wrapper in `docker/trading/liquibook/`
- Provides HTTP API for order book operations
- Connects to Dingir matchengine via gRPC

## Configuration
- Port: 8083 (internal 8080)
- Environment: Production
- Exchange endpoint: thaliumx-dingir-matchengine:50051

## Testing
Run unit tests (if built):
```bash
cd bin/test
./liquibook_tests
```

## Troubleshooting
- Ensure C++11 compatible compiler
- Check Boost installation paths
- Verify MPC installation

## Performance Benchmarks
- Sustained rate: 2.0-2.5 million inserts/second
- Results may vary by hardware/OS