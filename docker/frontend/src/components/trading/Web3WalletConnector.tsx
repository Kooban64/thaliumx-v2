'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import apiClient from '@/lib/api/client';

interface Web3Wallet {
  id: string;
  address: string;
  chainId: number;
  walletType: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  balance: string;
}

export function Web3WalletConnector() {
  const [wallets, setWallets] = useState<Web3Wallet[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddresses, setShowAddresses] = useState(false);

  useEffect(() => {
    loadConnectedWallets();
  }, []);

  const loadConnectedWallets = async () => {
    try {
      const response = await apiClient.get<any[]>('/api/web3-wallet/wallets');
      if (!response.success) {
        throw new Error(response.error || response.message || 'Failed to load wallets');
      }

      const rows = response.data || [];

      // Enrich with native balance (best-effort).
      const enriched: Web3Wallet[] = await Promise.all(
        rows.map(async (w: any) => {
          try {
            const balRes = await apiClient.get<any>(`/api/web3-wallet/${w.address}/balance/${w.chainId}`);
            const native = balRes.success ? balRes.data?.nativeBalance : undefined;
            return {
              id: w.id,
              address: w.address,
              chainId: w.chainId,
              walletType: w.walletType,
              status: w.status,
              balance: native || '—',
            };
          } catch {
            return {
              id: w.id,
              address: w.address,
              chainId: w.chainId,
              walletType: w.walletType,
              status: w.status,
              balance: '—',
            };
          }
        }),
      );

      setWallets(enriched);
    } catch (err) {
      console.error('Failed to load wallets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError('');
    setSuccess('');

    try {
      // Check if MetaMask is available
      const eth = (window as unknown as { ethereum?: any }).ethereum;
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
      const timestamp = Date.now();
      const nonce = `${timestamp}-${Math.random().toString(16).slice(2)}`;
      const message = `Connect to ThaliumX\nAddress: ${address}\nChain: ${chainId}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

      // Request signature
      const signature = await eth.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Send to backend
      const response = await apiClient.post('/api/web3-wallet/connect', {
        address,
        chainId,
        signature,
        message,
        timestamp,
        nonce,
        walletType: 'metamask',
      });

      if (!response.success) {
        throw new Error(response.error || response.message || 'Failed to connect wallet');
      }

      setSuccess('Wallet connected successfully!');
      loadConnectedWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async (walletId: string) => {
    try {
      const response = await apiClient.delete<void>(`/api/web3-wallet/${walletId}/disconnect`);
      if (!response.success) {
        throw new Error(response.error || response.message || 'Failed to disconnect wallet');
      }

      setSuccess('Wallet disconnected successfully!');
      loadConnectedWallets();
    } catch (_err) {
      setError('Failed to disconnect wallet');
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess('Address copied to clipboard!');
  };

  const getChainName = (chainId: number) => {
    const chains: { [key: number]: string } = {
      1: 'Ethereum',
      56: 'BSC',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  const formatAddress = (address: string) => {
    if (showAddresses) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading wallets...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wallet className="h-5 w-5" />
          <span>Web3 Wallets</span>
        </CardTitle>
        <CardDescription>
          Connect your Web3 wallets for trading
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {/* Connect Wallet Button */}
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect MetaMask
            </>
          )}
        </Button>

        {/* Connected Wallets */}
        {wallets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Connected Wallets</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddresses(!showAddresses)}
              >
                {showAddresses ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>

            {wallets.map((wallet) => (
              <div key={wallet.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${
                      wallet.status === 'connected' ? 'bg-green-500' : 
                      wallet.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium">{wallet.walletType}</span>
                    <span className="text-sm text-muted-foreground">
                      {getChainName(wallet.chainId)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyAddress(wallet.address)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectWallet(wallet.id)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {formatAddress(wallet.address)}
                </div>
                <div className="text-sm">
                  Balance: {wallet.balance}
                </div>
              </div>
            ))}
          </div>
        )}

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
      </CardContent>
    </Card>
  );
}
