#!/usr/bin/env node

/**
 * Send Testnet USDT to a wallet for testing
 * 
 * Usage:
 *   node scripts/send-testnet-usdt.js <recipient-address> [amount]
 * 
 * Example:
 *   node scripts/send-testnet-usdt.js 0x1234...abcd 1000
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// BSC Testnet Configuration
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

// USDT ABI (minimal)
const USDT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function sendTestnetUSDT(recipient, amount = "1000") {
  try {
    // Load admin wallet from secrets
    const secretsPath = path.join(__dirname, "..", ".secrets", "testnet-admin-wallet");
    if (!fs.existsSync(secretsPath)) {
      console.error("❌ Admin wallet file not found at:", secretsPath);
      console.error("   Please ensure .secrets/testnet-admin-wallet exists");
      process.exit(1);
    }

    const walletContent = fs.readFileSync(secretsPath, "utf-8");
    const privateKeyMatch = walletContent.match(/Private Key:\s*(0x[a-fA-F0-9]+)/);
    
    if (!privateKeyMatch) {
      console.error("❌ Could not find private key in admin wallet file");
      process.exit(1);
    }

    const privateKey = privateKeyMatch[1];
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

    console.log("🔍 Checking balances...");
    
    // Check admin wallet balance
    const adminBalance = await usdtContract.balanceOf(wallet.address);
    const decimals = await usdtContract.decimals();
    
    console.log(`📤 Admin Wallet: ${wallet.address}`);
    console.log(`💰 Admin USDT Balance: ${ethers.formatUnits(adminBalance, decimals)} USDT`);
    
    // Check recipient balance
    const recipientBalance = await usdtContract.balanceOf(recipient);
    console.log(`📥 Recipient: ${recipient}`);
    console.log(`💰 Recipient USDT Balance: ${ethers.formatUnits(recipientBalance, decimals)} USDT`);
    
    // Parse amount
    const amountWei = ethers.parseUnits(amount, decimals);
    
    if (adminBalance < amountWei) {
      console.error(`❌ Insufficient balance. Admin has ${ethers.formatUnits(adminBalance, decimals)} USDT, trying to send ${amount} USDT`);
      process.exit(1);
    }

    // Check BNB balance for gas
    const bnbBalance = await provider.getBalance(wallet.address);
    console.log(`⛽ BNB Balance: ${ethers.formatEther(bnbBalance)} BNB`);
    
    if (parseFloat(ethers.formatEther(bnbBalance)) < 0.001) {
      console.error("❌ Insufficient BNB for gas fees. Need at least 0.001 BNB");
      console.error("   Get BNB from: https://testnet.bnbchain.org/faucet-smart");
      process.exit(1);
    }

    console.log(`\n🚀 Sending ${amount} USDT to ${recipient}...`);
    
    // Send USDT
    const tx = await usdtContract.transfer(recipient, amountWei);
    console.log(`📝 Transaction Hash: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}`);
    
    // Verify new balances
    const newRecipientBalance = await usdtContract.balanceOf(recipient);
    console.log(`\n✅ Success! New recipient balance: ${ethers.formatUnits(newRecipientBalance, decimals)} USDT`);
    console.log(`\n🔗 View on BscScan: https://testnet.bscscan.com/tx/${tx.hash}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.error("   Insufficient USDT balance in admin wallet");
    }
    
    process.exit(1);
  }
}

// Parse command line arguments
const recipient = process.argv[2];
const amount = process.argv[3] || "1000";

if (!recipient) {
  console.error("❌ Usage: node scripts/send-testnet-usdt.js <recipient-address> [amount]");
  console.error("   Example: node scripts/send-testnet-usdt.js 0x1234...abcd 1000");
  process.exit(1);
}

// Validate address format
if (!ethers.isAddress(recipient)) {
  console.error("❌ Invalid recipient address format");
  process.exit(1);
}

sendTestnetUSDT(recipient, amount)
  .then(() => {
    console.log("\n✅ Complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
