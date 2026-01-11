#!/usr/bin/env node
/**
 * Create Service Account in Zitadel using Node.js
 * This runs from backend container to bypass localhost/APISIX issues
 */

const http = require('http');
const { URL, URLSearchParams } = require('url');

const ZITADEL_URL = process.env.ZITADEL_URL || 'http://thaliumx-zitadel:8080';
const ROOT_USERNAME = 'root@localhost';
const ROOT_PASSWORD = process.argv[2] || 'Aa1!30ad3716f234d05666ef744b178e';

function makeRequest(url, options = {}) {
  return makeRequestWithHost(url, options);
}

function makeRequestWithHost(url, options = {}) {
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

function makeFormRequest(url, formData) {
  return makeFormRequestWithHost(url, formData);
}

function makeFormRequestWithHost(url, formData, hostHeader) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = new URLSearchParams(formData).toString();
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    };
    if (hostHeader) {
      headers['Host'] = hostHeader;
    }
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: headers
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
  console.log('='.repeat(60));
  console.log('Create Service Account via Backend Container');
  console.log('='.repeat(60));
  console.log(`Zitadel URL: ${ZITADEL_URL}`);
  console.log();

  // Step 1: Try to authenticate
  console.log('Step 1: Attempting to authenticate...');
  // Need to set Host header to match Zitadel's configured domain
  const tokenResponse = await makeFormRequestWithHost(
    `${ZITADEL_URL}/oauth/v2/token`,
    {
      grant_type: 'password',
      client_id: '353322236855189528@zitadel',
      username: ROOT_USERNAME,
      password: ROOT_PASSWORD,
      scope: 'openid profile email urn:zitadel:iam:org:project:id:zitadel:aud'
    },
    'localhost'  // Set Host header to localhost
  );

  if (tokenResponse.status !== 200 || !tokenResponse.data.access_token) {
    console.log(`✗ Authentication failed: ${tokenResponse.status}`);
    console.log(`  ${JSON.stringify(tokenResponse.data)}`);
    console.log();
    console.log('Password grant not available. Need alternative method.');
    console.log();
    console.log('Since you cannot access Zitadel console, here are options:');
    console.log();
    console.log('Option 1: SSH port forwarding');
    console.log('  ssh -L 8080:localhost:8080 user@server');
    console.log('  Then access http://localhost:8080');
    console.log();
    console.log('Option 2: Use backend container as proxy');
    console.log('  docker exec -it thaliumx-backend sh');
    console.log('  Then access Zitadel from inside');
    console.log();
    console.log('Option 3: Create service account via database (advanced)');
    console.log('  This requires direct database access');
    process.exit(1);
  }

  const accessToken = tokenResponse.data.access_token;
  console.log('✓ Authenticated!');
  console.log();

  // Step 2: Create service account
  console.log('Step 2: Creating service account...');
  const saResponse = await makeRequestWithHost(
    `${ZITADEL_URL}/management/v1/users/machine`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Host': 'localhost'
      },
      body: {
        userName: 'thaliumx-backend-service',
        name: 'ThaliumX Backend Service Account',
        description: 'Service account for backend API authentication'
      }
    }
  );

  if (saResponse.status !== 200 || !saResponse.data.userId) {
    console.log(`✗ Failed: ${saResponse.status}`);
    console.log(`  ${JSON.stringify(saResponse.data)}`);
    process.exit(1);
  }

  const userId = saResponse.data.userId;
  console.log(`✓ Service account created! User ID: ${userId}`);
  console.log();

  // Step 3: Generate client secret
  console.log('Step 3: Generating client secret...');
  const secretResponse = await makeRequestWithHost(
    `${ZITADEL_URL}/management/v1/users/machine/${userId}/secret`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Host': 'localhost'
      },
      body: {
        expirationDate: '2099-12-31T23:59:59Z'
      }
    }
  );

  if (secretResponse.status !== 200 || !secretResponse.data.clientId) {
    console.log(`✗ Failed: ${secretResponse.status}`);
    console.log(`  ${JSON.stringify(secretResponse.data)}`);
    process.exit(1);
  }

  const clientId = secretResponse.data.clientId;
  const clientSecret = secretResponse.data.clientSecret;

  console.log('='.repeat(60));
  console.log('✓ SUCCESS! Service Account Created!');
  console.log('='.repeat(60));
  console.log(`Client ID: ${clientId}`);
  console.log(`Client Secret: ${clientSecret}`);
  console.log();
  console.log('Now create OIDC app:');
  console.log(`  node docker/scripts/create-oidc-app-with-service-account.js \\`);
  console.log(`    ${clientId} \\`);
  console.log(`    ${clientSecret}`);
  console.log();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
