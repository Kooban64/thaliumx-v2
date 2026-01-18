'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, TrendingUp, ExternalLink, Loader2, Clock } from 'lucide-react';
import { logNetworkError } from '@/lib/services/errorLogger';

interface ThalTokenData {
  balance: number;
  balanceFormatted: string;
  investments: Array<{
    id: string;
    amount: number;
    tokens: number;
    status: string;
    createdAt: string;
    tokenType?: 'vested' | 'liquid'; // Token type: vested (presale) or liquid (post-presale)
    vestingScheduleId?: string;
  }>;
  totalInvested: number;
  totalTokens: number;
  vestedTokens: number; // Tokens locked in vesting
  liquidTokens: number; // Tokens available for trading
}

/**
 * THAL Token Section Component
 * 
 * Displays THAL token information for users:
 * - Token balance
 * - Presale investments
 * - Total tokens owned
 * - Link to presale page
 */
export function ThalTokenSection() {
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<ThalTokenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadThalTokenData();
  }, []);

  const loadThalTokenData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user investments
      const investmentsResponse = await fetch('/api/presale/investments', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (investmentsResponse.ok) {
        const investmentsData = await investmentsResponse.json();
        const investments = investmentsData.data || [];

        // Calculate totals
        const totalInvested = investments.reduce((sum: number, inv: any) => {
          return sum + (parseFloat(inv.amount) || 0);
        }, 0);

        const totalTokens = investments.reduce((sum: number, inv: any) => {
          return sum + (parseFloat(inv.tokenAmount) || parseFloat(inv.tokens) || 0);
        }, 0);

        // Separate vested and liquid tokens
        const vestedTokens = investments.reduce((sum: number, inv: any) => {
          const tokenType = inv.metadata?.tokenType || inv.tokenType || 'vested'; // Default to vested for presale
          if (tokenType === 'vested') {
            return sum + (parseFloat(inv.tokenAmount) || parseFloat(inv.tokens) || 0);
          }
          return sum;
        }, 0);

        const liquidTokens = investments.reduce((sum: number, inv: any) => {
          const tokenType = inv.metadata?.tokenType || inv.tokenType || 'vested';
          if (tokenType === 'liquid') {
            return sum + (parseFloat(inv.tokenAmount) || parseFloat(inv.tokens) || 0);
          }
          return sum;
        }, 0);

        setTokenData({
          balance: totalTokens,
          balanceFormatted: totalTokens.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          }),
          investments: investments.map((inv: any) => ({
            id: inv.id,
            amount: parseFloat(inv.amount) || 0,
            tokens: parseFloat(inv.tokenAmount) || parseFloat(inv.tokens) || 0,
            status: inv.status || 'pending',
            createdAt: inv.createdAt || inv.created_at || '',
            tokenType: inv.metadata?.tokenType || inv.tokenType || 'vested',
            vestingScheduleId: inv.metadata?.vestingScheduleId || inv.vestingScheduleId,
          })),
          totalInvested,
          totalTokens,
          vestedTokens,
          liquidTokens,
        });
      } else {
        // If no investments, set empty data
        setTokenData({
          balance: 0,
          balanceFormatted: '0.00',
          investments: [],
          totalInvested: 0,
          totalTokens: 0,
          vestedTokens: 0,
          liquidTokens: 0,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load THAL token data';
      setError(errorMessage);
      logNetworkError(err, { endpoint: '/api/presale/investments', component: 'ThalTokenSection' });
      
      // Set empty data on error
      setTokenData({
        balance: 0,
        balanceFormatted: '0.00',
        investments: [],
        totalInvested: 0,
        totalTokens: 0,
        vestedTokens: 0,
        liquidTokens: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && !tokenData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            THAL Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load THAL token data</p>
        </CardContent>
      </Card>
    );
  }

  const hasInvestments = tokenData && tokenData.investments.length > 0;
  const hasBalance = tokenData && tokenData.totalTokens > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle>THAL Tokens</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/token-presale'}
          >
            View Presale
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Your THAL token balance and presale investments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Balance */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total THAL Tokens</p>
            <p className="text-2xl font-bold">
              {tokenData?.balanceFormatted || '0.00'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Invested</p>
            <p className="text-2xl font-bold">
              ${tokenData?.totalInvested.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}
            </p>
          </div>
        </div>

        {/* Vested vs Liquid Tokens */}
        {tokenData && (tokenData.vestedTokens > 0 || tokenData.liquidTokens > 0) && (
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Vested (Locked)
              </p>
              <p className="text-xl font-semibold text-amber-600">
                {tokenData.vestedTokens.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                Tokens locked in vesting schedule
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Liquid (Available)
              </p>
              <p className="text-xl font-semibold text-green-600">
                {tokenData.liquidTokens.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                Tokens available for trading
              </p>
            </div>
          </div>
        )}

        {/* Investment Status */}
        {hasInvestments ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Investments</p>
            <div className="space-y-2">
              {tokenData.investments.slice(0, 3).map((investment) => (
                <div
                  key={investment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Coins className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {investment.tokens.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 8,
                        })} THAL
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${investment.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      investment.status === 'completed' || investment.status === 'confirmed'
                        ? 'default'
                        : investment.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {investment.status}
                  </Badge>
                </div>
              ))}
            </div>
            {tokenData.investments.length > 3 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.location.href = '/token-presale'}
              >
                View All Investments
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">No THAL token investments yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/token-presale'}
            >
              <Coins className="mr-2 h-4 w-4" />
              Purchase THAL Tokens
            </Button>
          </div>
        )}

        {/* Quick Actions */}
        {hasBalance && (
          <div className="pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.location.href = '/dashboard/trading'}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Trade THAL
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.location.href = '/token-presale'}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Presale
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
