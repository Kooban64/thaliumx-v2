const { ethers } = require("hardhat");

/**
 * Check testnet admin wallet balances
 */

const ADMIN_ADDRESS = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";
const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
const THAL_TOKEN_ADDRESS = "0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7";

const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];

const THAL_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];

async function main() {
  console.log("🔍 Checking Testnet Admin Wallet Balances\n");
  console.log("=".repeat(60));
  console.log(`📤 Wallet Address: ${ADMIN_ADDRESS}\n");

  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;

  // Check BNB balance
  const bnbBalance = await provider.getBalance(ADMIN_ADDRESS);
  console.log(`💰 BNB Balance: ${ethers.formatEther(bnbBalance)} BNB`);
  console.log(`   ($${(parseFloat(ethers.formatEther(bnbBalance)) * 600).toFixed(2)} USD @ $600/BNB)\n`);

  // Check USDT balance
  const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
  const usdtDecimals = await usdtContract.decimals();
  const usdtBalance = await usdtContract.balanceOf(ADMIN_ADDRESS);
  const usdtTotalSupply = await usdtContract.totalSupply();
  
  console.log(`💵 USDT Balance: ${ethers.formatUnits(usdtBalance, usdtDecimals)} USDT`);
  console.log(`   ($${parseFloat(ethers.formatUnits(usdtBalance, usdtDecimals)).toLocaleString()} USD)\n`);
  console.log(`📊 USDT Total Supply: ${ethers.formatUnits(usdtTotalSupply, usdtDecimals)} USDT\n`);

  // Check THAL token balance
  const thalContract = new ethers.Contract(THAL_TOKEN_ADDRESS, THAL_ABI, provider);
  const thalDecimals = await thalContract.decimals();
  const thalBalance = await thalContract.balanceOf(ADMIN_ADDRESS);
  const thalTotalSupply = await thalContract.totalSupply();
  
  console.log(`🪙 THAL Token Balance: ${ethers.formatEther(thalBalance)} THAL`);
  console.log(`   ($${(parseFloat(ethers.formatEther(thalBalance)) * 0.10).toFixed(2)} USD @ $0.10/THAL)\n`);
  console.log(`📊 THAL Total Supply: ${ethers.formatEther(thalTotalSupply)} THAL\n`);

  // Summary
  console.log("=".repeat(60));
  console.log("📊 SUMMARY\n");
  
  const bnbValue = parseFloat(ethers.formatEther(bnbBalance)) * 600;
  const usdtValue = parseFloat(ethers.formatUnits(usdtBalance, usdtDecimals));
  const thalValue = parseFloat(ethers.formatEther(thalBalance)) * 0.10;
  const totalValue = bnbValue + usdtValue + thalValue;
  
  console.log(`Total Portfolio Value: $${totalValue.toLocaleString(2)} USD`);
  console.log(`  - BNB: $${bnbValue.toFixed(2)}`);
  console.log(`  - USDT: $${usdtValue.toLocaleString(2)}`);
  console.log(`  - THAL: $${thalValue.toFixed(2)}\n`);

  // Check if we need to top up
  const targetUsdt = 2000000; // $2M USDT
  const currentUsdt = parseFloat(ethers.formatUnits(usdtBalance, usdtDecimals));
  const neededUsdt = targetUsdt - currentUsdt;
  
  if (neededUsdt > 0) {
    console.log("⚠️  TOP-UP NEEDED");
    console.log(`   Current USDT: $${currentUsdt.toLocaleString(2)}`);
    console.log(`   Target USDT: $${targetUsdt.toLocaleString(2)}`);
    console.log(`   Needed: $${neededUsdt.toLocaleString(2)} USDT\n`);
  } else {
    console.log("✅ Wallet has sufficient USDT balance\n");
  }
}

main()
  .then(() => {
    console.log("✅ Balance check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
