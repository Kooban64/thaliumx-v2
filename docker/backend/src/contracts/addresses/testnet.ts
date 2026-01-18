/**
 * Testnet Contract Addresses
 * 
 * These addresses are from the BSC Testnet deployment.
 * For mainnet, update this file with mainnet addresses.
 */

export const TESTNET_ADDRESSES = {
  // Core Token Contracts
  THAL_TOKEN: '0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7',
  THALIUM_PRESALE: '0x18D53283c23BC9fFAa3e8B03154f0C4be49de526',
  THALIUM_VESTING: '0x4fE4BC41B0c52861115142BaCECE25d01A8644ff',
  
  // DeFi Contracts
  THALIUM_DEX: '0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6',
  THALIUM_GOVERNANCE: '0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E',
  THALIUM_STAKING: '0x8C15da667477D419A3c76672e08A64C1F85f2E8A',
  
  // Infrastructure
  USDT_TOKEN: process.env.USDT_TOKEN_ADDRESS || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // BSC Testnet USDT address
  
  // Security Contracts
  THALIUM_SECURITY: process.env.THALIUM_SECURITY_ADDRESS || '0xF66767De6481779bdDA59733a17CB724e49B92e8', // ThaliumSecurity contract
  EMERGENCY_CONTROLS: process.env.EMERGENCY_CONTROLS_ADDRESS || '0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2', // EmergencyControls contract
  
  // Admin Wallet
  ADMIN_WALLET: '0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A',
} as const;

export const MAINNET_ADDRESSES = {
  // Core Token Contracts
  THAL_TOKEN: process.env.MAINNET_THAL_TOKEN || '',
  THALIUM_PRESALE: process.env.MAINNET_PRESALE || '',
  THALIUM_VESTING: process.env.MAINNET_VESTING || '',
  
  // DeFi Contracts
  THALIUM_DEX: process.env.MAINNET_DEX || '',
  THALIUM_GOVERNANCE: process.env.MAINNET_GOVERNANCE || '',
  THALIUM_STAKING: process.env.MAINNET_STAKING || '',
  
  // Infrastructure
  USDT_TOKEN: process.env.MAINNET_USDT_TOKEN || '',
  
  // Security Contracts
  THALIUM_SECURITY: process.env.MAINNET_THALIUM_SECURITY || '',
  EMERGENCY_CONTROLS: process.env.MAINNET_EMERGENCY_CONTROLS || '',
  
  // Admin Wallet
  ADMIN_WALLET: process.env.MAINNET_ADMIN_WALLET || '',
} as const;

export function getContractAddresses() {
  const network = process.env.NETWORK || 'testnet';
  return network === 'mainnet' ? MAINNET_ADDRESSES : TESTNET_ADDRESSES;
}

