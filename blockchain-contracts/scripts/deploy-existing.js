const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting ThaliumX Existing Contracts Deployment...\n");

  // Load environment variables
  require('dotenv').config({ path: './testnet.env' });

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deployment configuration
  const deploymentConfig = {
    initialOwner: deployer.address,
    initialSupply: ethers.parseEther("100000000"), // 100M THAL
    maxSupply: ethers.parseEther("1000000000"), // 1B THAL
    presaleDuration: 90 * 24 * 60 * 60, // 90 days
    vestingDuration: 365 * 24 * 60 * 60, // 1 year
    bridgeFee: ethers.parseEther("10"), // 10 THAL
  };

  const deployedContracts = {};

  try {
    // 1. Deploy ThaliumToken (Core Token)
    console.log("\n📝 Deploying ThaliumToken...");
    const ThaliumToken = await ethers.getContractFactory("ThaliumToken");
    const thalToken = await ThaliumToken.deploy(
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // minter
      deploymentConfig.initialOwner, // pauser
      deploymentConfig.initialOwner, // burner
      deploymentConfig.initialSupply // initialSupply
    );
    await thalToken.waitForDeployment();
    const thalTokenAddress = await thalToken.getAddress();
    deployedContracts.ThaliumToken = thalTokenAddress;
    console.log("✅ ThaliumToken deployed to:", thalTokenAddress);

    // 2. Deploy ThaliumSecurity
    console.log("\n🔒 Deploying ThaliumSecurity...");
    const ThaliumSecurity = await ethers.getContractFactory("ThaliumSecurity");
    const thalSecurity = await ThaliumSecurity.deploy(
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // securityAdmin
      deploymentConfig.initialOwner  // complianceOfficer
    );
    await thalSecurity.waitForDeployment();
    const thalSecurityAddress = await thalSecurity.getAddress();
    deployedContracts.ThaliumSecurity = thalSecurityAddress;
    console.log("✅ ThaliumSecurity deployed to:", thalSecurityAddress);

    // 3. Deploy ThaliumOracle
    console.log("\n📊 Deploying ThaliumOracle...");
    const ThaliumOracle = await ethers.getContractFactory("ThaliumOracle");
    const thalOracle = await ThaliumOracle.deploy(
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // oracleAdmin
      deploymentConfig.initialOwner  // priceUpdater
    );
    await thalOracle.waitForDeployment();
    const thalOracleAddress = await thalOracle.getAddress();
    deployedContracts.ThaliumOracle = thalOracleAddress;
    console.log("✅ ThaliumOracle deployed to:", thalOracleAddress);

    // 4. Deploy ThaliumVesting
    console.log("\n⏰ Deploying ThaliumVesting...");
    const ThaliumVesting = await ethers.getContractFactory("ThaliumVesting");
    const thalVesting = await ThaliumVesting.deploy(
      thalTokenAddress, // thalTokenAddress
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // vestingManager
      deploymentConfig.initialOwner  // complianceOfficer
    );
    await thalVesting.waitForDeployment();
    const thalVestingAddress = await thalVesting.getAddress();
    deployedContracts.ThaliumVesting = thalVestingAddress;
    console.log("✅ ThaliumVesting deployed to:", thalVestingAddress);

    // 5. Deploy ThaliumPresale
    console.log("\n💰 Deploying ThaliumPresale...");
    const ThaliumPresale = await ethers.getContractFactory("ThaliumPresale");
    const thalPresale = await ThaliumPresale.deploy(
      "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // USDT on BSC testnet
      thalTokenAddress, // thalTokenAddress
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // presaleManager
      deploymentConfig.initialOwner  // complianceOfficer
    );
    await thalPresale.waitForDeployment();
    const thalPresaleAddress = await thalPresale.getAddress();
    deployedContracts.ThaliumPresale = thalPresaleAddress;
    console.log("✅ ThaliumPresale deployed to:", thalPresaleAddress);

    // 6. Deploy ThaliumBridge
    console.log("\n🌉 Deploying ThaliumBridge...");
    const ThaliumBridge = await ethers.getContractFactory("ThaliumBridge");
    const initialValidators = [deploymentConfig.initialOwner]; // Start with admin as validator
    const thalBridge = await ThaliumBridge.deploy(
      thalTokenAddress, // thalTokenAddress
      deploymentConfig.initialOwner, // defaultAdmin
      deploymentConfig.initialOwner, // bridgeAdmin
      initialValidators // initialValidators
    );
    await thalBridge.waitForDeployment();
    const thalBridgeAddress = await thalBridge.getAddress();
    deployedContracts.ThaliumBridge = thalBridgeAddress;
    console.log("✅ ThaliumBridge deployed to:", thalBridgeAddress);

    // 7. Configure initial settings
    console.log("\n⚙️ Configuring initial settings...");

    // Set vesting contract in presale
    await thalPresale.setVestingContract(thalVestingAddress);
    console.log("✅ Set vesting contract in presale");

    // 8. Save deployment info
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
    const deploymentFile = path.join(deploymentsDir, `bsc-testnet-existing-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Update environment file with contract addresses
    const envContent = fs.readFileSync('./testnet.env', 'utf8');
    const updatedEnvContent = envContent
      .replace('THAL_TOKEN_ADDRESS=', `THAL_TOKEN_ADDRESS=${thalTokenAddress}`)
      .replace('THAL_SECURITY_ADDRESS=', `THAL_SECURITY_ADDRESS=${thalSecurityAddress}`)
      .replace('THAL_VESTING_ADDRESS=', `THAL_VESTING_ADDRESS=${thalVestingAddress}`)
      .replace('THAL_PRESALE_ADDRESS=', `THAL_PRESALE_ADDRESS=${thalPresaleAddress}`)
      .replace('THAL_ORACLE_ADDRESS=', `THAL_ORACLE_ADDRESS=${thalOracleAddress}`)
      .replace('THAL_BRIDGE_ADDRESS=', `THAL_BRIDGE_ADDRESS=${thalBridgeAddress}`);
    
    fs.writeFileSync('./testnet.env', updatedEnvContent);

    console.log("\n🎉 Existing contracts deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("====================");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });
    console.log(`\n📄 Deployment info saved to: ${deploymentFile}`);
    console.log(`\n📄 Environment file updated: ./testnet.env`);

    // 9. Verification instructions
    console.log("\n🔍 Verification Instructions:");
    console.log("=============================");
    console.log("To verify contracts on BSCScan, run:");
    console.log("npx hardhat verify --network testnet <contract_address> <constructor_args>");
    console.log("\nExample for ThaliumToken:");
    console.log(`npx hardhat verify --network testnet ${thalTokenAddress} "${deploymentConfig.initialOwner}" "${deploymentConfig.initialOwner}" "${deploymentConfig.initialOwner}" "${deploymentConfig.initialOwner}" "${deploymentConfig.initialSupply}"`);

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
