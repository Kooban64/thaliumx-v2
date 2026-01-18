'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowDownUp, Loader2, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { toast } from '@/components/shared/Toast';

/**
 * TokenSwap - DEX token swap interface
 */
export function TokenSwap() {
  const [tokenIn, setTokenIn] = useState('ETH');
  const [tokenOut, setTokenOut] = useState('USDT');
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [error, setError] = useState('');
  const [estimatedGas, setEstimatedGas] = useState<number | null>(null);

  // Fetch quote when amount or tokens change
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setAmountOut('');
      setEstimatedGas(null);
      return;
    }

    const fetchQuote = async () => {
      setIsFetchingQuote(true);
      try {
        const response = await apiClient.post('/api/dex/quotes', {
          tokenIn,
          tokenOut,
          amountIn: amountIn,
          slippage: parseFloat(slippage),
        });

        if (response.success && response.data) {
          const data = response.data as any;
          setAmountOut(data.amountOut?.toString() || data.bestQuote?.amountOut?.toString() || '');
          setEstimatedGas(data.estimatedGas || data.bestQuote?.gasEstimate || null);
        } else {
          setAmountOut('');
          setEstimatedGas(null);
        }
      } catch (err) {
        // Silently fail quote fetching - user can still attempt swap
        setAmountOut('');
        setEstimatedGas(null);
      } finally {
        setIsFetchingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [amountIn, tokenIn, tokenOut, slippage]);

  const handleSwap = async () => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setError('Please enter an amount');
      return;
    }

    if (!amountOut || parseFloat(amountOut) <= 0) {
      setError('Unable to get quote. Please try again.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/dex/swap', {
        tokenIn,
        tokenOut,
        amountIn: parseFloat(amountIn),
        slippage: parseFloat(slippage),
      });

      if (!response.success) {
        throw new Error(response.error || 'Swap failed');
      }

      toast({
        type: 'success',
        title: 'Swap Successful',
        description: `Swapped ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut}`,
      });

      // Reset form
      setAmountIn('');
      setAmountOut('');
      setEstimatedGas(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Swap failed';
      setError(errorMessage);
      toast({
        type: 'error',
        title: 'Swap Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Swap</CardTitle>
        <CardDescription>Swap tokens on decentralized exchange</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Token In */}
        <div className="space-y-2">
          <Label>From</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              className="w-24"
            />
            <Input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const temp = tokenIn;
              setTokenIn(tokenOut);
              setTokenOut(temp);
              const tempAmount = amountIn;
              setAmountIn(amountOut);
              setAmountOut(tempAmount);
            }}
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Token Out */}
        <div className="space-y-2">
          <Label>To</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              className="w-24"
            />
            <div className="flex-1 relative">
              <Input
                type="number"
                placeholder="0.0"
                value={amountOut}
                readOnly
                className="bg-muted pr-10"
              />
              {isFetchingQuote && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-2">
          <Label>Slippage Tolerance (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
        </div>

        {/* Gas Estimate */}
        {estimatedGas && (
          <div className="text-sm text-muted-foreground">
            Estimated Gas: {estimatedGas} GWEI
          </div>
        )}

        {/* Swap Button */}
        <Button
          className="w-full"
          onClick={handleSwap}
          disabled={isLoading || !amountIn || !amountOut}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Swapping...
            </>
          ) : (
            'Swap'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
