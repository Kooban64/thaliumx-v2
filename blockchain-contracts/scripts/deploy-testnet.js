const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting ThaliumX Testnet Deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("📤 Deploying from:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployedContracts = {};

  try {
    // Get existing deployed contract addresses
    const existingAddresses = {
      ThaliumToken: "0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7",
      ThaliumSecurity: "0xF66767De6481779bdDA59733a17CB724e49B92e8",
      ThaliumDistribution: "0xf72935cEb0651E3c7157c4D8Fe680238d8814135",
      ThaliumBridge: "0x7FEC3976E42512250Cf4Ed21CEBD3E501FC82803",
      ThaliumOracle: "0x9e69bbdabC28aEa8caa10939EABDCED07827a801",
      ThaliumVesting: "0x4fE4BC41B0c52861115142BaCECE25d01A8644ff"
    };

    console.log("✅ Existing contracts loaded");

    // 1. Deploy EmergencyControls (dependency for other contracts)
    console.log("🔧 Deploying EmergencyControls...");
    const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
    const emergencyControls = await EmergencyControls.deploy(deployer.address);
    await emergencyControls.waitForDeployment();
    deployedContracts.EmergencyControls = await emergencyControls.getAddress();
    console.log("✅ EmergencyControls deployed:", deployedContracts.EmergencyControls);

    // 2. Deploy ThaliumDEX
    console.log("🔄 Deploying ThaliumDEX...");
    const ThaliumDEX = await ethers.getContractFactory("ThaliumDEX");
    const dex = await ThaliumDEX.deploy(
      existingAddresses.ThaliumToken, // THAL token address
      deployer.address, // defaultAdmin
      deployer.address, // dexAdmin
      deployer.address  // liquidityManager
    );
    await dex.waitForDeployment();
    deployedContracts.ThaliumDEX = await dex.getAddress();
    console.log("✅ ThaliumDEX deployed:", deployedContracts.ThaliumDEX);

    // 3. Deploy ThaliumNFT
    console.log("🎨 Deploying ThaliumNFT...");
    const ThaliumNFT = await ethers.getContractFactory("ThaliumNFT");
    const nft = await ThaliumNFT.deploy("ThaliumNFT", "TNFT", deployer.address);
    await nft.waitForDeployment();
    deployedContracts.ThaliumNFT = await nft.getAddress();
    console.log("✅ ThaliumNFT deployed:", deployedContracts.ThaliumNFT);

    // 4. Deploy ThaliumGovernance
    console.log("🏛️ Deploying ThaliumGovernance...");
    const ThaliumGovernance = await ethers.getContractFactory("ThaliumGovernance");
    const governance = await ThaliumGovernance.deploy(
      existingAddresses.ThaliumToken, // voting token
      deployer.address // admin
    );
    await governance.waitForDeployment();
    deployedContracts.ThaliumGovernance = await governance.getAddress();
    console.log("✅ ThaliumGovernance deployed:", deployedContracts.ThaliumGovernance);

    // 5. Deploy ThaliumMarginVault
    console.log("🏦 Deploying ThaliumMarginVault...");
    const ThaliumMarginVault = await ethers.getContractFactory("ThaliumMarginVault");
    const marginVault = await ThaliumMarginVault.deploy(
      deployer.address, // defaultAdmin
      deployer.address, // marginAdmin
      deployer.address  // riskManager
    );
    await marginVault.waitForDeployment();
    deployedContracts.ThaliumMarginVault = await marginVault.getAddress();
    console.log("✅ ThaliumMarginVault deployed:", deployedContracts.ThaliumMarginVault);

    // Save deployment results
    const deploymentData = {
      network: "testnet",
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        ...existingAddresses,
        ...deployedContracts
      }
    };

    // Save to .secrets directory
    const secretsDir = path.join(__dirname, "..", ".secrets");
    const outputFile = path.join(secretsDir, "testnet-full-deployed-contracts-addr.json");

    fs.writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));
    console.log("💾 Deployment addresses saved to:", outputFile);

    // Display summary
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("📋 Contract Addresses:");
    Object.entries(deploymentData.contracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    console.log("\n🔗 Next Steps:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Update backend services with new addresses");
    console.log("3. Run integration tests");
    console.log("4. Test complete user journeys");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  });