'use client';

import { useState, useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { ExchangeSelector } from './ExchangeSelector';
import { CEXTradingInterface } from './CEXTradingInterface';
import { OmniTradingInterface } from './OmniTradingInterface';
import { DEXTradingInterface } from './DEXTradingInterface';
import { RequireKYCLevel } from '@/components/rbac';

/**
 * TradingInterface - Main trading interface component
 * Handles exchange selection and renders appropriate trading interface
 */
export function TradingInterface() {
  const { selectedExchange, setSelectedExchange } = useTradingStore();
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);

  // Load exchange selection on mount if not set
  useEffect(() => {
    if (!selectedExchange) {
      setShowExchangeSelector(true);
    }
  }, [selectedExchange, setSelectedExchange]);

  // If exchange selector is shown, display it
  if (showExchangeSelector) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading</h1>
            <p className="text-muted-foreground">
              Select an exchange to start trading
            </p>
          </div>
        </div>
        <ExchangeSelector />
      </div>
    );
  }

  // Render exchange-specific interface
  const renderExchangeInterface = () => {
    switch (selectedExchange) {
      case 'cex':
        return <CEXTradingInterface />;
      case 'omni':
        return (
          <RequireKYCLevel level="L1" showUpgradePrompt={true}>
            <OmniTradingInterface />
          </RequireKYCLevel>
        );
      case 'dex':
        return (
          <RequireKYCLevel level="L2" showUpgradePrompt={true}>
            <DEXTradingInterface />
          </RequireKYCLevel>
        );
      default:
        return <CEXTradingInterface />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading</h1>
          <p className="text-muted-foreground">
            {selectedExchange === 'cex' && 'Native CEX - Platform Exchange'}
            {selectedExchange === 'omni' && 'Omni-Exchange - Multi-Exchange Aggregator'}
            {selectedExchange === 'dex' && 'DEX - Decentralized Exchange'}
          </p>
        </div>
        <button
          onClick={() => setShowExchangeSelector(true)}
          className="text-sm text-primary hover:underline"
        >
          Switch Exchange
        </button>
      </div>

      {/* Exchange-specific interface */}
      {renderExchangeInterface()}
    </div>
  );
}
