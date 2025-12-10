/**
 * Test script for Nedbank Deposit Account Scanning
 * 
 * This script tests the connection to the Nedbank deposits API
 * and retrieves transactions from the deposit account.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

function formatNedbankDate(actionDate, actionTime) {
  if (!actionDate) return '';
  
  try {
    const year = actionDate.substring(0, 4);
    const month = actionDate.substring(4, 6);
    const day = actionDate.substring(6, 8);
    
    let timeStr = '00:00:00';
    if (actionTime) {
      const timeParts = actionTime.split(':');
      if (timeParts.length >= 3) {
        timeStr = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
      }
    }
    
    return `${year}-${month}-${day}T${timeStr}Z`;
  } catch {
    return actionDate;
  }
}

async function testNedbankDeposits() {
  console.log('='.repeat(60));
  console.log('Nedbank Deposit Account Scanning Test');
  console.log('='.repeat(60));
  
  // Load secrets
  const secretsPath = path.resolve(process.cwd(), process.env.NEDBANK_SECRETS_PATH || '.secrets/nedbank.json');
  console.log(`\nLoading secrets from: ${secretsPath}`);
  
  let secrets;
  try {
    const raw = fs.readFileSync(secretsPath, 'utf8');
    secrets = JSON.parse(raw);
    console.log('✓ Secrets loaded successfully');
    console.log(`  Environment: ${secrets.environment}`);
    console.log(`  Enabled: ${secrets.enabled}`);
    console.log(`  Account Number: ${secrets.deposits.accountNumber}`);
    console.log(`  Base URL: ${secrets.deposits.baseUrl}`);
  } catch (error) {
    console.error('✗ Failed to load secrets:', error.message);
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Testing Transactions Endpoint');
  console.log('-'.repeat(60));

  try {
    // Build the full URL
    const baseUrl = secrets.deposits.baseUrl;
    const endpoint = secrets.deposits.endpoints.transactions;
    const accountNumber = secrets.deposits.accountNumber;
    const fullUrl = `${baseUrl}${endpoint}?AccountNumber=${accountNumber}`;
    
    console.log(`\nCalling: GET ${fullUrl}`);
    console.log(`API Key: ${secrets.deposits.apiKey.substring(0, 8)}...`);
    
    const urlObj = new URL(fullUrl);
    
    const response = await makeRequest(fullUrl, {
      method: 'GET',
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secrets.deposits.apiKey
      }
    });

    console.log('\n✓ API Response received');
    console.log(`  Status: ${response.status}`);
    console.log(`  Status Text: ${response.statusText}`);
    
    if (response.data) {
      // Parse the body if it's a string
      let transactions = [];
      if (response.data.body) {
        try {
          transactions = typeof response.data.body === 'string' 
            ? JSON.parse(response.data.body) 
            : response.data.body;
        } catch (e) {
          console.error('Failed to parse body:', e.message);
        }
      } else if (Array.isArray(response.data)) {
        transactions = response.data;
      }
      
      console.log(`\n✓ Found ${transactions.length} transactions`);
      
      // Transform to our format
      const formattedTransactions = transactions.map(d => ({
        id: d.TransactionKey || '',
        amount: String(d.TransactionAmount || 0),
        currency: 'ZAR',
        reference: d.Reference || '',
        bankReference: d.TransactionKey || '',
        valueDate: formatNedbankDate(d.ActionDate, d.ActionTime),
        description: `${d.TransactionType || ''} via ${d.ChannelName || ''}`.trim(),
        channel: d.ChannelName,
        environment: d.Environment,
        currentBalance: d.CurrentBalance,
        availableBalance: d.AvailableBalance
      }));
      
      console.log('\n' + '-'.repeat(60));
      console.log('Formatted Transactions (first 5):');
      console.log('-'.repeat(60));
      
      formattedTransactions.slice(0, 5).forEach((tx, i) => {
        console.log(`\n[${i + 1}] Transaction ID: ${tx.id}`);
        console.log(`    Amount: R${tx.amount}`);
        console.log(`    Reference: ${tx.reference}`);
        console.log(`    Date: ${tx.valueDate}`);
        console.log(`    Type: ${tx.description}`);
        console.log(`    Channel: ${tx.channel}`);
        console.log(`    Balance: R${tx.currentBalance}`);
      });
      
      // Summary by reference
      console.log('\n' + '-'.repeat(60));
      console.log('Summary by Reference:');
      console.log('-'.repeat(60));
      
      const refSummary = {};
      formattedTransactions.forEach(tx => {
        if (!refSummary[tx.reference]) {
          refSummary[tx.reference] = { count: 0, total: 0 };
        }
        refSummary[tx.reference].count++;
        refSummary[tx.reference].total += parseFloat(tx.amount);
      });
      
      Object.entries(refSummary).forEach(([ref, data]) => {
        console.log(`  ${ref}: ${data.count} transactions, Total: R${data.total.toFixed(2)}`);
      });
      
      // Summary by channel
      console.log('\n' + '-'.repeat(60));
      console.log('Summary by Channel:');
      console.log('-'.repeat(60));
      
      const channelSummary = {};
      formattedTransactions.forEach(tx => {
        if (!channelSummary[tx.channel]) {
          channelSummary[tx.channel] = { count: 0, total: 0 };
        }
        channelSummary[tx.channel].count++;
        channelSummary[tx.channel].total += parseFloat(tx.amount);
      });
      
      Object.entries(channelSummary).forEach(([channel, data]) => {
        console.log(`  ${channel}: ${data.count} transactions, Total: R${data.total.toFixed(2)}`);
      });
    }
  } catch (error) {
    console.error('\n✗ API call failed');
    console.error(`  Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

// Run the test
testNedbankDeposits().catch(console.error);