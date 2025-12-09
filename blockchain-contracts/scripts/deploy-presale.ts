import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying ThaliumPresale contract...');

  // Contract addresses
  const USDT_TESTNET = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'; // BSC Testnet USDT
  const THAL_TOKEN = '0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7';
  const ADMIN_WALLET = '0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A';

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy contract
  const ThaliumPresale = await ethers.getContractFactory('ThaliumPresale');
  const presale = await ThaliumPresale.deploy(
    USDT_TESTNET,      // usdtTokenAddress
    THAL_TOKEN,        // thalTokenAddress
    ADMIN_WALLET,      // defaultAdmin
    ADMIN_WALLET,      // presaleManager
    ADMIN_WALLET       // complianceOfficer
  );

  await presale.waitForDeployment();
  const presaleAddress = await presale.getAddress();
  console.log('ThaliumPresale deployed to:', presaleAddress);

  // Set vesting contract
  console.log('Setting vesting contract...');
  const VESTING_CONTRACT = '0x4fE4BC41B0c52861115142BaCECE25d01A8644ff';
  const tx = await presale.setVestingContract(VESTING_CONTRACT);
  await tx.wait();
  console.log('Vesting contract set successfully');

  // Verify deployment
  console.log('\nDeployment Summary:');
  console.log('===================');
  console.log('Contract Address:', presaleAddress);
  console.log('USDT Token:', await presale.usdtToken());
  console.log('THAL Token:', await presale.thalToken());
  console.log('Vesting Contract:', await presale.vestingContract());
  console.log('Min Purchase:', (await presale.MIN_PURCHASE()).toString());
  console.log('Max Purchase:', (await presale.MAX_PURCHASE()).toString());
  console.log('Presale Duration:', (await presale.PRESALE_DURATION()).toString());

  console.log('\n✅ Deployment complete!');
  console.log('📝 Update .secrets/testnet-token-deployed-contracts-addr with:');
  console.log(`ThaliumPresale: ${presaleAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });