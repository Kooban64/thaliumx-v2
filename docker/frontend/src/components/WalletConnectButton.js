'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WalletConnectButton;
const react_1 = require("react");
function WalletConnectButton() {
    const [account, setAccount] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const connect = async () => {
        setError(null);
        try {
            const { ethereum } = window;
            if (!ethereum) {
                setError('No Ethereum provider found. Please install MetaMask.');
                return;
            }
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            setAccount(accounts?.[0] || null);
        }
        catch (e) {
            setError(e.message);
        }
    };
    (0, react_1.useEffect)(() => {
        const { ethereum } = window;
        if (ethereum && ethereum.selectedAddress) {
            setAccount(ethereum.selectedAddress);
        }
    }, []);
    return (<div>
      <button onClick={connect} className="px-3 py-1 border rounded">
        {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>);
}
//# sourceMappingURL=WalletConnectButton.js.map