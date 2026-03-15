import { ethers } from 'ethers';

declare const hre: {
  ethers: typeof import('ethers') & {
    getSigners: () => Promise<Array<{ address: string; provider: { getBalance: (address: string) => Promise<bigint> } }>>;
    getContractFactory: (name: string) => Promise<{
      deploy: (...args: unknown[]) => Promise<{
        waitForDeployment: () => Promise<void>;
        getAddress: () => Promise<string>;
        setVestingContract: (address: string) => Promise<{ wait: () => Promise<void> }>;
        usdtToken: () => Promise<string>;
        thalToken: () => Promise<string>;
        vestingContract: () => Promise<string>;
        MIN_PURCHASE: () => Promise<bigint>;
        MAX_PURCHASE: () => Promise<bigint>;
        PRESALE_DURATION: () => Promise<bigint>;
      }>;
    }>;
  };
};

const { ethers: hardhatEthers } = hre;

async function main() {
  console.log('Deploying ThaliumPresale contract...');

  // Contract addresses
  const USDT_TESTNET = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'; // BSC Testnet USDT
  const THAL_TOKEN = '0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7';
  const ADMIN_WALLET = '0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A';

  // Get deployer
  const [deployer] = await hardhatEthers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy contract
  const ThaliumPresale = await hardhatEthers.getContractFactory('ThaliumPresale');
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
