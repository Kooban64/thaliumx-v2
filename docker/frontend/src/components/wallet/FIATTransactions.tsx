'use client';

import type { Wallet as WalletType } from '@/types/wallet';
import { HotWalletTransactions } from './HotWalletTransactions';

interface FIATTransactionsProps {
  wallet: WalletType | null;
}

/**
 * FIATTransactions - Display transaction history for FIAT wallet
 * Reuses HotWalletTransactions component with FIAT-specific styling
 */
export function FIATTransactions({ wallet }: FIATTransactionsProps) {
  return <HotWalletTransactions wallet={wallet} />;
}
