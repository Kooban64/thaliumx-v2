const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting ThaliumX Smart Contracts Deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deployment configuration
  const deploymentConfig = {
    initialOwner: deployer.address,
    initialBackend: deployer.address, // Will be updated to actual backend address
    initialFeeRecipient: deployer.address,
    initialSupply: ethers.parseEther("100000000"), // 100M THAL
    maxSupply: ethers.parseEther("1000000000"), // 1B THAL
  };

  const deployedContracts = {};

  try {
    // 1. Deploy THAL Token
    console.log("\n📝 Deploying THAL Token...");
    const THAL = await ethers.getContractFactory("THAL");
    const thal = await upgrades.deployProxy(THAL, [
      deploymentConfig.initialOwner,
      deploymentConfig.initialBackend,
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await thal.waitForDeployment();
    const thalAddress = await thal.getAddress();
    deployedContracts.THAL = thalAddress;
    console.log("✅ THAL Token deployed to:", thalAddress);

    // 2. Deploy ThaliumNFT
    console.log("\n🎨 Deploying ThaliumNFT...");
    const ThaliumNFT = await ethers.getContractFactory("ThaliumNFT");
    const nft = await upgrades.deployProxy(ThaliumNFT, [
      "ThaliumX NFT Collection",
      "THALNFT",
      deploymentConfig.initialOwner,
      deploymentConfig.initialBackend,
      "https://api.thaliumx.com/nft/metadata/",
      "https://api.thaliumx.com/nft/contract-metadata.json",
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    deployedContracts.ThaliumNFT = nftAddress;
    console.log("✅ ThaliumNFT deployed to:", nftAddress);

    // 3. Deploy ThaliumDEX
    console.log("\n💱 Deploying ThaliumDEX...");
    const ThaliumDEX = await ethers.getContractFactory("ThaliumDEX");
    const dex = await upgrades.deployProxy(ThaliumDEX, [
      deploymentConfig.initialOwner,
      deploymentConfig.initialBackend,
      deploymentConfig.initialFeeRecipient,
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await dex.waitForDeployment();
    const dexAddress = await dex.getAddress();
    deployedContracts.ThaliumDEX = dexAddress;
    console.log("✅ ThaliumDEX deployed to:", dexAddress);

    // 4. Deploy MarginVault
    console.log("\n📊 Deploying MarginVault...");
    const MarginVault = await ethers.getContractFactory("MarginVault");
    const marginVault = await upgrades.deployProxy(MarginVault, [
      deploymentConfig.initialOwner,
      deploymentConfig.initialBackend,
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await marginVault.waitForDeployment();
    const marginVaultAddress = await marginVault.getAddress();
    deployedContracts.MarginVault = marginVaultAddress;
    console.log("✅ MarginVault deployed to:", marginVaultAddress);

    // 5. Deploy EmergencyControls
    console.log("\n🚨 Deploying EmergencyControls...");
    const EmergencyControls = await ethers.getContractFactory("EmergencyControls");
    const emergencyControls = await upgrades.deployProxy(EmergencyControls, [
      deploymentConfig.initialOwner,
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await emergencyControls.waitForDeployment();
    const emergencyControlsAddress = await emergencyControls.getAddress();
    deployedContracts.EmergencyControls = emergencyControlsAddress;
    console.log("✅ EmergencyControls deployed to:", emergencyControlsAddress);

    // 6. Deploy TimelockController (for governance)
    console.log("\n⏰ Deploying TimelockController...");
    const TimelockController = await ethers.getContractFactory("TimelockController");
    const timelock = await TimelockController.deploy(
      2 * 24 * 60 * 60, // 2 days delay
      [deploymentConfig.initialOwner], // proposers
      [deploymentConfig.initialOwner], // executors
      deployer.address // admin
    );
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    deployedContracts.TimelockController = timelockAddress;
    console.log("✅ TimelockController deployed to:", timelockAddress);

    // 7. Deploy ThaliumGovernance
    console.log("\n🗳️ Deploying ThaliumGovernance...");
    const ThaliumGovernance = await ethers.getContractFactory("ThaliumGovernance");
    const governance = await upgrades.deployProxy(ThaliumGovernance, [
      "ThaliumX Governance",
      thalAddress, // voting token
      timelockAddress, // timelock
      deploymentConfig.initialOwner,
      deploymentConfig.initialBackend,
      ethers.parseEther("10000"), // 10k THAL proposal threshold
      1, // 1 block voting delay
      5760, // 1 day voting period
      4, // 4% quorum
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    deployedContracts.ThaliumGovernance = governanceAddress;
    console.log("✅ ThaliumGovernance deployed to:", governanceAddress);

    // 8. Configure initial settings
    console.log("\n⚙️ Configuring initial settings...");

    // Add THAL as supported token in DEX
    await dex.addSupportedToken(thalAddress);
    console.log("✅ Added THAL as supported token in DEX");

    // Add THAL as supported asset in MarginVault
    await marginVault.addSupportedAsset(thalAddress);
    console.log("✅ Added THAL as supported asset in MarginVault");

    // Create initial circuit breakers
    await emergencyControls.createCircuitBreaker(
      "daily_volume",
      ethers.parseEther("1000000"), // 1M THAL daily volume limit
      24 * 60 * 60 // 24 hour cooldown
    );
    console.log("✅ Created daily volume circuit breaker");

    await emergencyControls.createCircuitBreaker(
      "liquidity_ratio",
      ethers.parseEther("100000"), // 100k THAL liquidity ratio limit
      60 * 60 // 1 hour cooldown
    );
    console.log("✅ Created liquidity ratio circuit breaker");

    // 9. Save deployment info
    const deploymentInfo = {
      network: await ethers.provider.getNetwork(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      config: deploymentConfig,
    };

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save deployment info
    const networkName = (await ethers.provider.getNetwork()).name;
    const deploymentFile = path.join(deploymentsDir, `${networkName}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("====================");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });
    console.log(`\n📄 Deployment info saved to: ${deploymentFile}`);

    // 10. Verification instructions
    console.log("\n🔍 Verification Instructions:");
    console.log("=============================");
    console.log("To verify contracts on Etherscan, run:");
    console.log("npx hardhat verify --network <network> <contract_address> <constructor_args>");
    console.log("\nExample:");
    console.log(`npx hardhat verify --network ${networkName} ${thalAddress}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
