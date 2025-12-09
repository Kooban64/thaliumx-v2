'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Web3WalletConnector = Web3WalletConnector;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function Web3WalletConnector() {
    const [wallets, setWallets] = (0, react_1.useState)([]);
    const [isConnecting, setIsConnecting] = (0, react_1.useState)(false);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)('');
    const [success, setSuccess] = (0, react_1.useState)('');
    const [showAddresses, setShowAddresses] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        loadConnectedWallets();
    }, []);
    const loadConnectedWallets = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/web3-wallet/wallets', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setWallets(data.wallets || []);
            }
        }
        catch (err) {
            console.error('Failed to load wallets:', err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const connectWallet = async () => {
        setIsConnecting(true);
        setError('');
        setSuccess('');
        try {
            // Check if MetaMask is available
            const eth = window.ethereum;
            if (!eth) {
                throw new Error('MetaMask not detected. Please install MetaMask to continue.');
            }
            // Request account access
            const accounts = await eth.request({
                method: 'eth_requestAccounts',
            });
            if (accounts.length === 0) {
                throw new Error('No accounts found. Please connect your wallet.');
            }
            const address = accounts[0];
            const chainId = parseInt(eth.chainId, 16);
            // Create message for signature
            const message = `Connect to ThaliumX\nAddress: ${address}\nChain: ${chainId}\nTimestamp: ${Date.now()}`;
            // Request signature
            const signature = await eth.request({
                method: 'personal_sign',
                params: [message, address],
            });
            // Send to backend
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/web3-wallet/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    address,
                    chainId,
                    signature,
                    message,
                    walletType: 'MetaMask',
                    publicKey: '', // MetaMask doesn't expose public key
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to connect wallet');
            }
            setSuccess('Wallet connected successfully!');
            loadConnectedWallets();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        }
        finally {
            setIsConnecting(false);
        }
    };
    const disconnectWallet = async (walletId) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/web3-wallet/${walletId}/disconnect`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                setSuccess('Wallet disconnected successfully!');
                loadConnectedWallets();
            }
        }
        catch (err) {
            setError('Failed to disconnect wallet');
        }
    };
    const copyAddress = (address) => {
        navigator.clipboard.writeText(address);
        setSuccess('Address copied to clipboard!');
    };
    const getChainName = (chainId) => {
        const chains = {
            1: 'Ethereum',
            56: 'BSC',
            137: 'Polygon',
            42161: 'Arbitrum',
            10: 'Optimism',
        };
        return chains[chainId] || `Chain ${chainId}`;
    };
    const formatAddress = (address) => {
        if (showAddresses) {
            return address;
        }
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };
    if (isLoading) {
        return (<card_1.Card>
        <card_1.CardContent className="p-6">
          <div className="flex items-center justify-center">
            <lucide_react_1.Loader2 className="h-6 w-6 animate-spin"/>
            <span className="ml-2">Loading wallets...</span>
          </div>
        </card_1.CardContent>
      </card_1.Card>);
    }
    return (<card_1.Card>
      <card_1.CardHeader>
        <card_1.CardTitle className="flex items-center space-x-2">
          <lucide_react_1.Wallet className="h-5 w-5"/>
          <span>Web3 Wallets</span>
        </card_1.CardTitle>
        <card_1.CardDescription>
          Connect your Web3 wallets for trading
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent className="space-y-4">
        {error && (<alert_1.Alert variant="destructive">
            <lucide_react_1.AlertTriangle className="h-4 w-4"/>
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {success && (<alert_1.Alert>
            <lucide_react_1.CheckCircle className="h-4 w-4"/>
            <alert_1.AlertDescription className="text-green-600">{success}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {/* Connect Wallet Button */}
        <button_1.Button onClick={connectWallet} disabled={isConnecting} className="w-full">
          {isConnecting ? (<>
              <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
              Connecting...
            </>) : (<>
              <lucide_react_1.Wallet className="mr-2 h-4 w-4"/>
              Connect MetaMask
            </>)}
        </button_1.Button>

        {/* Connected Wallets */}
        {wallets.length > 0 && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Connected Wallets</h4>
              <button_1.Button variant="ghost" size="sm" onClick={() => setShowAddresses(!showAddresses)}>
                {showAddresses ? (<lucide_react_1.EyeOff className="h-4 w-4"/>) : (<lucide_react_1.Eye className="h-4 w-4"/>)}
              </button_1.Button>
            </div>

            {wallets.map((wallet) => (<div key={wallet.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${wallet.status === 'active' ? 'bg-green-500' :
                    wallet.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`}/>
                    <span className="font-medium">{wallet.walletType}</span>
                    <span className="text-sm text-muted-foreground">
                      {getChainName(wallet.chainId)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button_1.Button variant="ghost" size="sm" onClick={() => copyAddress(wallet.address)}>
                      <lucide_react_1.Copy className="h-3 w-3"/>
                    </button_1.Button>
                    <button_1.Button variant="ghost" size="sm" onClick={() => disconnectWallet(wallet.id)}>
                      <lucide_react_1.ExternalLink className="h-3 w-3"/>
                    </button_1.Button>
                  </div>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {formatAddress(wallet.address)}
                </div>
                <div className="text-sm">
                  Balance: {wallet.balance} ETH
                </div>
              </div>))}
          </div>)}

        {/* Supported Wallets Info */}
        <div className="p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">Supported Wallets</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• MetaMask</div>
            <div>• WalletConnect</div>
            <div>• Coinbase Wallet</div>
            <div>• Ledger & Trezor</div>
          </div>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
//# sourceMappingURL=Web3WalletConnector.js.map