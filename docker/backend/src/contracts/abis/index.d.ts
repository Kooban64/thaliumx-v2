/**
 * Contract ABI Loader
 *
 * Loads full ABIs from compiled contract artifacts.
 * These ABIs include all functions, events, errors, and structs.
 */
export interface ContractABI {
    abi: any[];
    contractName: string;
    sourceName: string;
}
/**
 * Load ABI from JSON artifact file
 */
export declare function loadABI(contractName: string): ContractABI | null;
/**
 * Load multiple ABIs at once
 */
export declare function loadABIs(contractNames: string[]): Map<string, ContractABI>;
/**
 * Get ABI array (for ethers.js Contract constructor)
 */
export declare function getABI(contractName: string): any[] | null;
export declare const PRESALE_ABI: any[] | null;
export declare const TOKEN_ABI: any[] | null;
export declare const VESTING_ABI: any[] | null;
export declare const DEX_ABI: any[] | null;
export declare const GOVERNANCE_ABI: any[] | null;
export declare const NFT_ABI: any[] | null;
export declare const ORACLE_ABI: any[] | null;
export declare const BRIDGE_ABI: any[] | null;
export declare const MARGIN_VAULT_ABI: any[] | null;
export declare const SECURITY_ABI: any[] | null;
export declare const EMERGENCY_CONTROLS_ABI: any[] | null;
//# sourceMappingURL=index.d.ts.map