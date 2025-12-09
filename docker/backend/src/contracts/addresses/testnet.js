"use strict";
/**
 * Testnet Contract Addresses
 *
 * These addresses are from the BSC Testnet deployment.
 * For mainnet, update this file with mainnet addresses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAINNET_ADDRESSES = exports.TESTNET_ADDRESSES = void 0;
exports.getContractAddresses = getContractAddresses;
exports.TESTNET_ADDRESSES = {
    // Core Token Contracts
    THAL_TOKEN: '0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7',
    THALIUM_PRESALE: '0x18D53283c23BC9fFAa3e8B03154f0C4be49de526',
    THALIUM_VESTING: '0x4fE4BC41B0c52861115142BaCECE25d01A8644ff',
    // DeFi Contracts
    THALIUM_DEX: '0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6',
    THALIUM_GOVERNANCE: '0x...', // Update when deployed
    THALIUM_STAKING: '0x...', // Update when deployed
    // Infrastructure
    USDT_TOKEN: process.env.USDT_TOKEN_ADDRESS || '', // BSC Testnet USDT address
    // Admin Wallet
    ADMIN_WALLET: '0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A',
};
exports.MAINNET_ADDRESSES = {
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
    // Admin Wallet
    ADMIN_WALLET: process.env.MAINNET_ADMIN_WALLET || '',
};
function getContractAddresses() {
    const network = process.env.NETWORK || 'testnet';
    return network === 'mainnet' ? exports.MAINNET_ADDRESSES : exports.TESTNET_ADDRESSES;
}
//# sourceMappingURL=testnet.js.map