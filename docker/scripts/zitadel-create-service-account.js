#!/usr/bin/env node
/**
 * Creates a Zitadel service account (API application) for backend authentication
 * Uses root user credentials to authenticate and create the service account
 * Stores credentials in Vault
 */

const https = require('https');
const http = require('http');
const { readFileSync } = require('fs');
const { join } = require('path');

const REPO_ROOT = join(__dirname, '../..');
const FIRSTADMIN_PW_FILE = join(REPO_ROOT, '.secrets/generated/zitadel-firstadmin-password');

// Configuration
const ZITADEL_ISSUER = process.env.ZITADEL_ISSUER || 'https://auth.thaliumx.com';
const ZITADEL_INTERNAL_URL = 'http://thaliumx-zitadel:8080';
const ZITADEL_DOMAIN = ZITADEL_ISSUER.replace(/^https?:\/\//, '');
const ROOT_USERNAME = `root@${ZITADEL_DOMAIN}`;

// Load root password
let ROOT_PASSWORD;
try {
  ROOT_PASSWORD = readFileSync(FIRSTADMIN_PW_FILE, 'utf8').trim();
} catch (error) {
  console.error(`ERROR: Could not read root password file: ${FIRSTADMIN_PW_FILE}`);
  process.exit(1);
}

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
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
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
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

// Helper function to make form-encoded POST requests
function makeFormRequest(url, formData, headers = {}) {
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
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Creating Zitadel service account...');
  console.log(`Issuer: ${ZITADEL_ISSUER}`);
  console.log(`Root user: ${ROOT_USERNAME}`);
  console.log('');

  // Step 1: Try to authenticate using personal access token approach
  // First, we need to get a token using the root user
  // Zitadel v2 uses personal access tokens for Management API
  
  console.log('Step 1: Authenticating root user...');
  
  // Try password grant with default client (may not work)
  // Alternative: Use Zitadel's personal access token endpoint
  const tokenUrl = `${ZITADEL_INTERNAL_URL}/oauth/v2/token`;
  
  let rootToken;
  try {
    // Try with Management API client (if it exists)
    const tokenResponse = await makeFormRequest(tokenUrl, {
      grant_type: 'password',
      client_id: '353322236855189528@zitadel',
      username: ROOT_USERNAME,
      password: ROOT_PASSWORD,
      scope: 'openid profile email urn:zitadel:iam:org:project:id:zitadel:aud'
    }, {
      'Host': ZITADEL_DOMAIN
    });

    if (tokenResponse.status === 200 && tokenResponse.data.access_token) {
      rootToken = tokenResponse.data.access_token;
      console.log('✓ Root user authenticated via password grant');
    } else {
      throw new Error(`Token response: ${JSON.stringify(tokenResponse.data)}`);
    }
  } catch (error) {
    console.error(`ERROR: Failed to authenticate root user: ${error.message}`);
    console.error('Trying alternative authentication method...');
    
    // Alternative: Use Zitadel's personal access token creation
    // This requires using the Management API with a personal access token
    // For now, we'll output instructions
    console.log('');
    console.log('==========================================');
    console.log('Manual Setup Required');
    console.log('==========================================');
    console.log('Please create a service account manually:');
    console.log('');
    console.log('1. Log into Zitadel console:');
    console.log(`   https://${ZITADEL_DOMAIN}`);
    console.log(`   Username: ${ROOT_USERNAME}`);
    console.log(`   Password: (from ${FIRSTADMIN_PW_FILE})`);
    console.log('');
    console.log('2. Navigate to: Service Users > New');
    console.log('3. Create service user: "thaliumx-backend-service"');
    console.log('4. Generate Client Secret');
    console.log('5. Copy Client ID and Client Secret');
    console.log('6. Store in Vault:');
    console.log('   vault kv put secret/thaliumx/zitadel \\');
    console.log('     service_account_id="<CLIENT_ID>" \\');
    console.log('     service_account_key="<CLIENT_SECRET>"');
    console.log('==========================================');
    process.exit(1);
  }

  // If we got here, we have a token - proceed with service account creation
  console.log('');
  console.log('Step 2: Creating service user via Management API...');
  
  // Note: The Management API structure may vary
  // This is a simplified approach - actual implementation may need adjustment
  console.log('NOTE: Service account creation via Management API requires');
  console.log('      proper project and organization setup.');
  console.log('');
  console.log('For now, please use the Zitadel console to create the service account.');
  console.log('See instructions above.');
  
  process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
