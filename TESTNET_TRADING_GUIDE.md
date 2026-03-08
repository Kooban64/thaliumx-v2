# 🧪 Testnet Trading & Testing Guide

This guide will help you perform "dummy" trading on BSC Testnet to test all platform features.

## 📋 Prerequisites

### 1. Get Testnet Tokens

You'll need testnet tokens to perform transactions:

#### **BNB (for gas fees)**
- **BSC Testnet Faucet**: https://testnet.bnbchain.org/faucet-smart
- Enter your MetaMask wallet address
- Request testnet BNB (usually 0.1-1 BNB per request)

#### **USDT (for token purchases)**
- **BSC Testnet USDT Contract**: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`
- You can mint testnet USDT using a script or get it from a testnet faucet
- Alternative: Use the admin wallet to send USDT to your test wallet

### 2. Setup MetaMask for BSC Testnet

1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Add BSC Testnet:
   - **Network Name**: BSC Testnet
   - **RPC URL**: `https://data-seed-prebsc-1-s1.binance.org:8545/`
   - **Chain ID**: `97`
   - **Currency Symbol**: `BNB`
   - **Block Explorer**: `https://testnet.bscscan.com`

### 3. Verify Presale is Active

Check if the presale contract is active:

```bash
cd blockchain-contracts
npx hardhat run scripts/check-contract-status.js --network testnet
```

If presale is not started, activate it:

```bash
cd blockchain-contracts
npx hardhat run scripts/activate-presale.js --network testnet
```

## 🎯 Testing Scenarios

### **Scenario 1: Token Presale Purchase**

#### Via Frontend (Recommended)
1. Navigate to `/token-presale` page
2. Connect your MetaMask wallet (BSC Testnet)
3. Ensure you have:
   - BNB for gas fees (at least 0.01 BNB)
   - USDT for purchase (minimum 100 USDT)
4. Enter purchase amount (100-10,000 USDT)
5. Select payment method: **USDT**
6. Choose wallet delivery:
   - **Platform Hot Wallet**: Tokens go to platform-managed wallet
   - **User Web3 Wallet**: Tokens go to your connected MetaMask
7. Click "Purchase Tokens"
8. Approve USDT spending (if first time)
9. Confirm transaction in MetaMask

#### Via Backend API
```bash
# First, get your auth token (login via frontend or API)
TOKEN="your-jwt-token"

# Make purchase request
curl -X POST http://localhost:3002/api/presale/investments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: 10000000-0000-0000-0000-000000000000" \
  -d '{
    "presaleId": "thal-presale-v1",
    "amount": 100,
    "paymentMethod": "USDT",
    "tier": "bronze",
    "walletAddress": "0xYourWalletAddress",
    "deliveryWalletType": "user_web3"
  }'
```

### **Scenario 2: DEX Token Swapping**

#### Via Frontend
1. Navigate to trading/DEX page
2. Connect MetaMask wallet
3. Select tokens to swap (e.g., USDT → THAL)
4. Enter amount
5. Review slippage and fees
6. Execute swap

#### Via Backend API
```bash
# Get swap quote
curl -X GET "http://localhost:3002/api/dex/quotes?tokenIn=0x337610d27c682E347C9cD60BD4b3b107C9d34dDd&tokenOut=0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7&amountIn=1000000000" \
  -H "Authorization: Bearer $TOKEN"

# Execute swap
curl -X POST http://localhost:3002/api/dex/swaps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tokenIn": "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    "tokenOut": "0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7",
    "amountIn": "1000000000",
    "slippage": 0.5,
    "deadline": 1735689600,
    "route": []
  }'
```

### **Scenario 3: NFT Operations**

#### Mint NFT
```bash
curl -X POST http://localhost:3002/api/nft/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collectionId": "test-collection",
    "tokenId": "1",
    "metadata": {
      "name": "Test NFT",
      "description": "Testing NFT minting",
      "image": "https://example.com/image.png"
    }
  }'
```

### **Scenario 4: Margin Trading**

```bash
# Open margin position
curl -X POST http://localhost:3002/api/margin/positions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "asset": "THAL",
    "side": "long",
    "leverage": 5,
    "amount": "1000"
  }'
```

## 🛠️ Helper Scripts

### Check Contract Status
```bash
cd blockchain-contracts
npx hardhat run scripts/check-contract-status.js --network testnet
```

### Activate Presale
```bash
cd blockchain-contracts
npx hardhat run scripts/activate-presale.js --network testnet
```

### Test Backend Connectivity
```bash
cd /home/ubuntu/thaliumx-v1
node scripts/test-contract-connectivity.js
```

### Get Testnet USDT (if you have admin wallet)

Create a script to mint/send testnet USDT to your test wallet:

```javascript
// scripts/send-testnet-usdt.js
const { ethers } = require("ethers");

const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
const ADMIN_PRIVATE_KEY = "0x53e72464ca58fad7da3bf9b4e302bb7e98707082a28dd2d9219ab9f10f11bff6";
const RECIPIENT = "0xYourTestWalletAddress";

const USDT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function sendTestnetUSDT() {
  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
  const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);
  
  const decimals = await usdtContract.decimals();
  const amount = ethers.parseUnits("1000", decimals); // 1000 USDT
  
  console.log(`Sending ${ethers.formatUnits(amount, decimals)} USDT to ${RECIPIENT}...`);
  
  const tx = await usdtContract.transfer(RECIPIENT, amount);
  console.log(`Transaction: ${tx.hash}`);
  
  await tx.wait();
  console.log("✅ USDT sent successfully!");
  
  const balance = await usdtContract.balanceOf(RECIPIENT);
  console.log(`New balance: ${ethers.formatUnits(balance, decimals)} USDT`);
}

sendTestnetUSDT().catch(console.error);
```

## 📊 Contract Addresses Reference

All contracts are deployed on BSC Testnet (Chain ID: 97):

- **THAL Token**: `0x890c7DFB0103E68Df8Fe3FF266638cb714ca8CF7`
- **Presale**: `0x18D53283c23BC9fFAa3e8B03154f0C4be49de526`
- **DEX**: `0x1E0B9fce147c2aB5646db027F9Ba3Cfd0ba573A6`
- **NFT**: `0x5e08aA65ceE54A6463df71096c9C4c23E317d58C`
- **Margin Vault**: `0xe8C2B5D7C85D3301EFB02A6e4C5923e914345f1a`
- **USDT (Testnet)**: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`

## 🔍 Verification Steps

1. **Check Presale Status**:
   ```bash
   cd blockchain-contracts
   npx hardhat run scripts/check-contract-status.js --network testnet
   ```

2. **Verify Backend Can Connect**:
   ```bash
   node scripts/test-contract-connectivity.js
   ```

3. **Check Your Wallet Balance**:
   - BNB: Check on MetaMask or https://testnet.bscscan.com
   - USDT: Check contract `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` on BscScan

## 🎮 Quick Start Testing Flow

1. **Setup**:
   - Get BNB from faucet: https://testnet.bnbchain.org/faucet-smart
   - Connect MetaMask to BSC Testnet
   - Get testnet USDT (use script above or faucet)

2. **Test Presale**:
   - Go to `/token-presale`
   - Purchase 100 USDT worth of THAL tokens
   - Verify tokens received

3. **Test DEX**:
   - Go to trading/DEX page
   - Swap some USDT for THAL (or vice versa)
   - Verify swap executed

4. **Test NFT**:
   - Mint a test NFT
   - List it for sale
   - Purchase it with another wallet

5. **Test Margin**:
   - Open a small margin position
   - Monitor position
   - Close position

## ⚠️ Important Notes

- **All transactions are on TESTNET** - no real money involved
- **Gas fees are paid in testnet BNB** - get from faucet
- **Presale must be activated** before purchases work
- **Minimum purchase**: 100 USDT
- **Maximum purchase**: 10,000 USDT per user
- **Rate**: 1 USDT = 100 THAL tokens

## 🐛 Troubleshooting

### "Presale not started"
```bash
cd blockchain-contracts
npx hardhat run scripts/activate-presale.js --network testnet
```

### "Insufficient USDT balance"
- Get testnet USDT from faucet or use the send script above
- Ensure you're on BSC Testnet (not mainnet)

### "Transaction failed"
- Check you have enough BNB for gas
- Verify contract is not paused
- Check presale is active

### "Cannot connect to contracts"
- Verify backend has `NETWORK=testnet` in environment
- Check RPC URL is correct: `https://data-seed-prebsc-1-s1.binance.org:8545/`
- Run connectivity test: `node scripts/test-contract-connectivity.js`

## 📚 Additional Resources

- **BSC Testnet Explorer**: https://testnet.bscscan.com
- **BSC Testnet Faucet**: https://testnet.bnbchain.org/faucet-smart
- **Contract Documentation**: See `how-to-fix/DEPLOYED_CONTRACTS.md`
- **Backend API Docs**: Check Swagger at `/api/docs` (if enabled)

---

**Happy Testing! 🚀**
