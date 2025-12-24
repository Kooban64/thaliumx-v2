#!/bin/bash

# ===========================================
# ThaliumX Dependency Security Scan Script
# ===========================================
# Scans all Node.js/TypeScript services for dependency vulnerabilities
# Runs npm audit, yarn audit, and other security checks
#
# Usage:
#   ./dependency-security-scan.sh [service-name]
#
# If service-name is provided, scans only that service
# Otherwise scans all services
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Services to scan
SERVICES=(
    "ballerine"
    "blnk"
)

# Function to scan a service
scan_service() {
    local service="$1"
    local service_path="$PROJECT_ROOT/$service"

    if [ ! -d "$service_path" ]; then
        echo -e "${YELLOW}Warning: Service directory $service_path not found, skipping${NC}"
        return 0
    fi

    echo -e "${BLUE}Scanning $service...${NC}"

    cd "$service_path"

    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}No package.json found in $service, skipping${NC}"
        return 0
    fi

    # Run pnpm audit
    echo "Running pnpm audit..."
    if pnpm audit --audit-level=moderate --json > /tmp/pnpm-audit-$service.json 2>/dev/null; then
        echo -e "${GREEN}✓ pnpm audit passed for $service${NC}"
    else
        echo -e "${RED}✗ pnpm audit found vulnerabilities in $service${NC}"
        pnpm audit --audit-level=moderate
        return 1
    fi

    # Check for outdated packages
    echo "Checking for outdated packages..."
    pnpm outdated || true

    # Check for security advisories
    echo "Checking pnpm security advisories..."
    if command -v pnpx >/dev/null 2>&1; then
        pnpx audit-ci --config audit-ci.json || pnpx audit-ci --moderate || true
    fi

    cd "$PROJECT_ROOT"
    echo -e "${GREEN}Completed scanning $service${NC}"
    echo
}

# Function to generate summary report
generate_report() {
    local total_services=${#SERVICES[@]}
    local scanned_services=0
    local failed_services=0

    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Dependency Security Scan Report${NC}"
    echo -e "${BLUE}================================${NC}"
    echo "Scan completed at: $(date)"
    echo

    for service in "${SERVICES[@]}"; do
        if [ -n "$1" ] && [ "$service" != "$1" ]; then
            continue
        fi

        ((scanned_services++))

        if [ -f "/tmp/pnpm-audit-$service.json" ]; then
            vulnerabilities=$(jq '.metadata.vulnerabilities.total // 0' "/tmp/pnpm-audit-$service.json" 2>/dev/null || echo "0")
            if [ "$vulnerabilities" -gt 0 ]; then
                ((failed_services++))
                echo -e "${RED}✗ $service: $vulnerabilities vulnerabilities found${NC}"
            else
                echo -e "${GREEN}✓ $service: No vulnerabilities found${NC}"
            fi
        else
            echo -e "${YELLOW}? $service: Scan data not available${NC}"
        fi
    done

    echo
    echo "Summary:"
    echo "- Total services: $total_services"
    echo "- Scanned services: $scanned_services"
    echo "- Services with vulnerabilities: $failed_services"

    if [ $failed_services -gt 0 ]; then
        echo -e "${RED}❌ Security scan found vulnerabilities in $failed_services service(s)${NC}"
        return 1
    else
        echo -e "${GREEN}✅ All scanned services passed security checks${NC}"
        return 0
    fi
}

# Main execution
main() {
    local target_service="$1"

    echo -e "${BLUE}Starting dependency security scan...${NC}"
    echo "Project root: $PROJECT_ROOT"
    echo

    local failed=0

    if [ -n "$target_service" ]; then
        if scan_service "$target_service"; then
            echo -e "${GREEN}Scan completed successfully for $target_service${NC}"
        else
            echo -e "${RED}Scan failed for $target_service${NC}"
            failed=1
        fi
    else
        for service in "${SERVICES[@]}"; do
            if ! scan_service "$service"; then
                failed=1
            fi
        done
    fi

    generate_report "$target_service"
    return $failed
}

# Run main function
main "$@"