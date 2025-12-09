/**
 * Contract ABI Loader
 * 
 * Loads full ABIs from compiled contract artifacts.
 * These ABIs include all functions, events, errors, and structs.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ContractABI {
  abi: any[];
  contractName: string;
  sourceName: string;
}

const ABIS_DIR = path.join(__dirname, './');

/**
 * Load ABI from JSON artifact file
 */
export function loadABI(contractName: string): ContractABI | null {
  try {
    const abiPath = path.join(ABIS_DIR, `${contractName}.json`);
    
    if (!fs.existsSync(abiPath)) {
      console.warn(`ABI file not found: ${abiPath}`);
      return null;
    }
    
    const fileContent = fs.readFileSync(abiPath, 'utf-8');
    const artifact = JSON.parse(fileContent);
    
    return {
      abi: artifact.abi || [],
      contractName: artifact.contractName || contractName,
      sourceName: artifact.sourceName || ''
    };
  } catch (error) {
    console.error(`Failed to load ABI for ${contractName}:`, error);
    return null;
  }
}

/**
 * Load multiple ABIs at once
 */
export function loadABIs(contractNames: string[]): Map<string, ContractABI> {
  const abis = new Map<string, ContractABI>();
  
  for (const name of contractNames) {
    const abi = loadABI(name);
    if (abi) {
      abis.set(name, abi);
    }
  }
  
  return abis;
}

/**
 * Get ABI array (for ethers.js Contract constructor)
 */
export function getABI(contractName: string): any[] | null {
  const contractABI = loadABI(contractName);
  return contractABI?.abi || null;
}

// Pre-loaded ABIs for common contracts
export const PRESALE_ABI = getABI('ThaliumPresale');
export const TOKEN_ABI = getABI('ThaliumToken');
export const VESTING_ABI = getABI('ThaliumVesting');
export const DEX_ABI = getABI('ThaliumDEX');
export const GOVERNANCE_ABI = getABI('ThaliumGovernance');
export const NFT_ABI = getABI('ThaliumNFT');
export const ORACLE_ABI = getABI('ThaliumOracle');
export const BRIDGE_ABI = getABI('ThaliumBridge');
export const MARGIN_VAULT_ABI = getABI('ThaliumMarginVault');
export const SECURITY_ABI = getABI('ThaliumSecurity');
export const EMERGENCY_CONTROLS_ABI = getABI('EmergencyControls');

