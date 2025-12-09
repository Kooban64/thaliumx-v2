'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TokenPresalePage;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function TokenPresalePage() {
    const [amount, setAmount] = (0, react_1.useState)('');
    const [paymentMethod, setPaymentMethod] = (0, react_1.useState)('USDT');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [success, setSuccess] = (0, react_1.useState)('');
    const [presaleData, setPresaleData] = (0, react_1.useState)(null);
    const [walletAddress, setWalletAddress] = (0, react_1.useState)('');
    const [brokerCode, setBrokerCode] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        // Load presale data
        loadPresaleData();
    }, []);
    const loadPresaleData = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/presale/status', {
                headers: token ? {
                    'Authorization': `Bearer ${token}`,
                } : {},
            });
            if (response.ok) {
                const data = await response.json();
                setPresaleData(data);
            }
        }
        catch (err) {
            console.error('Failed to load presale data:', err);
        }
    };
    const handlePurchase = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Please sign in to purchase tokens');
            }
            const response = await fetch('/api/presale/investments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(brokerCode ? { 'X-Broker-Code': brokerCode } : {})
                },
                body: JSON.stringify({
                    presaleId: 'thal-presale-v1',
                    amount: parseFloat(amount),
                    paymentMethod,
                    tier: 'bronze',
                    walletAddress: paymentMethod === 'USDT' ? walletAddress : undefined,
                    referralCode: brokerCode || undefined
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Purchase failed');
            }
            setSuccess('Token purchase request submitted!');
            setAmount('');
            setWalletAddress('');
            loadPresaleData();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('authToken');
    return (<div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <nav className="hidden md:flex items-center space-x-4">
            <a href="/landing" className="text-sm font-medium hover:text-primary">Home</a>
            <a href="/dashboard" className="text-sm font-medium hover:text-primary">Trading</a>
            <a href="/token-presale" className="text-sm font-medium text-primary">Presale</a>
          </nav>
          <div className="flex items-center space-x-2">
            {!isAuthenticated ? (<>
                <button_1.Button variant="ghost" size="sm" asChild>
                  <a href="/auth">Sign In</a>
                </button_1.Button>
                <button_1.Button size="sm" asChild>
                  <a href="/dashboard">Launch App</a>
                </button_1.Button>
              </>) : (<button_1.Button variant="ghost" size="sm" asChild>
                <a href="/dashboard">
                  <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
                  Back to Dashboard
                </a>
              </button_1.Button>)}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-center mb-4">
            <lucide_react_1.Coins className="h-16 w-16 text-primary"/>
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
          <card_1.Card>
            <card_1.CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Raised</p>
                  <p className="text-2xl font-bold">
                    ${presaleData?.totalRaised?.toLocaleString() || '0'}
                  </p>
                </div>
                <lucide_react_1.DollarSign className="h-8 w-8 text-primary"/>
              </div>
            </card_1.CardContent>
          </card_1.Card>
          <card_1.Card>
            <card_1.CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target</p>
                  <p className="text-2xl font-bold">
                    ${presaleData?.target?.toLocaleString() || '1,000,000'}
                  </p>
                </div>
                <lucide_react_1.Target className="h-8 w-8 text-primary"/>
              </div>
            </card_1.CardContent>
          </card_1.Card>
          <card_1.Card>
            <card_1.CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Participants</p>
                  <p className="text-2xl font-bold">
                    {presaleData?.participants || '0'}
                  </p>
                </div>
                <lucide_react_1.Users className="h-8 w-8 text-primary"/>
              </div>
            </card_1.CardContent>
          </card_1.Card>
          <card_1.Card>
            <card_1.CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time Remaining</p>
                  <p className="text-2xl font-bold">
                    {presaleData?.timeRemaining || '30 days'}
                  </p>
                </div>
                <lucide_react_1.Clock className="h-8 w-8 text-primary"/>
              </div>
            </card_1.CardContent>
          </card_1.Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Purchase Form */}
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle className="flex items-center space-x-2">
                <lucide_react_1.TrendingUp className="h-5 w-5"/>
                <span>Purchase THAL Tokens</span>
              </card_1.CardTitle>
              <card_1.CardDescription>
                Buy THAL tokens at presale prices with USDT
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

              {!isAuthenticated && (<alert_1.Alert>
                  <alert_1.AlertDescription>
                    <a href="/auth" className="text-primary underline">Sign in</a> to purchase tokens
                  </alert_1.AlertDescription>
                </alert_1.Alert>)}

              <form onSubmit={handlePurchase} className="space-y-4">
                <div className="space-y-2">
                  <label_1.Label htmlFor="amount">Amount (USDT)</label_1.Label>
                  <input_1.Input id="amount" type="number" step="0.01" placeholder="100.00" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={isLoading || !isAuthenticated}/>
                  <p className="text-xs text-muted-foreground">
                    Minimum purchase: $50 USDT
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Presale Price:</span>
                    <span className="font-medium">1 THAL = $0.10 USDT</span>
                  </div>
                  {amount && (<>
                      <div className="flex justify-between text-sm mb-2">
                        <span>You'll receive:</span>
                        <span className="font-medium">
                          {(parseFloat(amount) / 0.10).toLocaleString()} THAL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Cost:</span>
                        <span className="font-medium">${parseFloat(amount).toLocaleString()} USDT</span>
                      </div>
                    </>)}
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <label_1.Label>Payment Method</label_1.Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="pm" value="USDT" checked={paymentMethod === 'USDT'} onChange={() => setPaymentMethod('USDT')}/>
                      USDT (Web3)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="pm" value="BANK_TRANSFER" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')}/>
                      Bank Transfer (FIAT)
                    </label>
                  </div>
                </div>

                {paymentMethod === 'USDT' && (<div className="space-y-2">
                    <label_1.Label htmlFor="wallet">Wallet Address</label_1.Label>
                    <input_1.Input id="wallet" placeholder="0x..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}/>
                  </div>)}

                <div className="space-y-2">
                  <label_1.Label htmlFor="broker">Broker Code (optional)</label_1.Label>
                  <input_1.Input id="broker" placeholder="BROKER123" value={brokerCode} onChange={(e) => setBrokerCode(e.target.value)}/>
                </div>

                <button_1.Button type="submit" className="w-full h-12" disabled={isLoading || !isAuthenticated || !amount}>
                  {isLoading ? (<>
                      <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                      Processing...
                    </>) : (<>
                      <lucide_react_1.Wallet className="mr-2 h-4 w-4"/>
                      Purchase THAL Tokens
                    </>)}
                </button_1.Button>
              </form>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {['50', '100', '500', '1000'].map((value) => (<button_1.Button key={value} variant="outline" size="sm" onClick={() => setAmount(value)} disabled={isLoading || !isAuthenticated}>
                    ${value}
                  </button_1.Button>))}
              </div>
            </card_1.CardContent>
          </card_1.Card>

          {/* Presale Info */}
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Presale Details</card_1.CardTitle>
              <card_1.CardDescription>
                Important information about the THAL token presale
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-4">
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
                <button_1.Button variant="outline" className="w-full" asChild>
                  <a href="/landing">Back to Home</a>
                </button_1.Button>
              </div>
            </card_1.CardContent>
          </card_1.Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/95 mt-24">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <span className="font-semibold">ThaliumX</span>
          </div>
          <nav className="flex items-center space-x-4 text-sm">
            <a href="/landing" className="text-muted-foreground hover:text-primary">Home</a>
            <a href="/dashboard" className="text-muted-foreground hover:text-primary">Trading</a>
            <a href="/token-presale" className="text-muted-foreground hover:text-primary">Presale</a>
          </nav>
          <p className="text-sm text-muted-foreground">
            © 2025 ThaliumX. All rights reserved.
          </p>
        </div>
      </footer>
    </div>);
}
//# sourceMappingURL=page.js.map