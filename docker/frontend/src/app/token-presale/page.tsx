'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Coins,
  TrendingUp,
  Loader2,
  CheckCircle,
  Wallet,
  DollarSign,
  Clock,
  Users,
  Target,
  AlertTriangle
} from 'lucide-react';
import { tokenPurchaseSchema, validateForm } from '@/lib/utils';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { UpgradePrompt } from '@/components/kyc/UpgradePrompt';
import { PostPurchaseTrading } from '@/components/presale/PostPurchaseTrading';
import { logNetworkError } from '@/lib/services/errorLogger';
import { initializeEntryDomain } from '@/lib/utils/domain-detection';

interface PresaleStatus {
  status?: string;
  totalRaised?: number;
  target?: number;
  participants?: number;
  timeRemaining?: string;
  endDate?: string;
}

interface Web3Wallet {
  id: string;
  address: string;
  walletType?: string;
}

interface Web3WalletsResponse {
  success?: boolean;
  data?: Web3Wallet[];
}

function toPresaleStatus(value: unknown): PresaleStatus {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const maybeWrapped = value as { data?: unknown };
  if (maybeWrapped.data && typeof maybeWrapped.data === 'object') {
    return maybeWrapped.data as PresaleStatus;
  }

  return value as PresaleStatus;
}

export default function TokenPresalePage() {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'USDT' | 'BANK_TRANSFER'>('USDT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [presaleData, setPresaleData] = useState<PresaleStatus | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [brokerCode, setBrokerCode] = useState<string>('');
  const [thalPrice, setThalPrice] = useState<number>(0.10); // Default fallback price
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ amount: number; tokens: number; kycLevel: string } | null>(null);
  const [deliveryWalletType, setDeliveryWalletType] = useState<'user_web3' | 'platform_hot'>('platform_hot');
  const [connectedWeb3Wallets, setConnectedWeb3Wallets] = useState<Web3Wallet[]>([]);
  const [selectedWeb3Wallet, setSelectedWeb3Wallet] = useState<string>('');

  const loadConnectedWeb3Wallets = useCallback(async () => {
    try {
      const response = await fetch('/api/web3-wallet/wallets', {
        credentials: 'include',
      });
      if (response.ok) {
        const data: Web3WalletsResponse = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setConnectedWeb3Wallets(data.data);
          // Auto-select first wallet if available
          const firstWallet = data.data?.[0];
          if (firstWallet && !selectedWeb3Wallet) {
            setSelectedWeb3Wallet(firstWallet.address);
            setDeliveryWalletType('user_web3');
          }
        }
      }
    } catch (err) {
      // Silently fail - user can still use platform hot wallet
      console.error('Failed to load Web3 wallets:', err);
    }
  }, [selectedWeb3Wallet]);

  useEffect(() => {
    // Initialize entry domain detection - mark this as presale domain entry
    const initDomain = async () => {
      initializeEntryDomain();
      // Explicitly set as presale domain if on this page
      if (typeof window !== 'undefined') {
        const { setEntryDomain } = await import('@/lib/utils/domain-detection');
        setEntryDomain('presale');
      }
    };
    initDomain();

    // Load presale data
    loadPresaleData();

    // Load THAL price
    loadThalPrice();

    // Load connected Web3 wallets if authenticated
    // Only check auth if we have a token in memory (no API call if no token)
    (async () => {
      try {
        const { getAuthToken } = await import('@/lib/auth/backend-auth');
        const token = getAuthToken();
        if (token) {
          // Only make API call if we have a token
          const isAuth = await checkBackendAuth();
          setIsAuthenticated(isAuth);
          if (isAuth) {
            loadConnectedWeb3Wallets();
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, [loadConnectedWeb3Wallets]);

  // No need for authzHeaders - backend uses httpOnly cookies
  // All requests automatically include credentials via 'credentials: include'

  const loadThalPrice = async () => {
    try {
      const response = await fetch('/api/market/prices/THAL');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setThalPrice(data.data.price);
        }
      }
    } catch (error) {
      logNetworkError(error, { endpoint: '/api/market/prices/THAL', component: 'TokenPresale' });
      // Keep default price of $0.10
    }
  };

  const loadPresaleData = async () => {
    try {
      // Use platform-default-tenant for token presale
      const defaultTenantId = '10000000-0000-0000-0000-000000000000';
      const response = await fetch('/api/presale/status', {
        credentials: 'include', // Include cookies
        headers: {
          'X-Tenant-ID': defaultTenantId,
        }
      });

      if (response.ok) {
        const rawData: unknown = await response.json();
        const data = toPresaleStatus(rawData);
        setPresaleData(data);
        
        // Check if presale has ended and redirect to main platform
        if (data.status === 'completed' || data.status === 'COMPLETED') {
          // Presale has ended - redirect to main platform after a short delay
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 3000); // 3 second delay to show message
        } else if (data.endDate) {
          // Check if end date has passed
          const endDate = new Date(data.endDate);
          const now = new Date();
          if (now > endDate) {
            // Presale has ended - redirect to main platform
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 3000);
          }
        }
      }
    } catch (err) {
      logNetworkError(err, { endpoint: '/api/presale/status', component: 'TokenPresale' });
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate form data
    const purchaseData = {
      amount: parseFloat(amount),
      paymentMethod,
      walletAddress: paymentMethod === 'USDT' ? walletAddress : undefined,
      brokerCode: brokerCode || undefined,
    };

    const validation = validateForm(tokenPurchaseSchema, purchaseData);
    if (!validation.success) {
      setError(Object.values(validation.errors)[0] || 'Please check your input');
      setIsLoading(false);
      return;
    }

    try {
      // Use platform-default-tenant for token presale
      const defaultTenantId = '10000000-0000-0000-0000-000000000000';
      const response = await fetch('/api/presale/investments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': defaultTenantId,
          ...(brokerCode ? { 'X-Broker-Code': brokerCode } : {}),
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          presaleId: 'thal-presale-v1',
          amount: parseFloat(amount),
          paymentMethod,
          tier: 'bronze',
          walletAddress: paymentMethod === 'USDT' ? (deliveryWalletType === 'user_web3' ? selectedWeb3Wallet : walletAddress) : undefined,
          deliveryWalletType, // New field: 'user_web3' or 'platform_hot'
          referralCode: brokerCode || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Purchase failed');
      }

      setSuccess('Token purchase request submitted!');
      
      // Store purchase success data for post-purchase CTA
      const investmentData = data.data || {};
      const tokenAmount = investmentData.tokenAmount || Math.floor(parseFloat(amount) / thalPrice);
      const kycLevel = investmentData.kycLevel || 'L1';
      const postPurchaseFlow = investmentData.postPurchaseFlow;
      
      setPurchaseSuccess({
        amount: parseFloat(amount),
        tokens: tokenAmount,
        kycLevel: kycLevel
      });
      
      // If trading account was created/enabled, show enhanced success message
      if (postPurchaseFlow?.tradingAccountCreated || postPurchaseFlow?.tradingAccountEnabled) {
        setSuccess('Token purchase successful! Your trading account is ready.');
      }
      
      setAmount('');
      setWalletAddress('');
      loadPresaleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-center mb-4">
            <Coins className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            THAL Token Presale
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join the ThaliumX ecosystem early and get exclusive presale pricing on THAL tokens
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Raised</p>
                  <p className="text-2xl font-bold">
                    ${presaleData?.totalRaised?.toLocaleString() || '0'}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target</p>
                  <p className="text-2xl font-bold">
                    ${presaleData?.target?.toLocaleString() || '1,000,000'}
                  </p>
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Participants</p>
                  <p className="text-2xl font-bold">
                    {presaleData?.participants || '0'}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time Remaining</p>
                  <p className="text-2xl font-bold">
                    {presaleData?.timeRemaining || '30 days'}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Purchase Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Purchase THAL Tokens</span>
              </CardTitle>
              <CardDescription>
                Buy THAL tokens at presale prices with USDT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show upgrade prompt if user is authenticated */}
              {isAuthenticated && (
                <UpgradePrompt limitType="investment" />
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <>
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-green-600">{success}</AlertDescription>
                  </Alert>
                  {/* Show post-purchase trading CTA if we have investment data */}
                  {purchaseSuccess && (
                    <PostPurchaseTrading
                      investmentAmount={purchaseSuccess.amount}
                      tokenAmount={purchaseSuccess.tokens}
                      kycLevel={purchaseSuccess.kycLevel}
                    />
                  )}
                </>
              )}

              {!isAuthenticated && (
                <Alert>
                  <AlertDescription>
                    <a href="/login?next=/token-presale" className="text-primary underline">Sign in</a> to purchase tokens
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handlePurchase} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USDT)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    disabled={isLoading || !isAuthenticated}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum purchase: $50 USDT
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Presale Price:</span>
                    <span className="font-medium">1 THAL = ${thalPrice.toFixed(4)} USDT</span>
                  </div>
                  {amount && (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span>You&apos;ll receive:</span>
                        <span className="font-medium">
                          {(parseFloat(amount) / thalPrice).toLocaleString()} THAL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Cost:</span>
                        <span className="font-medium">${parseFloat(amount).toLocaleString()} USDT</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="pm" value="USDT" checked={paymentMethod==='USDT'} onChange={() => setPaymentMethod('USDT')} />
                      USDT (Web3)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="pm" value="BANK_TRANSFER" checked={paymentMethod==='BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} />
                      Bank Transfer (FIAT)
                    </label>
                  </div>
                </div>

                {/* Token Delivery Wallet Selection */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <Label className="text-base font-semibold">Where should we send your THAL tokens?</Label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <input 
                        type="radio" 
                        name="deliveryWallet" 
                        value="user_web3" 
                        checked={deliveryWalletType === 'user_web3'} 
                        onChange={() => setDeliveryWalletType('user_web3')}
                        className="mt-1"
                        disabled={connectedWeb3Wallets.length === 0}
                      />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Send to my Web3 wallet
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tokens sent directly to your connected wallet (MetaMask, Trust Wallet, etc.). 
                          Fully visible on-chain for maximum transparency.
                        </div>
                        {deliveryWalletType === 'user_web3' && connectedWeb3Wallets.length > 0 && (
                          <div className="mt-2">
                            <Label className="text-xs">Select Wallet:</Label>
                            <select
                              value={selectedWeb3Wallet}
                              onChange={(e) => setSelectedWeb3Wallet(e.target.value)}
                              className="mt-1 w-full p-2 text-sm border rounded bg-background"
                            >
                              {connectedWeb3Wallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.address}>
                                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} ({wallet.walletType})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {connectedWeb3Wallets.length === 0 && (
                          <div className="mt-2 text-xs text-amber-600">
                            No Web3 wallets connected. Connect a wallet first or use platform hot wallet.
                          </div>
                        )}
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <input 
                        type="radio" 
                        name="deliveryWallet" 
                        value="platform_hot" 
                        checked={deliveryWalletType === 'platform_hot'} 
                        onChange={() => setDeliveryWalletType('platform_hot')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <Coins className="h-4 w-4" />
                          Send to platform hot wallet
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tokens sent to your platform-managed hot wallet. Still visible on-chain, 
                          but managed through our platform for easier trading and management.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {paymentMethod === 'USDT' && deliveryWalletType === 'platform_hot' && (
                  <div className="space-y-2">
                    <Label htmlFor="wallet">Wallet Address (optional - for USDT payment)</Label>
                    <Input id="wallet" placeholder="0x..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Your USDT payment wallet address. THAL tokens will be sent to your selected delivery wallet above.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="broker">Broker Code (optional)</Label>
                  <Input id="broker" placeholder="BROKER123" value={brokerCode} onChange={(e) => setBrokerCode(e.target.value)} />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={isLoading || !isAuthenticated || !amount}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Purchase THAL Tokens
                    </>
                  )}
                </Button>
              </form>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {['50', '100', '500', '1000'].map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(value)}
                    disabled={isLoading || !isAuthenticated}
                  >
                    ${value}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Presale Info */}
          <Card>
            <CardHeader>
              <CardTitle>Presale Details</CardTitle>
              <CardDescription>
                Important information about the THAL token presale
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Presale Benefits</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Early access to THAL tokens</li>
                    <li>• Discounted presale pricing</li>
                    <li>• Fee discounts on trading</li>
                    <li>• Governance voting rights</li>
                    <li>• Staking rewards eligibility</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Token Distribution</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Presale: 30% of total supply</li>
                    <li>• Public Sale: 20%</li>
                    <li>• Team & Development: 15% (locked)</li>
                    <li>• Ecosystem & Rewards: 35%</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">How to Participate</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Sign in or create an account</li>
                    <li>Connect your Web3 wallet or deposit USDT</li>
                    <li>Enter the amount you want to purchase</li>
                    <li>Confirm the transaction</li>
                    <li>Receive THAL tokens in your wallet</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Payment Methods</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• USDT (ERC-20, BEP-20, TRC-20)</li>
                    <li>• Web3 wallet integration</li>
                    <li>• Bank transfer (FIAT)</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" className="w-full" asChild>
                  <a href="/landing">Back to Home</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
