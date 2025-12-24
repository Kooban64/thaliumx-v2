#!/bin/bash

# ===========================================
# ThaliumX Runtime Security Monitor
# ===========================================
# Monitors running containers for security issues
# Checks for root processes, exposed secrets, misconfigurations
#
# Usage:
#   ./runtime-security-monitor.sh
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if container is running as root
check_root_processes() {
    local container="$1"
    echo -e "${BLUE}Checking root processes in $container...${NC}"

    # Get the user running the main process
    local user_info
    user_info=$(docker exec "$container" ps -o user,pid,comm --no-headers | head -1 2>/dev/null || echo "")

    if [ -z "$user_info" ]; then
        echo -e "${YELLOW}Warning: Could not check processes in $container${NC}"
        return 0
    fi

    local user
    user=$(echo "$user_info" | awk '{print $1}')

    if [ "$user" = "root" ]; then
        echo -e "${RED}⚠️  WARNING: $container is running processes as root${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $container processes are not running as root${NC}"
        return 0
    fi
}

# Function to check for exposed environment variables
check_exposed_secrets() {
    local container="$1"
    echo -e "${BLUE}Checking for exposed secrets in $container...${NC}"

    # Get environment variables
    local env_vars
    env_vars=$(docker exec "$container" env 2>/dev/null | grep -E "(PASSWORD|SECRET|KEY|TOKEN)" | head -10 || echo "")

    if [ -n "$env_vars" ]; then
        echo -e "${RED}⚠️  WARNING: $container has potentially sensitive environment variables:${NC}"
        echo "$env_vars" | sed 's/^/    /'
        return 1
    else
        echo -e "${GREEN}✓ No obvious secrets found in $container environment${NC}"
        return 0
    fi
}

# Function to check container capabilities
check_capabilities() {
    local container="$1"
    echo -e "${BLUE}Checking capabilities for $container...${NC}"

    # Get container info
    local cap_info
    cap_info=$(docker inspect "$container" --format='{{.HostConfig.CapAdd}} {{.HostConfig.Privileged}}' 2>/dev/null || echo "")

    if echo "$cap_info" | grep -q "privileged"; then
        echo -e "${RED}⚠️  WARNING: $container is running in privileged mode${NC}"
        return 1
    fi

    if echo "$cap_info" | grep -q "IPC_LOCK\|NET_ADMIN\|SYS_ADMIN"; then
        echo -e "${YELLOW}⚠️  WARNING: $container has elevated capabilities${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ $container has standard capabilities${NC}"
    return 0
}

# Function to check for outdated images
check_image_age() {
    local container="$1"
    echo -e "${BLUE}Checking image age for $container...${NC}"

    # Get image creation date
    local created
    created=$(docker inspect "$container" --format='{{.Created}}' 2>/dev/null | head -1 || echo "")

    if [ -z "$created" ]; then
        echo -e "${YELLOW}Warning: Could not get creation date for $container${NC}"
        return 0
    fi

    # Calculate age in days
    local created_epoch
    created_epoch=$(date -d "$created" +%s 2>/dev/null || echo "0")
    local now_epoch
    now_epoch=$(date +%s)
    local age_days=$(( (now_epoch - created_epoch) / 86400 ))

    if [ $age_days -gt 90 ]; then
        echo -e "${YELLOW}⚠️  WARNING: $container image is $age_days days old${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $container image is $age_days days old${NC}"
        return 0
    fi
}

# Function to check network exposure
check_network_exposure() {
    local container="$1"
    echo -e "${BLUE}Checking network exposure for $container...${NC}"

    # Get port mappings
    local ports
    ports=$(docker port "$container" 2>/dev/null | head -5 || echo "")

    if [ -n "$ports" ]; then
        echo -e "${BLUE}Container exposes ports:${NC}"
        echo "$ports" | sed 's/^/    /'
    else
        echo -e "${GREEN}✓ $container does not expose ports to host${NC}"
    fi

    return 0
}

# Function to check container health
check_container_health() {
    local container="$1"
    echo -e "${BLUE}Checking health status of $container...${NC}"

    # Get health status
    local health
    health=$(docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

    case "$health" in
        "healthy")
            echo -e "${GREEN}✓ $container is healthy${NC}"
            return 0
            ;;
        "unhealthy")
            echo -e "${RED}✗ $container is unhealthy${NC}"
            return 1
            ;;
        "starting")
            echo -e "${YELLOW}⚠️  $container is still starting${NC}"
            return 0
            ;;
        *)
            echo -e "${YELLOW}? $container health status: $health${NC}"
            return 0
            ;;
    esac
}

# Main function
main() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Runtime Security Monitor${NC}"
    echo -e "${BLUE}================================${NC}"
    echo "Scan started at: $(date)"
    echo

    # Get all thaliumx containers
    local containers
    containers=$(docker ps --filter "name=thaliumx-" --format "{{.Names}}" 2>/dev/null || echo "")

    if [ -z "$containers" ]; then
        echo -e "${YELLOW}No ThaliumX containers found running${NC}"
        exit 0
    fi

    local total_containers=0
    local issues_found=0

    while IFS= read -r container; do
        [ -z "$container" ] && continue

        ((total_containers++))
        echo -e "${BLUE}----------------------------------------${NC}"
        echo -e "${BLUE}Analyzing: $container${NC}"
        echo -e "${BLUE}----------------------------------------${NC}"

        # Run all checks
        if ! check_container_health "$container"; then
            ((issues_found++))
        fi

        if ! check_root_processes "$container"; then
            ((issues_found++))
        fi

        if ! check_exposed_secrets "$container"; then
            ((issues_found++))
        fi

        if ! check_capabilities "$container"; then
            ((issues_found++))
        fi

        if ! check_image_age "$container"; then
            ((issues_found++))
        fi

        check_network_exposure "$container"

        echo
    done <<< "$containers"

    # Summary
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Security Scan Summary${NC}"
    echo -e "${BLUE}================================${NC}"
    echo "Total containers analyzed: $total_containers"
    echo "Security issues found: $issues_found"

    if [ $issues_found -gt 0 ]; then
        echo -e "${RED}❌ Security issues detected. Review the warnings above.${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ All containers passed security checks.${NC}"
        exit 0
    fi
}

# Run main function
main "$@"