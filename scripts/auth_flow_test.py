#!/usr/bin/env python3
"""
Authentication Flow Test Script
Tests the authentication flows with Authentik
"""

import requests
import json
import sys
import time

def test_oidc_discovery():
    """Test OIDC discovery endpoint"""
    try:
        response = requests.get("http://localhost:8080/.well-known/openid-configuration", timeout=5)
        if response.status_code == 200:
            config = response.json()
            print("✅ OIDC discovery successful")
            print(f"   Issuer: {config.get('issuer', 'N/A')}")
            return True
        else:
            print(f"❌ OIDC discovery failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ OIDC discovery error: {e}")
        return False

def test_frontend_auth_page():
    """Test if frontend auth page loads"""
    try:
        response = requests.get("http://localhost:3000/auth", timeout=10)
        if response.status_code == 200:
            print("✅ Frontend auth page accessible")
            return True
        else:
            print(f"⚠️  Frontend auth page: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Frontend auth page error: {e}")
        return False

def test_backend_auth_endpoint():
    """Test backend authentication endpoint"""
    try:
        response = requests.get("http://localhost:3002/auth/status", timeout=5)
        if response.status_code in [200, 401]:  # 401 is expected for unauthenticated
            print("✅ Backend auth endpoint responsive")
            return True
        else:
            print(f"⚠️  Backend auth endpoint: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend auth endpoint error: {e}")
        return False

def main():
    print("🔐 Authentication Flow Testing")
    print("=" * 35)

    tests = [
        ("OIDC Discovery", test_oidc_discovery),
        ("Frontend Auth Page", test_frontend_auth_page),
        ("Backend Auth Endpoint", test_backend_auth_endpoint),
    ]

    passed = 0
    total = len(tests)

    for name, test_func in tests:
        print(f"\n🔍 Testing {name}...")
        if test_func():
            passed += 1
        time.sleep(1)

    print(f"\n📊 Auth Flow Test Summary: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All authentication flow tests passed!")
        return 0
    else:
        print("⚠️  Some authentication flow tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())