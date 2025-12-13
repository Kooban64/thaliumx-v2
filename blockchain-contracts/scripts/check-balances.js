const { ethers } = require("hardhat");

async function checkBalances() {
  console.log("🔍 Checking wallet balances...\n");

  // BSC Mainnet RPC
  const mainnetProvider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org/");

  // BSC Testnet RPC
  const testnetProvider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");

  // Wallet addresses
  const mainnetWalletAddress = "0xdaef48d4e1eb0c552007c34be35b957d8140477a";
  const testnetWalletAddress = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A";

  try {
    // Check mainnet balance
    console.log("🌐 BSC MAINNET");
    console.log("📍 Address:", mainnetWalletAddress);
    const mainnetBalance = await mainnetProvider.getBalance(mainnetWalletAddress);
    console.log("💰 BNB Balance:", ethers.formatEther(mainnetBalance), "BNB");
    console.log("💵 USD Value (est.):", "~$" + (parseFloat(ethers.formatEther(mainnetBalance)) * 600).toFixed(2), "\n");

    // Check testnet balance
    console.log("🧪 BSC TESTNET");
    console.log("📍 Address:", testnetWalletAddress);
    const testnetBalance = await testnetProvider.getBalance(testnetWalletAddress);
    console.log("💰 BNB Balance:", ethers.formatEther(testnetBalance), "BNB");

    if (parseFloat(ethers.formatEther(testnetBalance)) < 0.1) {
      console.log("⚠️  LOW BALANCE - Need more BNB for contract deployments");
      console.log("💡 Recommended: Get BNB from BSC Testnet Faucet");
      console.log("🔗 https://testnet.bnbchain.org/faucet-smart");
    } else {
      console.log("✅ Sufficient balance for deployments");
    }

  } catch (error) {
    console.error("❌ Error checking balances:", error.message);
  }
}

checkBalances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });