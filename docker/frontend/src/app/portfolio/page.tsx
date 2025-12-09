'use client';

import { useEffect, useState } from 'react';

export default function PortfolioPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/presale/investments', {
          credentials: 'include' // Include cookies
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to load');
        setItems(data.data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">My Presale Purchases</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="space-y-3">
          {items.length === 0 && <div>No purchases found.</div>}
          {items.map((inv: any) => (
            <div key={inv.id} className="border rounded p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">Presale: {inv.presaleId}</div>
                  <div className="text-sm text-gray-600">Tier: {inv.tier}</div>
                </div>
                <div className="text-right">
                  <div>Amount: {inv.amount}</div>
                  <div>Tokens: {inv.tokenAmount}</div>
                </div>
              </div>
              <div className="text-sm mt-2">
                <div>Status: {inv.status}</div>
                <div>Payment: {inv.paymentMethod}</div>
                <div>Platform Fee: {inv.metadata?.platformFee || '0'}</div>
                <div>Processor Fee: {inv.metadata?.paymentProcessorFee || '0'}</div>
                <div>Network Fee Est.: {inv.metadata?.networkFeeEstimate || '0'}</div>
                <div>Total Fees: {inv.metadata?.totalFees || '0'}</div>
                {inv.transactionHash && (
                  <div className="truncate">Tx: {inv.transactionHash}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


