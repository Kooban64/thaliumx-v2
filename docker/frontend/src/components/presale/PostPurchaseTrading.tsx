'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ArrowRight, CheckCircle, Coins } from 'lucide-react';

interface PostPurchaseTradingProps {
  investmentAmount: number;
  tokenAmount: number;
  kycLevel: string;
  features?: string[];
  className?: string;
}

export function PostPurchaseTrading({ investmentAmount, tokenAmount, kycLevel, features = [], className }: PostPurchaseTradingProps) {
  const getFeatures = (level: string): string[] => {
    const featureMap: Record<string, string[]> = {
      L0: ['View Market Data', 'View Portfolio'],
      L1: ['View Market Data', 'View Portfolio', 'Basic Trading', 'Spot Trading'],
      L2: ['View Market Data', 'View Portfolio', 'Basic Trading', 'Spot Trading', 'Advanced Trading', 'Margin Trading'],
      L3: ['View Market Data', 'View Portfolio', 'Basic Trading', 'Spot Trading', 'Advanced Trading', 'Margin Trading', 'Futures Trading'],
      INSTITUTIONAL: ['All Features', 'API Access', 'Custom Solutions']
    };
    return features.length > 0 ? features : (featureMap[level] ?? featureMap.L0 ?? []);
  };

  const availableFeatures = getFeatures(kycLevel);

  return (
    <Card className={className}>
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Your Tokens Are Ready!
            </CardTitle>
            <CardDescription className="mt-2">Congratulations! Your presale investment has been confirmed.</CardDescription>
          </div>
          <Badge variant="outline" className="text-lg">{kycLevel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Investment Amount</div>
            <div className="text-2xl font-bold">${investmentAmount.toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Tokens Received</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {tokenAmount.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5" />Start Trading Now</h3>
          <p className="text-sm text-muted-foreground mb-4">Your trading account is ready! You can now access the main platform and start trading.</p>
          <Button size="lg" className="w-full" onClick={() => window.location.href = '/trading'}>
            Go to Trading Dashboard <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-3">Available Features</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>{feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
