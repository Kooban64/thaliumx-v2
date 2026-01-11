#!/usr/bin/env node
/**
 * Create OIDC App using Personal Access Token (PAT)
 * Usage: node create-oidc-app-with-pat.js <pat_token> [project_id]
 */

const http = require('http');
const { URL } = require('url');

const ZITADEL_URL = process.env.ZITADEL_URL || process.env.ZITADEL_ISSUER || 'http://thaliumx-zitadel:8080';
const PAT_TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3] || '354966915090743309';

if (!PAT_TOKEN) {
  console.error('ERROR: Personal Access Token required');
  console.error('Usage: node create-oidc-app-with-pat.js <pat_token> [project_id]');
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
        'Host': 'localhost',  // Required for Zitadel instance resolution
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

async function main() {
  console.log('==========================================');
  console.log('Creating OIDC App using Personal Access Token');
  console.log('==========================================');
  console.log(`Zitadel URL: ${ZITADEL_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log('');

  // Step 1: Create OIDC app directly with PAT
  console.log('Step 1: Creating OIDC application...');
  const oidcAppResponse = await makeRequest(
    `${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT_TOKEN}`
      },
      body: {
        name: 'thaliumx-backend-local',
        redirectUris: ['http://localhost:3000/callback'],
        responseTypes: ['code'],
        grantTypes: ['authorization_code', 'password', 'client_credentials'],
        appType: 'web',
        authMethodType: 'client_secret_basic'
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
    console.log('Update your backend environment in docker/core/compose.yaml:');
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
    console.error(`Status: ${oidcAppResponse.status}`);
    console.error('Response:', JSON.stringify(oidcAppResponse.data, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
