const { ethers } = require("hardhat");

/**
 * Activate ThaliumPresale contract on testnet
 * 
 * This script:
 * 1. Checks if presale is already started
 * 2. Starts presale if not started
 * 3. Verifies activation
 */

const PRESALE_ADDRESS = "0x18D53283c23BC9fFAa3e8B03154f0C4be49de526";
const ADMIN_WALLET = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";

const PRESALE_ABI = [
  "function presaleStartTime() view returns (uint256)",
  "function presaleEndTime() view returns (uint256)",
  "function paused() view returns (bool)",
  "function isPresaleActive() view returns (bool)",
  "function startPresale(uint256) external",
  "function hasRole(bytes32, address) view returns (bool)",
];

async function activatePresale() {
  console.log("🚀 Activating ThaliumPresale on BSC Testnet\n");
  console.log("=".repeat(60));

  try {
    const [deployer] = await ethers.getSigners();
    console.log(`📤 Deployer: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} BNB\n`);

    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
      console.log("⚠️  WARNING: Low BNB balance. May need more for gas fees.");
    }

    const presaleContract = new ethers.Contract(PRESALE_ADDRESS, PRESALE_ABI, deployer);

    // Check current status
    console.log("🔍 Checking current presale status...");
    const presaleStartTime = await presaleContract.presaleStartTime();
    const isPaused = await presaleContract.paused();
    const isActive = await presaleContract.isPresaleActive();

    console.log(`   Start Time: ${presaleStartTime.toString() === "0" ? "NOT SET" : new Date(Number(presaleStartTime) * 1000).toISOString()}`);
    console.log(`   Paused: ${isPaused ? "YES" : "NO"}`);
    console.log(`   Active: ${isActive ? "YES" : "NO"}\n`);

    if (isPaused) {
      console.log("❌ Presale contract is PAUSED. Unpause first before starting.");
      process.exit(1);
    }

    if (presaleStartTime.toString() !== "0") {
      console.log("✅ Presale is already started!");
      console.log(`   Start: ${new Date(Number(presaleStartTime) * 1000).toISOString()}`);
      
      if (isActive) {
        console.log("✅ Presale is currently ACTIVE and ready for purchases.");
      } else {
        const endTime = await presaleContract.presaleEndTime();
        const now = Math.floor(Date.now() / 1000);
        if (now > Number(endTime)) {
          console.log("⏰ Presale has ended.");
        } else {
          console.log("⏳ Presale is scheduled but not yet active.");
        }
      }
      process.exit(0);
    }

    // Start presale (0 = start now)
    console.log("🚀 Starting presale (startTime = 0 means start now)...");
    const tx = await presaleContract.startPresale(0);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Presale started! Block: ${receipt.blockNumber}`);

    // Verify activation
    console.log("\n🔍 Verifying activation...");
    const newStartTime = await presaleContract.presaleStartTime();
    const newEndTime = await presaleContract.presaleEndTime();
    const newIsActive = await presaleContract.isPresaleActive();

    console.log(`✅ Start Time: ${new Date(Number(newStartTime) * 1000).toISOString()}`);
    console.log(`✅ End Time: ${new Date(Number(newEndTime) * 1000).toISOString()}`);
    console.log(`✅ Active: ${newIsActive ? "YES" : "NO"}`);

    if (newIsActive) {
      console.log("\n🎉 Presale is now ACTIVE and ready for token purchases!");
    } else {
      console.log("\n⚠️  Presale started but not yet active (may need to wait for block timestamp)");
    }

  } catch (error) {
    console.error("❌ Error activating presale:", error.message);
    
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    
    if (error.code === "CALL_EXCEPTION") {
      console.error("   This may indicate:");
      console.error("   - Contract address is incorrect");
      console.error("   - Network connection issue");
      console.error("   - Insufficient permissions (check PRESALE_MANAGER_ROLE)");
    }
    
    if (error.code === "ACTION_REJECTED") {
      console.error("   Transaction was rejected by user");
    }
    
    process.exit(1);
  }
}

activatePresale()
  .then(() => {
    console.log("\n✅ Activation complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
