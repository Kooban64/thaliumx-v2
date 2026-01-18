/**
 * Test Backend Contract Connectivity
 * 
 * This script verifies that the backend can connect to all deployed contracts
 * and read their status. Run this from the backend directory.
 */

const { ethers } = require("ethers");

// Contract addresses from testnet.ts
const CONTRACTS = {
  THAL_TOKEN: "0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7",
  THALIUM_PRESALE: "0x18D53283c23BC9fFAa3e8B03154f0C4be49de526",
  THALIUM_VESTING: "0x4fE4BC41B0c52861115142BaCECE25d01A8644ff",
  THALIUM_SECURITY: "0xF66767De6481779bdDA59733a17CB724e49B92e8",
  EMERGENCY_CONTROLS: "0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2",
  THALIUM_DEX: "0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6",
  THALIUM_GOVERNANCE: "0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E",
  THALIUM_STAKING: "0x8C15da667477D419A3c76672e08A64C1F85f2E8A",
  USDT_TOKEN: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
};

const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/";

// Minimal ABIs for connectivity tests
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function paused() view returns (bool)",
];

const PRESALE_ABI = [
  "function presaleStartTime() view returns (uint256)",
  "function paused() view returns (bool)",
  "function isPresaleActive() view returns (bool)",
];

async function testConnectivity() {
  console.log("🔍 Testing Backend Contract Connectivity\n");
  console.log("=".repeat(60));
  console.log(`RPC URL: ${RPC_URL}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const results = {
    connected: [],
    failed: [],
  };

  // Test RPC connection
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ RPC Connection: Connected (Block: ${blockNumber})\n`);
  } catch (error) {
    console.error(`❌ RPC Connection Failed: ${error.message}`);
    process.exit(1);
  }

  // Test each contract
  for (const [name, address] of Object.entries(CONTRACTS)) {
    try {
      console.log(`Testing ${name}...`);
      
      // Check if address is a contract
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log(`  ❌ Not a contract (no code at address)`);
        results.failed.push({ name, address, error: "Not a contract" });
        continue;
      }

      // Try to read from contract based on type
      if (name === "THAL_TOKEN" || name === "USDT_TOKEN") {
        const contract = new ethers.Contract(address, TOKEN_ABI, provider);
        const tokenName = await contract.name();
        const symbol = await contract.symbol();
        const totalSupply = await contract.totalSupply();
        console.log(`  ✅ Connected: ${tokenName} (${symbol})`);
        console.log(`     Total Supply: ${ethers.formatEther(totalSupply)}`);
        
        if (name === "THAL_TOKEN") {
          const isPaused = await contract.paused();
          console.log(`     Paused: ${isPaused ? "YES" : "NO"}`);
        }
      } else if (name === "THALIUM_PRESALE") {
        const contract = new ethers.Contract(address, PRESALE_ABI, provider);
        const startTime = await contract.presaleStartTime();
        const isPaused = await contract.paused();
        const isActive = await contract.isPresaleActive();
        console.log(`  ✅ Connected: ThaliumPresale`);
        console.log(`     Started: ${startTime.toString() !== "0" ? "YES" : "NO"}`);
        console.log(`     Paused: ${isPaused ? "YES" : "NO"}`);
        console.log(`     Active: ${isActive ? "YES" : "NO"}`);
      } else {
        // Generic contract check
        const codeSize = (code.length - 2) / 2; // bytes
        console.log(`  ✅ Contract detected (${codeSize} bytes)`);
      }

      results.connected.push({ name, address });
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      results.failed.push({ name, address, error: error.message });
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Connectivity Summary");
  console.log("=".repeat(60));
  console.log(`✅ Connected: ${results.connected.length}/${Object.keys(CONTRACTS).length}`);
  console.log(`❌ Failed: ${results.failed.length}/${Object.keys(CONTRACTS).length}\n`);

  if (results.failed.length > 0) {
    console.log("Failed Contracts:");
    results.failed.forEach(({ name, address, error }) => {
      console.log(`  - ${name} (${address}): ${error}`);
    });
    console.log();
  }

  if (results.connected.length === Object.keys(CONTRACTS).length) {
    console.log("✅ All contracts are accessible!");
    return 0;
  } else {
    console.log("⚠️  Some contracts could not be accessed");
    return 1;
  }
}

testConnectivity()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
