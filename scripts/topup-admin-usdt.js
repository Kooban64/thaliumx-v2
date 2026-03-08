#!/usr/bin/env node

/**
 * Top up admin wallet with $2M USDT on testnet
 * 
 * This script uses the admin wallet private key to mint/transfer USDT
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const ADMIN_ADDRESS = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";
const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
const TARGET_USDT_AMOUNT = 2000000; // $2M USDT

const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount) returns (bool)",
  "function owner() view returns (address)",
  "function MINTER_ROLE() view returns (bytes32)"
];

async function main() {
  console.log("💰 Top-up Admin Wallet with $2M USDT\n");
  console.log("=".repeat(60));

  // Load admin wallet private key
  const secretsPath = path.join(__dirname, "..", ".secrets", "testnet-admin-wallet");
  if (!fs.existsSync(secretsPath)) {
    console.error("❌ Admin wallet file not found at:", secretsPath);
    process.exit(1);
  }

  const walletContent = fs.readFileSync(secretsPath, "utf-8");
  const privateKeyMatch = walletContent.match(/Private Key:\s*(0x[a-fA-F0-9]+)/);
  
  if (!privateKeyMatch) {
    console.error("❌ Could not find private key in admin wallet file");
    process.exit(1);
  }

  const privateKey = privateKeyMatch[1];
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

  console.log(`📤 Admin Wallet: ${wallet.address}`);
  
  const bnbBalance = await provider.getBalance(wallet.address);
  console.log(`💰 BNB Balance: ${ethers.formatEther(bnbBalance)} BNB\n`);

  if (parseFloat(ethers.formatEther(bnbBalance)) < 0.01) {
    console.error("❌ Insufficient BNB for gas fees. Need at least 0.01 BNB");
    console.error("   Get BNB from: https://testnet.bnbchain.org/faucet-smart");
    process.exit(1);
  }

  const decimals = await usdtContract.decimals();
  
  // Check current balance
  const currentBalance = await usdtContract.balanceOf(ADMIN_ADDRESS);
  const currentUsdt = parseFloat(ethers.formatUnits(currentBalance, decimals));
  
  console.log(`📊 Current Admin USDT Balance: ${ethers.formatUnits(currentBalance, decimals)} USDT`);
  console.log(`🎯 Target Balance: ${TARGET_USDT_AMOUNT.toLocaleString()} USDT\n`);

  if (currentUsdt >= TARGET_USDT_AMOUNT) {
    console.log("✅ Admin wallet already has sufficient USDT balance!");
    return;
  }

  const neededUsdt = TARGET_USDT_AMOUNT - currentUsdt;
  const neededAmount = ethers.parseUnits(neededUsdt.toString(), decimals);
  
  console.log(`💵 Need to add: ${neededUsdt.toLocaleString()} USDT\n`);

  // Try to mint (if contract supports it and wallet has permission)
  try {
    console.log("🔍 Checking if wallet can mint USDT...");
    
    let canMint = false;
    try {
      const owner = await usdtContract.owner();
      canMint = owner.toLowerCase() === wallet.address.toLowerCase();
      if (canMint) {
        console.log("✅ Wallet is owner - can mint\n");
      }
    } catch (e) {
      // Contract might not have owner() function - try MINTER_ROLE
      try {
        const MINTER_ROLE = await usdtContract.MINTER_ROLE();
        canMint = await usdtContract.hasRole(MINTER_ROLE, wallet.address);
        if (canMint) {
          console.log("✅ Wallet has MINTER_ROLE - can mint\n");
        }
      } catch (e2) {
        // No role-based access control
      }
    }

    if (canMint) {
      console.log(`🚀 Minting ${neededUsdt.toLocaleString()} USDT to admin wallet...`);
      const tx = await usdtContract.mint(ADMIN_ADDRESS, neededAmount);
      console.log(`📝 Transaction: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`✅ Minted! Block: ${receipt.blockNumber}\n`);
    } else {
      // Check if wallet has USDT to transfer
      const walletBalance = await usdtContract.balanceOf(wallet.address);
      const walletUsdt = parseFloat(ethers.formatUnits(walletBalance, decimals));
      
      console.log(`📊 Wallet USDT Balance: ${walletUsdt.toLocaleString()} USDT`);
      
      if (walletUsdt >= neededUsdt) {
        console.log(`🚀 Transferring ${neededUsdt.toLocaleString()} USDT to admin wallet...`);
        const tx = await usdtContract.transfer(ADMIN_ADDRESS, neededAmount);
        console.log(`📝 Transaction: ${tx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Transferred! Block: ${receipt.blockNumber}\n`);
      } else {
        console.log("❌ Cannot mint or transfer - wallet doesn't have permission or sufficient balance");
        console.log("\n💡 Options:");
        console.log("   1. The USDT contract may need to be configured to allow minting");
        console.log("   2. Get USDT from a testnet faucet");
        console.log("   3. Manually transfer USDT from another wallet");
        console.log("   4. If this is a standard ERC20, you may need to use a faucet or deployer wallet");
        return;
      }
    }

    // Verify new balance
    const newBalance = await usdtContract.balanceOf(ADMIN_ADDRESS);
    const newUsdt = parseFloat(ethers.formatUnits(newBalance, decimals));
    
    console.log("=".repeat(60));
    console.log("✅ VERIFICATION\n");
    console.log(`📊 New Admin USDT Balance: ${newUsdt.toLocaleString()} USDT`);
    console.log(`🎯 Target: ${TARGET_USDT_AMOUNT.toLocaleString()} USDT`);
    
    if (newUsdt >= TARGET_USDT_AMOUNT) {
      console.log("✅ Successfully topped up to $2M USDT!");
    } else {
      console.log(`⚠️  Still need ${(TARGET_USDT_AMOUNT - newUsdt).toLocaleString()} more USDT`);
    }

    console.log(`\n🔗 View on BscScan: https://testnet.bscscan.com/address/${ADMIN_ADDRESS}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    
    if (error.code === "CALL_EXCEPTION") {
      console.error("\n💡 The USDT contract may not support minting or the wallet doesn't have permission.");
      console.error("   For BSC Testnet USDT, you typically need to:");
      console.error("   1. Use a faucet to get testnet USDT");
      console.error("   2. Or configure the contract owner to mint tokens");
    }
    
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Top-up complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
