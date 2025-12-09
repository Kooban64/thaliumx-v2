"use strict";
/**
 * Contract ABI Loader
 *
 * Loads full ABIs from compiled contract artifacts.
 * These ABIs include all functions, events, errors, and structs.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMERGENCY_CONTROLS_ABI = exports.SECURITY_ABI = exports.MARGIN_VAULT_ABI = exports.BRIDGE_ABI = exports.ORACLE_ABI = exports.NFT_ABI = exports.GOVERNANCE_ABI = exports.DEX_ABI = exports.VESTING_ABI = exports.TOKEN_ABI = exports.PRESALE_ABI = void 0;
exports.loadABI = loadABI;
exports.loadABIs = loadABIs;
exports.getABI = getABI;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ABIS_DIR = path.join(__dirname, './');
/**
 * Load ABI from JSON artifact file
 */
function loadABI(contractName) {
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
    }
    catch (error) {
        console.error(`Failed to load ABI for ${contractName}:`, error);
        return null;
    }
}
/**
 * Load multiple ABIs at once
 */
function loadABIs(contractNames) {
    const abis = new Map();
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
function getABI(contractName) {
    const contractABI = loadABI(contractName);
    return contractABI?.abi || null;
}
// Pre-loaded ABIs for common contracts
exports.PRESALE_ABI = getABI('ThaliumPresale');
exports.TOKEN_ABI = getABI('ThaliumToken');
exports.VESTING_ABI = getABI('ThaliumVesting');
exports.DEX_ABI = getABI('ThaliumDEX');
exports.GOVERNANCE_ABI = getABI('ThaliumGovernance');
exports.NFT_ABI = getABI('ThaliumNFT');
exports.ORACLE_ABI = getABI('ThaliumOracle');
exports.BRIDGE_ABI = getABI('ThaliumBridge');
exports.MARGIN_VAULT_ABI = getABI('ThaliumMarginVault');
exports.SECURITY_ABI = getABI('ThaliumSecurity');
exports.EMERGENCY_CONTROLS_ABI = getABI('EmergencyControls');
//# sourceMappingURL=index.js.map