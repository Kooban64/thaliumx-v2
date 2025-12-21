# QuantLib Installation and Usage Guide

## Overview
QuantLib is a free/open-source library for quantitative finance. It provides a comprehensive framework for modeling, trading, and risk management in real-life financial applications.

## Repository Information
- **Repository**: https://github.com/lballabio/QuantLib
- **Version**: v1.40
- **License**: BSD-3-Clause
- **Release Date**: 2025-10-14

## Key Features
- Quantitative finance library
- Financial instrument pricing
- Risk management tools
- Yield curve modeling
- Derivatives pricing
- Cross-platform support

## Dependencies
- **CMake**: Build system
- **Boost**: C++ libraries (headers and development libraries)
- **C++ Compiler**: GCC/Clang with C++11 support

## Installation Steps

### 1. Install System Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y cmake build-essential libboost-all-dev

# RedHat/CentOS/Fedora
sudo dnf install -y cmake gcc-c++ boost-devel
```

### 2. Clone Repository
```bash
cd docker/trading
git clone https://github.com/lballabio/QuantLib.git quantlib
cd quantlib
git checkout v1.40
```

### 3. Build
```bash
# Create build directory
mkdir build
cd build

# Configure with CMake
cmake ..

# Build
make -j$(nproc)

# Install (optional)
sudo make install
```

### 4. Alternative Build Methods
```bash
# Autotools build
./autogen.sh
./configure
make -j$(nproc)
sudo make install
```

## Usage in Thaliumx Environment
- Python-based financial analytics service
- Provides pricing, risk, and yield curve calculations
- Port: 3010
- Redis caching
- MongoDB data storage

## Configuration
- Environment variables in `trading.env`
- Python application with logging
- Financial models in `/app/models`

## Testing
```bash
# Run test suite
cd build
make check

# Or from source
cd test-suite
make check
```

## Docker Integration
Built using Python base image with:
- Compiled QuantLib library
- Python bindings
- Financial calculation endpoints

## Performance
- Optimized C++ implementation
- Python bindings for ease of use
- Caching with Redis

## Troubleshooting
- Ensure Boost development headers are installed
- Check CMake version (3.1+ required)
- Verify C++11 compiler support
- Check library paths after installation

## Documentation
- Official docs: https://www.quantlib.org/docs.shtml
- API reference: https://www.quantlib.org/reference/
- Examples in `Examples/` directory

## Related Libraries
- Boost for underlying functionality
- Python ecosystem for data analysis
- Integration with financial databases