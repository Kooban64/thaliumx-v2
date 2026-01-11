#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Zitadel Service Account and OIDC App
# This script creates a service account via init steps, then uses it to create OIDC app

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
PROJECT_ID="353322233650937880"

echo "=========================================="
echo "Bootstrap Zitadel Service Account & OIDC App"
echo "=========================================="
echo ""

# Step 1: Check if we can modify init steps to include service account creation
echo "Step 1: Checking Zitadel init steps configuration..."

INIT_STEPS_FILE=".secrets/generated/zitadel-init-steps.yaml"
if [[ -f "$INIT_STEPS_FILE" ]]; then
  echo "Found init steps file: $INIT_STEPS_FILE"
  echo "Current content:"
  cat "$INIT_STEPS_FILE"
  echo ""
  echo "Note: We can add service account creation to init steps"
  echo "But this requires restarting Zitadel, which might not be ideal"
  echo ""
fi

# Step 2: Try to create service account via Management API using a workaround
echo "Step 2: Attempting to create service account..."

# Since we can't easily authenticate, let's try using Zitadel's event store
# or create a script that uses the Management API once we have credentials

# Actually, let's create a comprehensive TypeScript/Node.js script
# that can be run to bootstrap everything

cat > docker/scripts/zitadel-bootstrap.ts <<'TYPESCRIPT'
#!/usr/bin/env ts-node
/**
 * Bootstrap Zitadel: Create Service Account and OIDC App
 * This script creates a service account, then uses it to create an OIDC app
 */

import * as https from 'https';
import * as http from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../..');
const ROOT_PASSWORD = readFileSync(join(REPO_ROOT, '.secrets/generated/zitadel-firstadmin-password'), 'utf8').trim();

const ZITADEL_URL = process.env.ZITADEL_URL || 'http://localhost:8080';
const PROJECT_ID = process.env.PROJECT_ID || '353322233650937880';
const ROOT_USERNAME = 'root@localhost';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface ServiceAccountResponse {
  userId?: string;
  details?: {
    sequence?: string;
    creationDate?: string;
    changeDate?: string;
    resourceOwner?: string;
  };
  userName?: string;
  name?: string;
  description?: string;
  accessTokenType?: string;
  expirationDate?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface OIDCAppResponse {
  appId?: string;
  details?: {
    sequence?: string;
    creationDate?: string;
    changeDate?: string;
    resourceOwner?: string;
  };
  clientId?: string;
  clientSecret?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

async function makeRequest(url: string, options: any = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode || 500, data: json });
        } catch (e) {
          resolve({ status: res.statusCode || 500, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function makeFormRequest(url: string, formData: Record<string, string>, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const body = new URLSearchParams(formData).toString();
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode || 500, data: json });
        } catch (e) {
          resolve({ status: res.statusCode || 500, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('==========================================');
  console.log('Bootstrap Zitadel Service Account & OIDC App');
  console.log('==========================================');
  console.log(`Zitadel URL: ${ZITADEL_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log('');

  // Step 1: Try to get access token using service account credentials
  // If service account doesn't exist, we need to create it first
  // But to create it, we need authentication...
  
  // For now, let's provide instructions and a script that works once
  // we have a service account
  
  console.log('Since Zitadel v2 requires a service account to use Management API,');
  console.log('and we need authentication to create a service account,');
  console.log('we have a chicken-and-egg problem.');
  console.log('');
  console.log('Solution: Create service account via init steps or use Zitadel CLI');
  console.log('');
  console.log('Once you have a service account, use this script:');
  console.log('  node docker/scripts/create-oidc-app-with-service-account.js \\');
  console.log('    <SERVICE_ACCOUNT_CLIENT_ID> \\');
  console.log('    <SERVICE_ACCOUNT_CLIENT_SECRET>');
  console.log('');
}

main().catch(console.error);

TYPESCRIPT

# Create a simpler Node.js script that works with service account
cat > docker/scripts/create-oidc-app-with-service-account.js <<'JAVASCRIPT'
#!/usr/bin/env node
/**
 * Create OIDC App using Service Account
 * Usage: node create-oidc-app-with-service-account.js <client_id> <client_secret> [project_id]
 */

const http = require('http');
const { URL, URLSearchParams } = require('url');

const ZITADEL_URL = process.env.ZITADEL_URL || 'http://localhost:8080';
const SERVICE_ACCOUNT_CLIENT_ID = process.argv[2];
const SERVICE_ACCOUNT_CLIENT_SECRET = process.argv[3];
const PROJECT_ID = process.argv[4] || '353322233650937880';

if (!SERVICE_ACCOUNT_CLIENT_ID || !SERVICE_ACCOUNT_CLIENT_SECRET) {
  console.error('ERROR: Service account credentials required');
  console.error('Usage: node create-oidc-app-with-service-account.js <client_id> <client_secret> [project_id]');
  process.exit(1);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function makeFormRequest(url, formData, authHeader) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = new URLSearchParams(formData).toString();
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': authHeader
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('==========================================');
  console.log('Creating OIDC App using Service Account');
  console.log('==========================================');
  console.log(`Zitadel URL: ${ZITADEL_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log('');

  // Step 1: Get access token
  console.log('Step 1: Getting access token using service account...');
  const auth = Buffer.from(`${SERVICE_ACCOUNT_CLIENT_ID}:${SERVICE_ACCOUNT_CLIENT_SECRET}`).toString('base64');
  
  const tokenResponse = await makeFormRequest(
    `${ZITADEL_URL}/oauth/v2/token`,
    {
      grant_type: 'client_credentials',
      scope: 'urn:zitadel:iam:org:project:id:zitadel:management'
    },
    `Basic ${auth}`
  );

  if (tokenResponse.status !== 200 || !tokenResponse.data.access_token) {
    console.error('ERROR: Failed to get access token');
    console.error('Response:', JSON.stringify(tokenResponse.data, null, 2));
    process.exit(1);
  }

  const accessToken = tokenResponse.data.access_token;
  console.log('✓ Got access token');
  console.log('');

  // Step 2: Create OIDC app
  console.log('Step 2: Creating OIDC application...');
  const oidcAppResponse = await makeRequest(
    `${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        appName: 'thaliumx-backend-local',
        redirectUris: ['http://localhost:3000/callback'],
        responseTypes: ['TOKEN'],
        grantTypes: ['PASSWORD', 'CLIENT_CREDENTIALS'],
        authMethodType: 'CLIENT_SECRET_BASIC',
        accessTokenType: 'ACCESS_TOKEN_TYPE_BEARER',
        devMode: true
      }
    }
  );

  console.log('OIDC App Creation Response:');
  console.log(JSON.stringify(oidcAppResponse.data, null, 2));
  console.log('');

  if (oidcAppResponse.status === 200 && oidcAppResponse.data.clientId) {
    const clientId = oidcAppResponse.data.clientId;
    const clientSecret = oidcAppResponse.data.clientSecret || '';

    console.log('==========================================');
    console.log('✓ OIDC App Created Successfully!');
    console.log('==========================================');
    console.log(`Client ID: ${clientId}`);
    if (clientSecret) {
      console.log(`Client Secret: ${clientSecret}`);
    }
    console.log('');
    console.log('Update your backend environment:');
    console.log(`  ZITADEL_SERVICE_ACCOUNT_ID=${clientId}`);
    if (clientSecret) {
      console.log(`  ZITADEL_SERVICE_ACCOUNT_KEY=${clientSecret}`);
    }
    console.log(`  ZITADEL_OIDC_CLIENT_ID=${clientId}`);
    if (clientSecret) {
      console.log(`  ZITADEL_OIDC_CLIENT_SECRET=${clientSecret}`);
    }
  } else {
    console.error('⚠ Failed to create OIDC app');
    console.error('Please check the response above');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

JAVASCRIPT

chmod +x docker/scripts/create-oidc-app-with-service-account.js

echo "Created TypeScript and JavaScript scripts for OIDC app creation"
echo ""
echo "Now let's create a script to bootstrap the service account via init steps..."
