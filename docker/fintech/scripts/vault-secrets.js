#!/usr/bin/env node
/**
 * Vault Secrets Fetcher for Ballerine
 * Fetches secrets from HashiCorp Vault and outputs them as shell export statements
 */

const http = require('http');
const https = require('https');

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://thaliumx-vault:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN;
const VAULT_SECRET_PATH = process.env.VAULT_SECRET_PATH || 'kv/data/fintech/ballerine';

if (!VAULT_TOKEN) {
  console.error('ERROR: VAULT_TOKEN environment variable is required');
  process.exit(1);
}

const url = new URL(`/v1/${VAULT_SECRET_PATH}`, VAULT_ADDR);
const client = url.protocol === 'https:' ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'GET',
  headers: {
    'X-Vault-Token': VAULT_TOKEN
  }
};

const req = client.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`ERROR: Vault returned status ${res.statusCode}`);
      console.error(data);
      process.exit(1);
    }
    
    try {
      const response = JSON.parse(data);
      const secrets = response.data?.data || {};
      
      // Output secrets as shell export statements
      // BCRYPT_SALT must be a full bcrypt salt string like $2b$12$...
      if (secrets.bcrypt_salt) {
        console.log(`export BCRYPT_SALT='${secrets.bcrypt_salt}'`);
      }
      if (secrets.session_secret) {
        console.log(`export SESSION_SECRET='${secrets.session_secret}'`);
      }
      if (secrets.api_key) {
        console.log(`export API_KEY='${secrets.api_key}'`);
      }
      if (secrets.hashing_key_secret) {
        console.log(`export HASHING_KEY_SECRET='${secrets.hashing_key_secret}'`);
      }
      if (secrets.webhook_secret) {
        console.log(`export WEBHOOK_SECRET='${secrets.webhook_secret}'`);
      }
      if (secrets.magic_link_jwt_secret) {
        console.log(`export MAGIC_LINK_JWT_SECRET='${secrets.magic_link_jwt_secret}'`);
      }
      if (secrets.magic_link_auth_jwt_secret) {
        console.log(`export MAGIC_LINK_AUTH_JWT_SECRET='${secrets.magic_link_auth_jwt_secret}'`);
      }
      if (secrets.notion_api_key) {
        console.log(`export NOTION_API_KEY='${secrets.notion_api_key}'`);
      }
      if (secrets.jwt_secret_key) {
        console.log(`export JWT_SECRET_KEY='${secrets.jwt_secret_key}'`);
      }
      if (secrets.db_password) {
        // Build database URL
        const dbUser = process.env.DB_USER || 'ballerine';
        const dbHost = process.env.DB_HOST || 'thaliumx-ballerine-postgres';
        const dbPort = process.env.DB_PORT || '5432';
        const dbName = process.env.DB_NAME || 'ballerine';
        console.log(`export DB_URL='postgresql://${dbUser}:${secrets.db_password}@${dbHost}:${dbPort}/${dbName}?schema=public'`);
      }
      
    } catch (e) {
      console.error('ERROR: Failed to parse Vault response');
      console.error(e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`ERROR: Failed to connect to Vault: ${e.message}`);
  process.exit(1);
});

req.end();