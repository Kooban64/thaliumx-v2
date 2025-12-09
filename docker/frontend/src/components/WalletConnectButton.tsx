'use client';

import { useEffect, useState } from 'react';

export default function WalletConnectButton() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setError(null);
    try {
      const { ethereum } = window as any;
      if (!ethereum) {
        setError('No Ethereum provider found. Please install MetaMask.');
        return;
      }
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts?.[0] || null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const { ethereum } = window as any;
    if (ethereum && ethereum.selectedAddress) {
      setAccount(ethereum.selectedAddress);
    }
  }, []);

  return (
    <div>
      <button onClick={connect} className="px-3 py-1 border rounded">
        {account ? `Connected: ${account.slice(0,6)}...${account.slice(-4)}` : 'Connect Wallet'}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}


