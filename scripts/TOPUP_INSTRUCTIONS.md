# Top-up Admin Wallet with $2M USDT

## Current Status
- **BNB Balance**: 0.931899 BNB (~$559 USD) ✅
- **USDT Balance**: 0.00 USDT ❌
- **Target**: $2,000,000 USDT
- **Needed**: $2,000,000 USDT

## Options to Top Up

### Option 1: Mint USDT (if contract supports it)

If the BSC Testnet USDT contract supports minting and the admin wallet has permission:

```bash
cd blockchain-contracts
npx hardhat run scripts/topup-admin-wallet.js --network testnet
```

### Option 2: Use Testnet Faucet

BSC Testnet USDT faucets:
- Some testnet faucets provide USDT tokens
- You may need to request multiple times to reach $2M

### Option 3: Transfer from Another Wallet

If you have another wallet with testnet USDT:

```bash
node scripts/send-testnet-usdt.js 0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A 2000000
```

### Option 4: Deploy/Mint via Contract Interaction

If the USDT contract is a standard testnet token, you might be able to:
1. Check if admin wallet is the owner/minter
2. Call `mint()` function directly
3. Or use a script that interacts with the contract

## Quick Check Script

Run this to check current balances:

```bash
python3 << 'EOF'
import json
import requests

rpc_url = "https://data-seed-prebsc-1-s1.binance.org:8545/"
admin_addr = "0x310Ff4fE76974DF5977a1a269F60F7B0a83d835A"
usdt_addr = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"

# Get BNB
bnb_req = {"jsonrpc": "2.0", "method": "eth_getBalance", "params": [admin_addr, "latest"], "id": 1}
bnb_resp = requests.post(rpc_url, json=bnb_req).json()
bnb_wei = int(bnb_resp["result"], 16)
bnb_balance = bnb_wei / 10**18

# Get USDT
usdt_req = {"jsonrpc": "2.0", "method": "eth_call", "params": [{"to": usdt_addr, "data": "0x70a08231" + admin_addr[2:].zfill(64)}, "latest"], "id": 2}
usdt_resp = requests.post(rpc_url, json=usdt_req).json()
usdt_balance = int(usdt_resp["result"], 16) / 10**6 if usdt_resp["result"] != "0x" else 0

print(f"BNB: {bnb_balance:.6f} BNB")
print(f"USDT: {usdt_balance:,.2f} USDT")
print(f"Needed: ${max(0, 2000000 - usdt_balance):,.2f} USDT")
EOF
```

## Recommended Approach

Since BSC Testnet USDT is typically a standard ERC20 token without public minting, the easiest approach is:

1. **Use a testnet faucet** to get initial USDT
2. **Or** if you control the USDT contract deployment, mint directly
3. **Or** transfer from another testnet wallet that has USDT

For testing purposes, you might not need the full $2M - you can start with smaller amounts and add more as needed.
