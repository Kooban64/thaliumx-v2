'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, TrendingUp, Zap, Globe } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { cn } from '@/lib/utils';
import type { ExchangeType } from '@/types/trading';

interface ExchangeOption {
  id: ExchangeType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  status: 'online' | 'offline' | 'maintenance';
  health: {
    responseTime: number;
    uptime: number;
  };
  requiresKYC?: string;
}

const exchanges: ExchangeOption[] = [
  {
    id: 'cex',
    name: 'Native CEX',
    description: 'Platform-owned exchange with THAL token rewards and liquidity incentives',
    icon: TrendingUp,
    features: [
      'THAL token rewards',
      'Liquidity incentives',
      'Advanced order types',
      'Low fees',
    ],
    status: 'online',
    health: {
      responseTime: 50,
      uptime: 99.9,
    },
  },
  {
    id: 'omni',
    name: 'Omni-Exchange',
    description: 'Multi-exchange aggregator with auto-routing to best prices',
    icon: Zap,
    features: [
      'Multi-exchange aggregation',
      'Auto-routing',
      'Best price guarantee',
      'KuCoin, Bybit, OKX, Kraken, VALR, Bitstamp, Crypto.com',
    ],
    status: 'online',
    health: {
      responseTime: 120,
      uptime: 99.5,
    },
    requiresKYC: 'L1',
  },
  {
    id: 'dex',
    name: 'DEX',
    description: 'Decentralized exchange for token swaps and liquidity pools',
    icon: Globe,
    features: [
      'Decentralized trading',
      'Token swaps',
      'Liquidity pools',
      'Web3 wallet required',
    ],
    status: 'online',
    health: {
      responseTime: 200,
      uptime: 98.0,
    },
    requiresKYC: 'L2',
  },
];

/**
 * ExchangeSelector - Component for selecting exchange type
 * Shows available exchanges with their features and health status
 */
export function ExchangeSelector() {
  const { selectedExchange, setSelectedExchange } = useTradingStore();
  const [hoveredExchange, setHoveredExchange] = useState<ExchangeType | null>(null);

  const getStatusIcon = (status: ExchangeOption['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: ExchangeOption['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Exchange</h3>
        <p className="text-sm text-muted-foreground">
          Choose the exchange type that best suits your trading needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exchanges.map((exchange) => {
          const Icon = exchange.icon;
          const isSelected = selectedExchange === exchange.id;
          const isHovered = hoveredExchange === exchange.id;

          return (
            <Card
              key={exchange.id}
              className={cn(
                'cursor-pointer transition-all',
                isSelected && 'ring-2 ring-primary',
                isHovered && !isSelected && 'ring-1 ring-border',
              )}
              onClick={() => setSelectedExchange(exchange.id)}
              onMouseEnter={() => setHoveredExchange(exchange.id)}
              onMouseLeave={() => setHoveredExchange(null)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{exchange.name}</CardTitle>
                  </div>
                  {getStatusIcon(exchange.status)}
                </div>
                <CardDescription>{exchange.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(exchange.status)}>
                    {exchange.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {exchange.health.uptime}% uptime
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Features:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {exchange.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {exchange.requiresKYC && (
                  <div className="text-xs text-muted-foreground">
                    Requires KYC Level: {exchange.requiresKYC}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Avg. Response: {exchange.health.responseTime}ms
                </div>

                {isSelected && (
                  <Button className="w-full" size="sm">
                    Selected
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
