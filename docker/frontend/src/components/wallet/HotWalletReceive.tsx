'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, QrCode, AlertCircle } from 'lucide-react';
import type { Wallet as WalletType } from '@/types/wallet';
import { useWallet } from '@/lib/api/hooks/useWallet';

interface HotWalletReceiveProps {
  wallet: WalletType | null;
}

/**
 * HotWalletReceive - Receive funds to hot wallet
 */
export function HotWalletReceive({ wallet }: HotWalletReceiveProps) {
  const { data: walletData } = useWallet(wallet?.id || '');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!wallet) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a wallet
        </CardContent>
      </Card>
    );
  }

  const address = walletData?.address || wallet.address || '';

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!address) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Wallet address not available. Please contact support.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Address Display */}
      <Card>
        <CardHeader>
          <CardTitle>Receive {wallet.currency}</CardTitle>
          <CardDescription>
            Send funds to this address. Only send {wallet.currency} to this address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="flex gap-2">
              <Input
                value={address}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowQR(!showQR)}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {showQR ? 'Hide' : 'Show'} QR Code
          </Button>

          {showQR && (
            <div className="flex justify-center p-4 bg-white rounded-lg">
              {/* QR Code would be generated here - using placeholder */}
              <div className="w-64 h-64 bg-muted flex items-center justify-center rounded">
                <QrCode className="h-32 w-32 text-muted-foreground" />
              </div>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Important:</strong> Only send {wallet.currency} to this address.
              Sending other cryptocurrencies may result in permanent loss of funds.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Receive Funds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                1
              </div>
              <div>
                <div className="font-medium">Copy your wallet address</div>
                <div className="text-sm text-muted-foreground">
                  Click the copy button to copy your address to clipboard
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                2
              </div>
              <div>
                <div className="font-medium">Send funds from external wallet</div>
                <div className="text-sm text-muted-foreground">
                  Paste the address in your external wallet or exchange
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                3
              </div>
              <div>
                <div className="font-medium">Wait for confirmation</div>
                <div className="text-sm text-muted-foreground">
                  Funds will appear in your wallet after network confirmation
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Network Information</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Network: {wallet.metadata.network || 'N/A'}</div>
              <div>Currency: {wallet.currency}</div>
              <div>Minimum Deposit: Check network requirements</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
