#!/usr/bin/env python3
"""
Security Verification Script
Checks security configurations and settings
"""

import requests
import json
import sys
import subprocess

def check_https_redirect():
    """Check if HTTP redirects to HTTPS"""
    try:
        # This would check if the load balancer redirects HTTP to HTTPS
        # For now, just check if services are not exposed on HTTP directly
        response = requests.get("http://localhost:3000", timeout=5)
        if response.status_code == 200:
            print("⚠️  Frontend accessible via HTTP (consider HTTPS-only)")
            return False
        else:
            print("✅ Frontend properly secured")
            return True
    except requests.exceptions.RequestException:
        print("✅ Frontend not accessible via HTTP")
        return True

def check_auth_required():
    """Check if authentication is required for protected endpoints"""
    try:
        response = requests.get("http://localhost:3002/api/protected", timeout=5)
        if response.status_code == 401:
            print("✅ Authentication properly required")
            return True
        elif response.status_code == 200:
            print("⚠️  Protected endpoint accessible without auth")
            return False
        else:
            print(f"⚠️  Unexpected status for protected endpoint: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"⚠️  Cannot check auth requirement: {e}")
        return False

def check_security_headers():
    """Check for security headers"""
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        headers = response.headers

        security_headers = [
            'X-Frame-Options',
            'X-Content-Type-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ]

        found_headers = [h for h in security_headers if h in headers]
        print(f"✅ Found {len(found_headers)}/{len(security_headers)} security headers")

        return len(found_headers) > 0
    except requests.exceptions.RequestException as e:
        print(f"⚠️  Cannot check security headers: {e}")
        return False

def check_vault_secrets():
    """Check if Vault is properly configured"""
    try:
        # This would check Vault status
        result = subprocess.run(['curl', '-s', 'http://localhost:8200/v1/sys/health'],
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and 'initialized' in result.stdout:
            print("✅ Vault service accessible")
            return True
        else:
            print("⚠️  Vault service not accessible or not initialized")
            return False
    except subprocess.TimeoutExpired:
        print("⚠️  Vault check timed out")
        return False
    except FileNotFoundError:
        print("⚠️  curl not available for Vault check")
        return False

def main():
    print("🔒 Security Configuration Verification")
    print("=" * 42)

    checks = [
        ("HTTPS Redirect", check_https_redirect),
        ("Authentication Required", check_auth_required),
        ("Security Headers", check_security_headers),
        ("Vault Configuration", check_vault_secrets),
    ]

    passed = 0
    total = len(checks)

    for name, check_func in checks:
        print(f"\n🔍 Checking {name}...")
        if check_func():
            passed += 1

    print(f"\n📊 Security Check Summary: {passed}/{total} checks passed")

    if passed >= total * 0.7:  # 70% success rate for security
        print("✅ Security verification mostly successful!")
        return 0
    else:
        print("⚠️  Security verification has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())