const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Top up admin wallet with $2M USDT on testnet
 * 
 * This script:
 * 1. Checks current USDT balance
 * 2. Mints or transfers $2M USDT to admin wallet
 * 3. Verifies the transaction
 */

const ADMIN_ADDRESS = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";
const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
const TARGET_USDT_AMOUNT = 2000000; // $2M USDT

const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount) returns (bool)",
  "function owner() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)"
];

async function main() {
  console.log("💰 Top-up Admin Wallet with $2M USDT\n");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`📤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer BNB: ${ethers.formatEther(balance)} BNB\n`);

  if (parseFloat(ethers.formatEther(balance)) < 0.01) {
    console.log("⚠️  WARNING: Low BNB balance. May need more for gas fees.");
  }

  const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, deployer);
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

  // Try to mint (if contract supports it and deployer has permission)
  try {
    console.log("🔍 Checking if deployer can mint USDT...");
    
    // Check if deployer is owner or has minter role
    let canMint = false;
    try {
      const owner = await usdtContract.owner();
      canMint = owner.toLowerCase() === deployer.address.toLowerCase();
      if (canMint) {
        console.log("✅ Deployer is owner - can mint\n");
      }
    } catch (e) {
      // Contract might not have owner() function
    }

    if (canMint) {
      console.log(`🚀 Minting ${neededUsdt.toLocaleString()} USDT to admin wallet...`);
      const tx = await usdtContract.mint(ADMIN_ADDRESS, neededAmount);
      console.log(`📝 Transaction: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`✅ Minted! Block: ${receipt.blockNumber}\n`);
    } else {
      // Try to transfer from deployer if they have USDT
      const deployerBalance = await usdtContract.balanceOf(deployer.address);
      const deployerUsdt = parseFloat(ethers.formatUnits(deployerBalance, decimals));
      
      console.log(`📊 Deployer USDT Balance: ${deployerUsdt.toLocaleString()} USDT`);
      
      if (deployerUsdt >= neededUsdt) {
        console.log(`🚀 Transferring ${neededUsdt.toLocaleString()} USDT to admin wallet...`);
        const tx = await usdtContract.transfer(ADMIN_ADDRESS, neededAmount);
        console.log(`📝 Transaction: ${tx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Transferred! Block: ${receipt.blockNumber}\n`);
      } else {
        console.log("❌ Cannot mint or transfer - deployer doesn't have permission or sufficient balance");
        console.log("\n💡 Alternative options:");
        console.log("   1. Use a USDT faucet to get testnet USDT");
        console.log("   2. Manually transfer USDT from another wallet");
        console.log("   3. If USDT contract supports it, call mint() directly from owner wallet");
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

  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    
    if (error.code === "CALL_EXCEPTION") {
      console.error("\n💡 The USDT contract may not support minting or the deployer doesn't have permission.");
      console.error("   You may need to:");
      console.error("   1. Get USDT from a testnet faucet");
      console.error("   2. Transfer from another wallet that has USDT");
      console.error("   3. Use the contract owner wallet to mint");
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
