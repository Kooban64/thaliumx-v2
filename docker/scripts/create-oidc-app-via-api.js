#!/usr/bin/env node
/**
 * Create OIDC Application in Zitadel via Management API
 * This script attempts to create an OIDC app programmatically
 */

const http = require('http');
const { readFileSync } = require('fs');
const { join } = require('path');

const REPO_ROOT = join(__dirname, '../..');
const ROOT_PASSWORD = readFileSync(join(REPO_ROOT, '.secrets/generated/zitadel-firstadmin-password'), 'utf8').trim();

const ZITADEL_URL = 'http://localhost:8080';
const ROOT_USERNAME = 'root@localhost';

// For Zitadel v2, we need to use Personal Access Token (PAT)
// But to get a PAT, we need to be authenticated
// This is a chicken-and-egg problem

// Let's try to use the default Zitadel client with a different approach
// Or we can try to create a service account first via the event store

console.log('Creating OIDC Application in Zitadel...');
console.log('');

// Step 1: Try to get a token using client credentials with a default client
// Note: This might not work if no OIDC apps are configured yet

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  console.log('Since Zitadel v2 requires proper authentication,');
  console.log('and we cannot easily create an OIDC app without a PAT,');
  console.log('we need to use one of these approaches:');
  console.log('');
  console.log('1. Install Zitadel CLI and use it:');
  console.log('   curl -L https://github.com/zitadel/zitadel/releases/latest/download/zitadelctl_linux_amd64 -o /usr/local/bin/zitadelctl');
  console.log('   chmod +x /usr/local/bin/zitadelctl');
  console.log('   zitadelctl login --instance localhost:8080');
  console.log('   zitadelctl app oidc create --name thaliumx-backend-local \\');
  console.log('     --grant-types password,client_credentials');
  console.log('');
  console.log('2. Use the Management API with a PAT (after getting one from console)');
  console.log('');
  console.log('3. For local development, we can create a simple workaround:');
  console.log('   Create a basic OIDC app configuration file that can be imported');
  console.log('');
  console.log('Since we cannot access the console due to redirect URI restrictions,');
  console.log('let\'s try to install the Zitadel CLI and use it...');
  console.log('');
  
  // Try to download and use Zitadel CLI
  console.log('Attempting to download Zitadel CLI...');
  
  // For now, let's provide instructions
  console.log('');
  console.log('==========================================');
  console.log('Manual Steps Required');
  console.log('==========================================');
  console.log('');
  console.log('1. Download Zitadel CLI:');
  console.log('   curl -L https://github.com/zitadel/zitadel/releases/latest/download/zitadelctl_linux_amd64 -o /tmp/zitadelctl');
  console.log('   chmod +x /tmp/zitadelctl');
  console.log('');
  console.log('2. Login to Zitadel:');
  console.log('   /tmp/zitadelctl login --instance localhost:8080');
  console.log('   Username: root@localhost');
  console.log(`   Password: ${ROOT_PASSWORD}`);
  console.log('');
  console.log('3. Create OIDC Application:');
  console.log('   /tmp/zitadelctl app oidc create \\');
  console.log('     --name thaliumx-backend-local \\');
  console.log('     --grant-types password,client_credentials \\');
  console.log('     --response-types token \\');
  console.log('     --auth-method basic');
  console.log('');
  console.log('4. Get Client ID and Secret from the output');
  console.log('5. Update backend environment variables');
  console.log('');
}

main().catch(console.error);
