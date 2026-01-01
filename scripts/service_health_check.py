#!/usr/bin/env python3
"""
Service Health Check Script
Performs basic health checks on all services
"""

import requests
import time
import sys

def check_service(name, url, timeout=5):
    """Check if a service is healthy"""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            print(f"✅ {name}: Healthy")
            return True
        else:
            print(f"⚠️  {name}: Status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ {name}: Unreachable - {e}")
        return False

def main():
    print("🏥 Service Health Check")
    print("=" * 30)

    services = [
        ("Zitadel", "http://localhost:8080/healthz"),
        ("Backend", "http://localhost:3002/health"),
        ("Frontend", "http://localhost:3000/api/health"),
        ("APISIX", "http://localhost:9080/apisix/status"),
        ("Prometheus", "http://localhost:9090/-/healthy"),
        ("Grafana", "http://localhost:3001/api/health"),
    ]

    healthy_count = 0
    total_count = len(services)

    for name, url in services:
        if check_service(name, url):
            healthy_count += 1
        time.sleep(1)  # Brief pause between checks

    print(f"\n📊 Health Check Summary: {healthy_count}/{total_count} services healthy")

    if healthy_count == total_count:
        print("✅ All services are healthy!")
        return 0
    else:
        print("⚠️  Some services are not healthy")
        return 1

if __name__ == "__main__":
    sys.exit(main())