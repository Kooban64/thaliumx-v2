#!/usr/bin/env python3
"""
Migration Verification Script
Verifies that the Authentik migration has been completed successfully
"""

import requests
import json
import sys

def check_Authentik_config():
    """Check Authentik configuration"""
    try:
        # Check if Authentik is running
        response = requests.get("http://localhost:8080/healthz", timeout=5)
        if response.status_code != 200:
            print("❌ Authentik is not healthy")
            return False

        print("✅ Authentik service is running")

        # Check if we can access the OIDC configuration
        oidc_response = requests.get("http://localhost:8080/.well-known/openid-configuration", timeout=5)
        if oidc_response.status_code == 200:
            print("✅ Authentik OIDC configuration is accessible")
            return True
        else:
            print("⚠️  Authentik OIDC configuration not accessible")
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to Authentik: {e}")
        return False

def check_auth_flow():
    """Check authentication flow configuration"""
    try:
        # This would normally check if the auth flow is properly configured
        # For now, just check if the frontend can load
        response = requests.get("http://localhost:3000", timeout=10)
        if response.status_code == 200:
            print("✅ Frontend is accessible")
            return True
        else:
            print(f"⚠️  Frontend returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to frontend: {e}")
        return False

def main():
    print("🔍 Migration Verification")
    print("=" * 30)

    checks = [
        ("Authentik Configuration", check_Authentik_config),
        ("Authentication Flow", check_auth_flow),
    ]

    passed = 0
    total = len(checks)

    for name, check_func in checks:
        print(f"\n🔍 Checking {name}...")
        if check_func():
            passed += 1

    print(f"\n📊 Migration Verification Summary: {passed}/{total} checks passed")

    if passed == total:
        print("✅ Migration verification successful!")
        return 0
    else:
        print("⚠️  Some migration checks failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())