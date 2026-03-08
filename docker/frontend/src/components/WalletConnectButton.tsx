'use client';

import { useEffect, useState } from 'react';

interface EthereumProvider {
  selectedAddress?: string;
  request: (args: { method: string }) => Promise<unknown>;
}

interface WindowWithEthereum extends Window {
  ethereum?: EthereumProvider;
}

export default function WalletConnectButton() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setError(null);
    try {
      const { ethereum } = window as WindowWithEthereum;
      if (!ethereum) {
        setError('No Ethereum provider found. Please install MetaMask.');
        return;
      }
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const firstAccount = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      setAccount(firstAccount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
    }
  };

  useEffect(() => {
    const { ethereum } = window as WindowWithEthereum;
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

