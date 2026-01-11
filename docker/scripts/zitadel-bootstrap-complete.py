#!/usr/bin/env python3
"""
Complete Zitadel Bootstrap Script
Creates service account and OIDC app programmatically
"""

import requests
import json
import sys
import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
ROOT_PASSWORD_FILE = REPO_ROOT / ".secrets" / "generated" / "zitadel-firstadmin-password"

ZITADEL_URL = os.getenv("ZITADEL_URL", "http://localhost:8080")
PROJECT_ID = os.getenv("PROJECT_ID", "353322233650937880")
ROOT_USERNAME = "root@localhost"

def get_root_password():
    """Read root password from file"""
    if not ROOT_PASSWORD_FILE.exists():
        raise FileNotFoundError(f"Root password file not found: {ROOT_PASSWORD_FILE}")
    return ROOT_PASSWORD_FILE.read_text().strip()

def get_access_token_with_password():
    """Try to get access token using password grant"""
    root_password = get_root_password()
    
    # Try with default Zitadel client
    data = {
        "grant_type": "password",
        "client_id": "353322236855189528@zitadel",
        "username": ROOT_USERNAME,
        "password": root_password,
        "scope": "openid profile email urn:zitadel:iam:org:project:id:zitadel:aud"
    }
    
    response = requests.post(
        f"{ZITADEL_URL}/oauth/v2/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        return response.json().get("access_token")
    else:
        print(f"Password grant failed: {response.status_code} - {response.text}")
        return None

def create_service_account(access_token):
    """Create a service account using Management API"""
    url = f"{ZITADEL_URL}/management/v1/users/machine"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    data = {
        "userName": "thaliumx-backend-service",
        "name": "ThaliumX Backend Service Account",
        "description": "Service account for backend API authentication"
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to create service account: {response.status_code} - {response.text}")
        return None

def generate_service_account_secret(access_token, user_id):
    """Generate client secret for service account"""
    url = f"{ZITADEL_URL}/management/v1/users/machine/{user_id}/secret"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    data = {
        "expirationDate": "2099-12-31T23:59:59Z"
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to generate secret: {response.status_code} - {response.text}")
        return None

def get_access_token_with_service_account(client_id, client_secret):
    """Get access token using service account (client credentials)"""
    auth = (client_id, client_secret)
    data = {
        "grant_type": "client_credentials",
        "scope": "urn:zitadel:iam:org:project:id:zitadel:management"
    }
    
    response = requests.post(
        f"{ZITADEL_URL}/oauth/v2/token",
        auth=auth,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        return response.json().get("access_token")
    else:
        print(f"Failed to get token with service account: {response.status_code} - {response.text}")
        return None

def create_oidc_app(access_token, project_id):
    """Create OIDC application"""
    url = f"{ZITADEL_URL}/management/v1/projects/{project_id}/apps/oidc"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    data = {
        "appName": "thaliumx-backend-local",
        "redirectUris": ["http://localhost:3000/callback"],
        "responseTypes": ["TOKEN"],
        "grantTypes": ["PASSWORD", "CLIENT_CREDENTIALS"],
        "authMethodType": "CLIENT_SECRET_BASIC",
        "accessTokenType": "ACCESS_TOKEN_TYPE_BEARER",
        "devMode": True
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to create OIDC app: {response.status_code} - {response.text}")
        return None

def main():
    print("=" * 50)
    print("Zitadel Bootstrap - Complete Setup")
    print("=" * 50)
    print(f"Zitadel URL: {ZITADEL_URL}")
    print(f"Project ID: {PROJECT_ID}")
    print()
    
    # Step 1: Try to get access token with root user
    print("Step 1: Attempting to authenticate with root user...")
    root_token = get_access_token_with_password()
    
    if not root_token:
        print("⚠ Password grant not available")
        print()
        print("Since we can't authenticate programmatically, you have two options:")
        print()
        print("Option 1: Use Zitadel CLI")
        print("  Download: https://github.com/zitadel/zitadel/releases")
        print("  Login: zitadelctl login --instance http://localhost:8080")
        print("  Create service account: zitadelctl user machine create ...")
        print()
        print("Option 2: Provide service account credentials")
        print("  If you already have a service account, run:")
        print("  python3 docker/scripts/zitadel-bootstrap-complete.py <client_id> <client_secret>")
        print()
        return 1
    
    print("✓ Authenticated with root user")
    print()
    
    # Step 2: Create service account
    print("Step 2: Creating service account...")
    service_account = create_service_account(root_token)
    
    if not service_account:
        print("Failed to create service account")
        return 1
    
    user_id = service_account.get("userId")
    print(f"✓ Service account created: {user_id}")
    print()
    
    # Step 3: Generate client secret
    print("Step 3: Generating client secret...")
    secret_response = generate_service_account_secret(root_token, user_id)
    
    if not secret_response:
        print("Failed to generate client secret")
        return 1
    
    client_id = secret_response.get("clientId")
    client_secret = secret_response.get("clientSecret")
    print(f"✓ Client secret generated")
    print(f"  Client ID: {client_id}")
    print(f"  Client Secret: {client_secret}")
    print()
    
    # Step 4: Get access token with service account
    print("Step 4: Getting access token with service account...")
    service_token = get_access_token_with_service_account(client_id, client_secret)
    
    if not service_token:
        print("Failed to get token with service account")
        return 1
    
    print("✓ Got access token with service account")
    print()
    
    # Step 5: Create OIDC app
    print("Step 5: Creating OIDC application...")
    oidc_app = create_oidc_app(service_token, PROJECT_ID)
    
    if not oidc_app:
        print("Failed to create OIDC app")
        return 1
    
    oidc_client_id = oidc_app.get("clientId")
    oidc_client_secret = oidc_app.get("clientSecret", "")
    
    print("=" * 50)
    print("✓ OIDC App Created Successfully!")
    print("=" * 50)
    print(f"OIDC Client ID: {oidc_client_id}")
    if oidc_client_secret:
        print(f"OIDC Client Secret: {oidc_client_secret}")
    print()
    print("Update your backend environment:")
    print(f"  ZITADEL_SERVICE_ACCOUNT_ID={oidc_client_id}")
    if oidc_client_secret:
        print(f"  ZITADEL_SERVICE_ACCOUNT_KEY={oidc_client_secret}")
    print(f"  ZITADEL_OIDC_CLIENT_ID={oidc_client_id}")
    if oidc_client_secret:
        print(f"  ZITADEL_OIDC_CLIENT_SECRET={oidc_client_secret}")
    print()
    
    return 0

if __name__ == "__main__":
    # If service account credentials are provided as arguments, use them directly
    if len(sys.argv) >= 3:
        client_id = sys.argv[1]
        client_secret = sys.argv[2]
        project_id = sys.argv[3] if len(sys.argv) > 3 else PROJECT_ID
        
        print("Using provided service account credentials...")
        service_token = get_access_token_with_service_account(client_id, client_secret)
        if service_token:
            oidc_app = create_oidc_app(service_token, project_id)
            if oidc_app:
                print(json.dumps(oidc_app, indent=2))
                sys.exit(0)
        sys.exit(1)
    else:
        sys.exit(main())
