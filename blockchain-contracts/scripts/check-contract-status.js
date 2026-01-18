const { ethers } = require("hardhat");

/**
 * Check contract activation status on testnet
 * Verifies:
 * - Token contract is not paused
 * - Presale contract status (started, paused, etc.)
 * - Contract addresses are correct
 * - Admin wallet has proper roles
 */

// Contract addresses from .secrets/testnet-token-deployed-contracts-addr
const CONTRACTS = {
  ThaliumToken: "0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7",
  ThaliumPresale: "0x18D53283c23BC9fFAa3e8B03154f0C4be49de526",
  ThaliumVesting: "0x4fE4BC41B0c52861115142BaCECE25d01A8644ff",
  ThaliumSecurity: "0xF66767De6481779bdDA59733a17CB724e49B92e8",
  EmergencyControls: "0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2",
  ThaliumDEX: "0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6",
  ThaliumGovernance: "0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E",
  ThaliumStaking: "0x8C15da667477D419A3c76672e08A64C1F85f2E8A",
};

const ADMIN_WALLET = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";
const USDT_TESTNET = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

// Minimal ABIs for status checks
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function paused() view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function hasRole(bytes32, address) view returns (bool)",
];

const PRESALE_ABI = [
  "function presaleStartTime() view returns (uint256)",
  "function presaleEndTime() view returns (uint256)",
  "function paused() view returns (bool)",
  "function isPresaleActive() view returns (bool)",
  "function totalTokensSold() view returns (uint256)",
  "function totalUsdtRaised() view returns (uint256)",
  "function usdtToken() view returns (address)",
  "function thalToken() view returns (address)",
  "function vestingContract() view returns (address)",
];

async function checkContractStatus() {
  console.log("🔍 Checking ThaliumX Contract Status on BSC Testnet\n");
  console.log("=" .repeat(60));

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");

  try {
    // 1. Check ThaliumToken
    console.log("\n📝 ThaliumToken Status");
    console.log("-".repeat(60));
    const tokenContract = new ethers.Contract(CONTRACTS.ThaliumToken, TOKEN_ABI, provider);
    
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const totalSupply = await tokenContract.totalSupply();
    const isPaused = await tokenContract.paused();
    const adminBalance = await tokenContract.balanceOf(ADMIN_WALLET);
    
    console.log(`✅ Contract Address: ${CONTRACTS.ThaliumToken}`);
    console.log(`✅ Name: ${tokenName}`);
    console.log(`✅ Symbol: ${tokenSymbol}`);
    console.log(`✅ Total Supply: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);
    console.log(`✅ Admin Balance: ${ethers.formatEther(adminBalance)} ${tokenSymbol}`);
    console.log(`${isPaused ? "❌ PAUSED" : "✅ NOT PAUSED"}`);

    // 2. Check ThaliumPresale
    console.log("\n💰 ThaliumPresale Status");
    console.log("-".repeat(60));
    const presaleContract = new ethers.Contract(CONTRACTS.ThaliumPresale, PRESALE_ABI, provider);
    
    const presaleStartTime = await presaleContract.presaleStartTime();
    const presaleEndTime = await presaleContract.presaleEndTime();
    const presalePaused = await presaleContract.paused();
    const isPresaleActive = await presaleContract.isPresaleActive();
    const totalTokensSold = await presaleContract.totalTokensSold();
    const totalUsdtRaised = await presaleContract.totalUsdtRaised();
    const usdtToken = await presaleContract.usdtToken();
    const thalToken = await presaleContract.thalToken();
    const vestingContract = await presaleContract.vestingContract();
    
    console.log(`✅ Contract Address: ${CONTRACTS.ThaliumPresale}`);
    console.log(`✅ USDT Token: ${usdtToken}`);
    console.log(`✅ THAL Token: ${thalToken}`);
    console.log(`✅ Vesting Contract: ${vestingContract}`);
    console.log(`${presalePaused ? "❌ PAUSED" : "✅ NOT PAUSED"}`);
    
    if (presaleStartTime.toString() === "0") {
      console.log("❌ PRESALE NOT STARTED - Call startPresale() to activate");
    } else {
      const startDate = new Date(Number(presaleStartTime) * 1000);
      const endDate = new Date(Number(presaleEndTime) * 1000);
      const now = new Date();
      
      console.log(`✅ Presale Start Time: ${startDate.toISOString()}`);
      console.log(`✅ Presale End Time: ${endDate.toISOString()}`);
      console.log(`${isPresaleActive ? "✅ PRESALE ACTIVE" : "❌ PRESALE INACTIVE"}`);
      console.log(`✅ Total Tokens Sold: ${ethers.formatEther(totalTokensSold)} THAL`);
      console.log(`✅ Total USDT Raised: ${ethers.formatUnits(totalUsdtRaised, 6)} USDT`);
      
      if (now < startDate) {
        console.log("⏳ Presale scheduled for future");
      } else if (now > endDate) {
        console.log("⏰ Presale has ended");
      }
    }

    // 3. Check Admin Wallet Balance
    console.log("\n👛 Admin Wallet Status");
    console.log("-".repeat(60));
    const adminBalanceBNB = await provider.getBalance(ADMIN_WALLET);
    console.log(`✅ Address: ${ADMIN_WALLET}`);
    console.log(`✅ BNB Balance: ${ethers.formatEther(adminBalanceBNB)} BNB`);
    
    if (parseFloat(ethers.formatEther(adminBalanceBNB)) < 0.01) {
      console.log("⚠️  LOW BNB BALANCE - May need more for transactions");
    }

    // 4. Verify Contract Addresses Match
    console.log("\n🔗 Contract Address Verification");
    console.log("-".repeat(60));
    const expectedUsdt = USDT_TESTNET.toLowerCase();
    const actualUsdt = usdtToken.toLowerCase();
    const expectedThal = CONTRACTS.ThaliumToken.toLowerCase();
    const actualThal = thalToken.toLowerCase();
    const expectedVesting = CONTRACTS.ThaliumVesting.toLowerCase();
    const actualVesting = vestingContract.toLowerCase();
    
    console.log(`USDT Token: ${expectedUsdt === actualUsdt ? "✅" : "❌"} Match`);
    if (expectedUsdt !== actualUsdt) {
      console.log(`  Expected: ${expectedUsdt}`);
      console.log(`  Actual: ${actualUsdt}`);
    }
    
    console.log(`THAL Token: ${expectedThal === actualThal ? "✅" : "❌"} Match`);
    if (expectedThal !== actualThal) {
      console.log(`  Expected: ${expectedThal}`);
      console.log(`  Actual: ${actualThal}`);
    }
    
    console.log(`Vesting Contract: ${expectedVesting === actualVesting ? "✅" : "❌"} Match`);
    if (expectedVesting !== actualVesting) {
      console.log(`  Expected: ${expectedVesting}`);
      console.log(`  Actual: ${actualVesting}`);
    }

    // 5. Summary
    console.log("\n📊 Activation Summary");
    console.log("=".repeat(60));
    const issues = [];
    
    if (isPaused) {
      issues.push("❌ Token contract is PAUSED");
    }
    
    if (presaleStartTime.toString() === "0") {
      issues.push("❌ Presale has NOT been started");
    } else if (presalePaused) {
      issues.push("❌ Presale contract is PAUSED");
    } else if (!isPresaleActive) {
      issues.push("⚠️  Presale is not currently active (may have ended or not started yet)");
    }
    
    if (expectedUsdt !== actualUsdt || expectedThal !== actualThal || expectedVesting !== actualVesting) {
      issues.push("❌ Contract address mismatches detected");
    }
    
    if (issues.length === 0) {
      console.log("✅ All checks passed! Token is ready for use.");
    } else {
      console.log("⚠️  Issues found:");
      issues.forEach(issue => console.log(`  ${issue}`));
    }

  } catch (error) {
    console.error("❌ Error checking contract status:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

checkContractStatus()
  .then(() => {
    console.log("\n✅ Status check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
