#!/usr/bin/env node
/**
 * Create OIDC App using Service Account
 * Usage: node create-oidc-app-with-service-account.js <client_id> <client_secret> [project_id]
 */

const http = require('http');
const { URL, URLSearchParams } = require('url');

const ZITADEL_URL = process.env.ZITADEL_URL || process.env.ZITADEL_ISSUER || 'http://thaliumx-zitadel:8080';
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
        'Host': 'localhost',  // Required for Zitadel instance resolution
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
