# 🏦 ThaliumX Smart Contracts - Deployment Registry

**Last Updated**: October 14, 2025
**Network**: BSC Testnet
**Total Contracts**: 11
**Deployed**: 11 of 11
**Pending**: 0 ✅ ALL DEPLOYED

---

## 📍 TESTNET DEPLOYMENT (BSC Testnet)

### **Admin Wallet**
- **Address**: `0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A`
- **Network**: BSC Testnet
- **Purpose**: Contract deployment and administration
- **⚠️ WARNING**: Testnet wallet only - Generate new secure wallet for mainnet

---

## 📋 DEPLOYED CONTRACTS

### **1. Core Token Contracts**

#### **ThaliumToken** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumToken.sol`
- **Address**: `0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7)
- **Features**:
  - ERC20 with Permit (gasless approvals)
  - ERC20Votes (governance capabilities)
  - AccessControl (role-based permissions)
  - Pausable (emergency controls)
  - Max Supply: 1,000,000,000 THAL
- **Roles**:
  - `MINTER_ROLE`: Can mint new tokens
  - `BURNER_ROLE`: Can burn tokens
  - `PAUSER_ROLE`: Can pause transfers
  - `DEFAULT_ADMIN_ROLE`: Full administrative control

#### **ThaliumPresale** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumPresale.sol`
- **Address**: `0x18D53283c23BC9fFAa3e8B03154f0C4be49de526`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x18D53283c23BC9fFAa3e8B03154f0C4be49de526)
- **Status**: ✅ **DEPLOYED** - Ready for public token sales
- **Features**:
  - USDT-only payments
  - Min Purchase: 100 USDT
  - Max Purchase: 10,000 USDT per user
  - Duration: 90 days
  - Rate: 1 USDT = 100 THAL
  - Vesting integration
  - Emergency pause controls
- **Deployment Parameters**:
  - `usdtToken`: [BSC Testnet USDT Address - TBD]
  - `thalToken`: `0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7`
  - `defaultAdmin`: `0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A`
  - `presaleManager`: `0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A`
  - `complianceOfficer`: `0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A`
- **✅ VESTING INTEGRATION**: Fixed - now properly calls ThaliumVesting.createVestingSchedule()
- **Roles**:
  - `PRESALE_MANAGER_ROLE`: Start/manage presale
  - `COMPLIANCE_ROLE`: Compliance operations
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

#### **ThaliumVesting** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumVesting.sol`
- **Address**: `0x4fE4BC41B0c52861115142BaCECE25d01A8644ff`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x4fE4BC41B0c52861115142BaCECE25d01A8644ff)
- **Features**:
  - Linear vesting with cliff period
  - Revocable schedules
  - 24-hour claim cooldown
  - Min Duration: 30 days
  - Max Duration: 4 years (1,460 days)
  - Category-based organization
- **Roles**:
  - `VESTING_MANAGER_ROLE`: Create/revoke vesting schedules
  - `COMPLIANCE_ROLE`: Compliance operations
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

---

### **2. DeFi Contracts**

#### **ThaliumDEX** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumDEX.sol`
- **Address**: `0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6)
- **Features**:
  - Automated Market Maker (AMM)
  - Liquidity pool creation and management
  - Token swaps with slippage protection
  - THAL token fee discounts (3 tiers)
  - Circuit breakers for price protection
  - Price impact calculation
- **Fee Structure**:
  - Base Fee: 3% (300/10000)
  - Protocol Fee: 0.5% (50/10000)
  - Max Fee: 10% (1000/10000)
- **THAL Discount Tiers**:
  - Tier 1 (1,000 THAL): 5% fee discount
  - Tier 2 (10,000 THAL): 10% fee discount
  - Tier 3 (100,000 THAL): 15% fee discount
- **Roles**:
  - `DEX_ADMIN_ROLE`: Manage pools and fees
  - `LIQUIDITY_MANAGER_ROLE`: Create pools
  - `PRICE_ORACLE_ROLE`: Update THAL balances
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

#### **ThaliumMarginVault** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumMarginVault.sol`
- **Address**: `0xe8C2B5D7C85D3301EFB02A6e4C5923e914345f1a`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0xe8C2B5D7C85D3301EFB02A6e4C5923e914345f1a)
- **Features**:
  - Isolated margin accounts per user
  - Long and short positions
  - Automated liquidation system
  - Risk management controls
  - Position tracking
- **Parameters**:
  - Max Leverage: 100x
  - Min Leverage: 1x
  - Liquidation Threshold: 80% (8000/10000)
  - Maintenance Margin: 50% (5000/10000)
  - Liquidation Penalty: 5% (500/10000)
- **Roles**:
  - `MARGIN_ADMIN_ROLE`: Manage supported assets
  - `RISK_MANAGER_ROLE`: Set risk parameters
  - `LIQUIDATOR_ROLE`: Execute liquidations
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

---

### **3. Marketplace Contracts**

#### **ThaliumNFT** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumNFT.sol`
- **Address**: `0x5e08aA65ceE54A6463df71096c9C4c23E317d58C`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x5e08aA65ceE54A6463df71096c9C4c23E317d58C)
- **Features**:
  - ERC721 with Enumerable, URIStorage, Royalty
  - Batch minting (max 100 NFTs)
  - NFT staking functionality
  - Creator royalty management
  - Marketplace integration
- **Parameters**:
  - Max Royalty: 10% (1000 basis points)
  - Max Batch Size: 100 NFTs
- **Roles**:
  - `MINTER_ROLE`: Mint NFTs
  - `BURNER_ROLE`: Burn NFTs
  - `ROYALTY_MANAGER_ROLE`: Manage royalties
  - `PAUSER_ROLE`: Emergency pause
  - `DEFAULT_ADMIN_ROLE`: Full control

---

### **4. Governance Contracts**

#### **ThaliumGovernance** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumGovernance.sol`
- **Address**: `0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E)
- **Features**:
  - Proposal creation and voting
  - Token-weighted voting
  - Quorum requirements
  - Proposal execution
  - Emergency cancellation
- **Parameters**:
  - Voting Period: 7 days
  - Quorum Threshold: 1,000 tokens
  - Proposal Threshold: 100 tokens
- **Roles**:
  - `PROPOSER_ROLE`: Create proposals
  - `EXECUTOR_ROLE`: Execute approved proposals
  - `CANCELLER_ROLE`: Cancel proposals
  - `ADMIN_ROLE`: Update parameters

---

### **5. Utility Contracts**

#### **ThaliumSecurity** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumSecurity.sol`
- **Address**: `0xF66767De6481779bdDA59733a17CB724e49B92e8`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0xF66767De6481779bdDA59733a17CB724e49B92e8)
- **Features**:
  - Emergency mode activation
  - Security event logging
  - Severity levels (1-4)
  - Event history (last 1000 events)
  - Auto-cleanup (1 year retention)
- **Roles**:
  - `SECURITY_ADMIN_ROLE`: Activate emergency mode
  - `COMPLIANCE_ROLE`: Log security events
  - `DEFAULT_ADMIN_ROLE`: Deactivate emergency mode

#### **ThaliumBridge** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumBridge.sol`
- **Address**: `0x7FEC3976E42512250Cf4Ed21CEBD3E501FC82803`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x7FEC3976E42512250Cf4Ed21CEBD3E501FC82803)
- **Features**:
  - Cross-chain THAL token transfers
  - Multi-signature validation (2/3 majority)
  - Bridge fee management
  - Transfer expiry (24 hours)
  - Validator management
- **Supported Chains**:
  - Ethereum (Chain ID: 1)
  - BSC (Chain ID: 56)
  - Polygon (Chain ID: 137)
  - Avalanche (Chain ID: 43114)
- **Parameters**:
  - Min Validators: 3
  - Max Validators: 10
  - Bridge Fee: 10 THAL
  - Transfer Expiry: 24 hours
- **Roles**:
  - `BRIDGE_ADMIN_ROLE`: Manage validators and fees
  - `VALIDATOR_ROLE`: Validate cross-chain transfers
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

#### **ThaliumOracle** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/ThaliumOracle.sol`
- **Address**: `0x9e69bbdabC28aEa8caa10939EABDCED07827a801`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0x9e69bbdabC28aEa8caa10939EABDCED07827a801)
- **Features**:
  - Dual price feeds (primary + secondary)
  - Circuit breaker protection
  - Emergency fallback prices
  - Price staleness detection
  - Multi-symbol support
- **Parameters**:
  - Max Price Age: 24 hours
  - Circuit Breaker Threshold: 50% price change
  - Emergency Price Validity: 7 days
  - Price Precision: 8 decimals
- **Roles**:
  - `ORACLE_ADMIN_ROLE`: Manage symbols and emergency prices
  - `PRICE_UPDATER_ROLE`: Update price feeds
  - `DEFAULT_ADMIN_ROLE`: Emergency controls

#### **EmergencyControls** ✅ DEPLOYED
- **Contract**: `blockchain-contracts/contracts/EmergencyControls.sol`
- **Address**: `0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2)
- **Features**:
  - 3-level emergency system (Normal, Warning, Emergency)
  - Per-contract circuit breakers
  - Activity monitoring
  - Emergency pause functionality
  - Cooldown periods
- **Parameters**:
  - Emergency Cooldown: 1 hour
  - Max Activity Per Period: 1000
  - Activity Period: 1 hour
- **Roles**:
  - `EMERGENCY_ROLE`: Activate emergency mode
  - `RECOVERY_ROLE`: Recovery operations
  - `CIRCUIT_BREAKER_ROLE`: Trigger circuit breakers
  - `DEFAULT_ADMIN_ROLE`: Full control

#### **ThaliumDistribution** ✅ DEPLOYED
- **Contract**: Referenced in services but no .sol file found
- **Address**: `0xf72935cEb0651E3c7157c4D8Fe680238d8814135`
- **Network**: BSC Testnet
- **Verified**: [View on BscScan](https://testnet.bscscan.com/address/0xf72935cEb0651E3c7157c4D8Fe680238d8814135)
- **Note**: Contract deployed but source file not in repository
- **Purpose**: Token distribution management

---

## 📊 DEPLOYMENT SUMMARY

### **Deployment Status**

| # | Contract | Status | Address | Priority |
|---|----------|--------|---------|----------|
| 1 | ThaliumToken | ✅ Deployed | `0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7` | Core |
| 2 | ThaliumPresale | ✅ Deployed | `0x18D53283c23BC9fFAa3e8B03154f0C4be49de526` | Core |
| 3 | ThaliumVesting | ✅ Deployed | `0x4fE4BC41B0c52861115142BaCECE25d01A8644ff` | Core |
| 4 | ThaliumDEX | ✅ Deployed | `0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6` | DeFi |
| 5 | ThaliumNFT | ✅ Deployed | `0x5e08aA65ceE54A6463df71096c9C4c23E317d58C` | Marketplace |
| 6 | ThaliumMarginVault | ✅ Deployed | `0xe8C2B5D7C85D3301EFB02A6e4C5923e914345f1a` | DeFi |
| 7 | ThaliumGovernance | ✅ Deployed | `0x48Fa2BBcf5425db9aBeCD3B4d549b44f3FF7547E` | Governance |
| 8 | ThaliumSecurity | ✅ Deployed | `0xF66767De6481779bdDA59733a17CB724e49B92e8` | Utility |
| 9 | ThaliumBridge | ✅ Deployed | `0x7FEC3976E42512250Cf4Ed21CEBD3E501FC82803` | Utility |
| 10 | ThaliumOracle | ✅ Deployed | `0x9e69bbdabC28aEa8caa10939EABDCED07827a801` | Utility |
| 11 | EmergencyControls | ✅ Deployed | `0xA7Dd54373213A438CB1FE18c024a93C42cB90Bf2` | Utility |
| 12 | ThaliumDistribution | ✅ Deployed | `0xf72935cEb0651E3c7157c4D8Fe680238d8814135` | Core |

**Total**: 12 contracts (11 with source code + 1 deployed without source)

---

## 🔄 MAINNET DEPLOYMENT PLAN

### **Pre-Deployment Checklist**
- [ ] All testnet contracts tested and verified
- [ ] Security audit completed
- [ ] New admin wallet generated (hardware wallet recommended)
- [ ] Gas funds secured (estimate: 0.5-1 BNB)
- [ ] Deployment scripts prepared and tested
- [ ] Team ready for 24/7 monitoring

### **Deployment Sequence** (Mainnet)

**Phase 1: Foundation** (Deploy First)
1. ThaliumToken
2. ThaliumSecurity
3. EmergencyControls

**Phase 2: Core Functionality**
4. ThaliumVesting
5. ThaliumDistribution
6. ThaliumOracle

**Phase 3: Public Features**
7. ThaliumPresale (after vesting fix)
8. ThaliumBridge

**Phase 4: Advanced Features**
9. ThaliumDEX
10. ThaliumNFT
11. ThaliumMarginVault
12. ThaliumGovernance

### **Post-Deployment Actions**
1. Verify all contracts on BscScan
2. Update `.secrets/mainnet-deployed-contracts-addr`
3. Update all service configurations
4. Update frontend configurations
5. Test all integrations
6. Monitor for 48 hours before public announcement

---

## 🔐 SECURITY CONSIDERATIONS

### **Testnet Security**
- ⚠️ Testnet admin wallet private key is in `.secrets/` - acceptable for testing
- ⚠️ All testnet addresses are public - expected for testing
- ✅ Contracts follow OpenZeppelin security patterns
- ✅ Role-based access control implemented
- ✅ Emergency pause mechanisms in place

### **Mainnet Security Requirements**
- 🔴 **CRITICAL**: Generate new admin wallet with hardware wallet
- 🔴 **CRITICAL**: Never commit mainnet private keys to repository
- 🔴 **CRITICAL**: Use multi-sig for admin operations
- 🔴 **CRITICAL**: Complete security audit before deployment
- 🔴 **CRITICAL**: Implement timelock for critical operations
- 🔴 **CRITICAL**: Set up monitoring and alerting

---

## 📝 INTEGRATION REFERENCE

### **Service Configuration Files**

Update these files with contract addresses:

1. **Token Service**:
   - `services/token-svc/.env`
   - `services/token-svc/src/services/smart-contract-integration.ts`

2. **DEX Service**:
   - `services/dex-svc/.env`
   - `services/dex-svc/src/services/smart-contract-integration.ts`

3. **NFT Service**:
   - `services/nft-svc/.env`
   - `services/nft-svc/src/services/smart-contract-integration.ts`

4. **Margin Service**:
   - `services/margin-svc/.env`
   - `services/margin-svc/src/services/margin-trading.ts`

5. **Shared Services**:
   - `services/shared/src/smart-contract-integration.ts`
   - `services/shared/src/admin-wallet-integration.ts`

6. **Docker Compose**:
   - `docker-compose.yml` (all contract env vars)

---

## 🧪 TESTING CHECKLIST

### **Per-Contract Testing**
- [ ] Deploy to local testnet
- [ ] Test all public functions
- [ ] Test all admin functions
- [ ] Test role-based access control
- [ ] Test emergency pause/unpause
- [ ] Test edge cases
- [ ] Verify gas costs
- [ ] Check for reentrancy vulnerabilities

### **Integration Testing**
- [ ] Test contract-to-contract interactions
- [ ] Test backend service integration
- [ ] Test frontend integration
- [ ] Test multi-user scenarios
- [ ] Test emergency scenarios

---

## 📞 SUPPORT & RESOURCES

### **Block Explorers**
- **BSC Testnet**: https://testnet.bscscan.com
- **BSC Mainnet**: https://bscscan.com

### **RPC Endpoints**
- **Testnet**: https://data-seed-prebsc-1-s1.binance.org:8545/
- **Mainnet**: [To be configured]

### **Documentation**
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- Solidity Documentation: https://docs.soliditylang.org/
- BSC Documentation: https://docs.bnbchain.org/

---

## ⚠️ IMPORTANT NOTES

1. **ThaliumPresale Deployment Blocker**: 
   - Vesting integration must be fixed before deployment
   - Lines 312-322 contain dummy implementation
   - Must call actual ThaliumVesting.createVestingSchedule()

2. **ThaliumDistribution Mystery**:
   - Contract is deployed but source file not in repository
   - Need to locate original source code
   - Or verify deployment is correct

3. **Mainnet Preparation**:
   - Generate new secure admin wallet
   - Never reuse testnet wallet on mainnet
   - Consider multi-sig wallet for admin operations
   - Complete security audit before mainnet deployment

4. **Contract Addresses**:
   - Update `.secrets/testnet-token-deployed-contracts-addr` with ALL 11 addresses
   - Currently only has 6 addresses
   - Missing: DEX, NFT, Governance, Margin, Emergency, Distribution

---

**Document Version**: 1.0  
**Maintained By**: ThaliumX Development Team  
**Review Frequency**: After each deployment  
**Last Audit**: Pending