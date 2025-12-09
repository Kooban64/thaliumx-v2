'use client';

import { useEffect, useState } from 'react';

export default function VestingPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('authToken') || '';
        // We need userId from token/session; assume API infers from auth
        const res = await fetch('/api/presale/vesting/user/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
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
      <h1 className="text-2xl font-semibold mb-4">My Vesting Schedules</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="space-y-3">
          {items.length === 0 && <div>No vesting schedules found.</div>}
          {items.map((v: any) => (
            <div key={v.scheduleId} className="border rounded p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">Schedule: {v.scheduleId}</div>
                  <div className="text-sm text-gray-600">Investment: {v.investmentId}</div>
                </div>
                <div className="text-right">
                  <div>Total: {v.totalAmount}</div>
                  <div>Released: {v.releasedAmount}</div>
                  <div>Releasable: {v.releasableAmount}</div>
                </div>
              </div>
              <div className="text-sm mt-2">
                <div>Cliff: {v.cliffDuration} days</div>
                <div>Vesting: {v.vestingDuration} days</div>
                <div>Last Claim: {v.lastClaimTime}</div>
                <div>Next Claim: {v.nextClaimAvailable}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


