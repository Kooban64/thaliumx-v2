'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingPanel = TradingPanel;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function TradingPanel() {
    const [orderType, setOrderType] = (0, react_1.useState)('buy');
    const [orderSide, setOrderSide] = (0, react_1.useState)('market');
    const [amount, setAmount] = (0, react_1.useState)('');
    const [price, setPrice] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [success, setSuccess] = (0, react_1.useState)('');
    const currentPrice = 45000; // Mock current price
    const estimatedTotal = orderSide === 'market'
        ? (parseFloat(amount) * currentPrice).toFixed(2)
        : (parseFloat(amount) * parseFloat(price || '0')).toFixed(2);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/trading/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    symbol: 'BTCUSDT',
                    side: orderType,
                    type: orderSide,
                    quantity: parseFloat(amount),
                    price: orderSide === 'limit' ? parseFloat(price) : undefined,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Order failed');
            }
            setSuccess('Order placed successfully!');
            setAmount('');
            setPrice('');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<card_1.Card>
      <card_1.CardHeader>
        <card_1.CardTitle className="flex items-center space-x-2">
          <lucide_react_1.Calculator className="h-5 w-5"/>
          <span>Place Order</span>
        </card_1.CardTitle>
        <card_1.CardDescription>
          Trade BTC/USDT with advanced order types
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent className="space-y-4">
        {error && (<alert_1.Alert variant="destructive">
            <lucide_react_1.AlertTriangle className="h-4 w-4"/>
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {success && (<alert_1.Alert>
            <alert_1.AlertDescription className="text-green-600">{success}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {/* Order Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button_1.Button variant={orderType === 'buy' ? 'default' : 'outline'} onClick={() => setOrderType('buy')} className="h-12">
            <lucide_react_1.TrendingUp className="mr-2 h-4 w-4"/>
            Buy
          </button_1.Button>
          <button_1.Button variant={orderType === 'sell' ? 'default' : 'outline'} onClick={() => setOrderType('sell')} className="h-12">
            <lucide_react_1.TrendingDown className="mr-2 h-4 w-4"/>
            Sell
          </button_1.Button>
        </div>

        {/* Order Side Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button_1.Button variant={orderSide === 'market' ? 'default' : 'outline'} onClick={() => setOrderSide('market')} size="sm">
            Market
          </button_1.Button>
          <button_1.Button variant={orderSide === 'limit' ? 'default' : 'outline'} onClick={() => setOrderSide('limit')} size="sm">
            Limit
          </button_1.Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <label_1.Label htmlFor="amount">Amount (BTC)</label_1.Label>
            <input_1.Input id="amount" type="number" step="0.00001" placeholder="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={isLoading}/>
          </div>

          {/* Price Input (for limit orders) */}
          {orderSide === 'limit' && (<div className="space-y-2">
              <label_1.Label htmlFor="price">Price (USDT)</label_1.Label>
              <input_1.Input id="price" type="number" step="0.01" placeholder="45000" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={isLoading}/>
            </div>)}

          {/* Current Price Display */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Current Price:</span>
              <span className="font-medium">${currentPrice.toLocaleString()}</span>
            </div>
            {orderSide === 'market' && amount && (<div className="flex justify-between text-sm mt-1">
                <span>Estimated Total:</span>
                <span className="font-medium">${estimatedTotal}</span>
              </div>)}
          </div>

          {/* Submit Button */}
          <button_1.Button type="submit" className="w-full h-12" disabled={isLoading || !amount || (orderSide === 'limit' && !price)}>
            {isLoading ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Placing Order...
              </>) : (`${orderType.toUpperCase()} ${orderSide === 'market' ? 'at Market' : 'Limit Order'}`)}
          </button_1.Button>
        </form>

        {/* Quick Amount Buttons */}
        <div className="space-y-2">
          <label_1.Label className="text-sm">Quick Amount</label_1.Label>
          <div className="grid grid-cols-4 gap-2">
            {['25%', '50%', '75%', '100%'].map((percentage) => (<button_1.Button key={percentage} variant="outline" size="sm" onClick={() => {
                // Mock balance calculation
                const balance = 0.1; // Mock BTC balance
                const percentageValue = parseFloat(percentage) / 100;
                setAmount((balance * percentageValue).toFixed(5));
            }} disabled={isLoading}>
                {percentage}
              </button_1.Button>))}
          </div>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
//# sourceMappingURL=TradingPanel.js.map