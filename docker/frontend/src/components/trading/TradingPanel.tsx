'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Calculator,
  AlertTriangle
} from 'lucide-react';
import { tradingOrderSchema, validateForm } from '@/lib/utils';

export function TradingPanel() {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderSide, setOrderSide] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Fetch current BTC price on component mount
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      try {
        const response = await fetch('/api/market/prices/BTC');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setCurrentPrice(data.data.price);
          }
        }
      } catch (err) {
        console.error('Failed to fetch current price:', err);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchCurrentPrice();

    // Refresh price every 30 seconds
    const interval = setInterval(fetchCurrentPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  const estimatedTotal = currentPrice && orderSide === 'market'
    ? (parseFloat(amount) * currentPrice).toFixed(2)
    : currentPrice && orderSide === 'limit'
    ? (parseFloat(amount) * parseFloat(price || '0')).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate form data
    const orderData = {
      symbol: 'BTCUSDT',
      side: orderType as 'buy' | 'sell',
      type: orderSide as 'market' | 'limit',
      quantity: parseFloat(amount),
      price: orderSide === 'limit' ? parseFloat(price) : undefined,
    };

    const validation = validateForm(tradingOrderSchema, orderData);
    if (!validation.success) {
      setError(Object.values(validation.errors)[0] || 'Please check your input');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/trading/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Order failed');
      }

      setSuccess('Order placed successfully!');
      setAmount('');
      setPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="h-5 w-5" />
          <span>Place Order</span>
        </CardTitle>
        <CardDescription>
          Trade BTC/USDT with advanced order types
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
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {/* Order Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={orderType === 'buy' ? 'default' : 'outline'}
            onClick={() => setOrderType('buy')}
            className="h-12"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Buy
          </Button>
          <Button
            variant={orderType === 'sell' ? 'default' : 'outline'}
            onClick={() => setOrderType('sell')}
            className="h-12"
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            Sell
          </Button>
        </div>

        {/* Order Side Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={orderSide === 'market' ? 'default' : 'outline'}
            onClick={() => setOrderSide('market')}
            size="sm"
          >
            Market
          </Button>
          <Button
            variant={orderSide === 'limit' ? 'default' : 'outline'}
            onClick={() => setOrderSide('limit')}
            size="sm"
          >
            Limit
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (BTC)</Label>
            <Input
              id="amount"
              type="number"
              step="0.00001"
              placeholder="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {/* Price Input (for limit orders) */}
          {orderSide === 'limit' && (
            <div className="space-y-2">
              <Label htmlFor="price">Price (USDT)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="45000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          {/* Current Price Display */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Current Price:</span>
              <span className="font-medium">
                {priceLoading ? 'Loading...' : currentPrice ? `$${currentPrice.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            {orderSide === 'market' && amount && (
              <div className="flex justify-between text-sm mt-1">
                <span>Estimated Total:</span>
                <span className="font-medium">${estimatedTotal}</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-12" 
            disabled={isLoading || !amount || (orderSide === 'limit' && !price)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing Order...
              </>
            ) : (
              `${orderType.toUpperCase()} ${orderSide === 'market' ? 'at Market' : 'Limit Order'}`
            )}
          </Button>
        </form>

        {/* Quick Amount Buttons */}
        <div className="space-y-2">
          <Label className="text-sm">Quick Amount</Label>
          <div className="grid grid-cols-4 gap-2">
            {['25%', '50%', '75%', '100%'].map((percentage) => (
              <Button
                key={percentage}
                variant="outline"
                size="sm"
                onClick={() => {
                  // Mock balance calculation
                  const balance = 0.1; // Mock BTC balance
                  const percentageValue = parseFloat(percentage) / 100;
                  setAmount((balance * percentageValue).toFixed(5));
                }}
                disabled={isLoading}
              >
                {percentage}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
