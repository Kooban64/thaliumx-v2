'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Using simple button-based tabs
// Unused imports removed
// import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { logNetworkError } from '@/lib/services/errorLogger';

/**
 * LiquidityPool - DEX liquidity pool management
 */
export function LiquidityPool() {
  const [pools, setPools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const response = await fetch('/api/dex/pools');
        if (response.ok) {
          const data = await response.json();
          setPools(data.data || data.pools || []);
        }
      } catch (error) {
        logNetworkError(error, { endpoint: '/api/dex/pools', component: 'LiquidityPool' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPools();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidity Pools</CardTitle>
        <CardDescription>Manage your liquidity positions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2 border-b">
            <button className="px-4 py-2 border-b-2 border-primary font-medium">Pools</button>
            <button className="px-4 py-2 text-muted-foreground">Add Liquidity</button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pools.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No liquidity pools found
              </div>
            ) : (
              <div className="space-y-2">
                {pools.map((pool) => (
                  <div key={pool.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {pool.token0}/{pool.token1}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {pool.apy}% APY
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
