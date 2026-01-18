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
import { tradingOrderSchema, validateForm, rateLimitedApiCall } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import { useUserWorkflows } from '@/lib/api/hooks/workflows';
import { WorkflowType } from '@/lib/api/types/workflows';
import { WorkflowStatusCard } from '@/components/workflows/WorkflowStatusCard';

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
  const [recentOrderWorkflowId, setRecentOrderWorkflowId] = useState<string | null>(null);
  
  // Get user ID from auth (simplified - in real app would come from auth context)
  const [userId, setUserId] = useState<string | null>(null);
  
  // Fetch recent trading order workflows
  const { data: workflowsData } = useUserWorkflows(userId || null, {
    workflowType: WorkflowType.TRADING_ORDER,
    limit: 1
  });
  
  // Track most recent order workflow
  useEffect(() => {
    if (workflowsData?.workflows && workflowsData.workflows.length > 0) {
      const latest = workflowsData.workflows[0];
      if (latest && (latest.status === 'running' || latest.status === 'pending')) {
        setRecentOrderWorkflowId(latest.workflowId);
      }
    }
  }, [workflowsData]);
  
  // Get user ID on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiClient.get<{ id: string }>('/api/auth/profile');
        if (response.success && response.data?.id) {
          setUserId(response.data.id);
        }
      } catch (error) {
        // Ignore errors
      }
    };
    fetchUser();
  }, []);

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
        // Silently handle price fetch errors in production
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to fetch current price:', err);
        }
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
      await rateLimitedApiCall(async () => {
        const response = await apiClient.post('/api/trading/order', orderData);

        if (!response.success) {
          throw new Error(response.error || response.message || 'Order failed');
        }

        setSuccess('Order placed successfully!');
        setAmount('');
        setPrice('');
      }, 'trading-order', 5, 60000); // 5 orders per minute
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

        {/* Show workflow status if order is processing */}
        {recentOrderWorkflowId && workflowsData?.workflows && (
          <div className="mt-4">
            {workflowsData.workflows
              .filter((w: any) => w.workflowId === recentOrderWorkflowId)
              .map((workflow: any) => (
                <WorkflowStatusCard
                  key={workflow.workflowId}
                  workflow={workflow}
                  showActions={false}
                  className="border-blue-200"
                />
              ))}
          </div>
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
                onClick={async () => {
                  try {
                    // Fetch actual balance from API
                    const res = await apiClient.get<{ available_balance: string; total_balance: string }>(
                      '/api/wallets/balance/BTC',
                    );
                    if (res.success && res.data) {
                      const bal = parseFloat(res.data.available_balance || '0') || 0;
                      const percentageValue = parseFloat(percentage) / 100;
                      setAmount((bal * percentageValue).toFixed(8));
                    }
                  } catch (error) {
                    console.warn('Failed to fetch balance for quick amount:', error);
                    // Fallback to small amount if balance fetch fails
                    setAmount('0.001');
                  }
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
