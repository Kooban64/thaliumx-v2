'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowDownUp, Loader2, AlertTriangle } from 'lucide-react';

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
  const [error, setError] = useState('');
  // const [estimatedGas, setEstimatedGas] = useState<number | null>(null);
  const [estimatedGas] = useState<number | null>(null);

  const handleSwap = async () => {
    setIsLoading(true);
    setError('');
    try {
      // TODO: Implement actual swap API call
      const response = await fetch('/api/dex/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn: parseFloat(amountIn),
          slippage: parseFloat(slippage),
        }),
      });

      if (!response.ok) {
        throw new Error('Swap failed');
      }

      // const data = await response.json();
      // Handle success
    } catch (err: any) {
      setError(err.message || 'Swap failed');
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
            <Input
              type="number"
              placeholder="0.0"
              value={amountOut}
              onChange={(e) => setAmountOut(e.target.value)}
              readOnly
              className="flex-1 bg-muted"
            />
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
