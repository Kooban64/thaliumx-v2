import { routes } from '@/lib/routes/config';
import type { SearchResult } from '@/components/navigation/Search';

/**
 * Default search function for global search
 * Searches through routes and common pages
 */
export function defaultSearch(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Common routes
  const commonRoutes = [
    { label: 'Dashboard', href: routes.dashboard.home, category: 'Navigation' },
    { label: 'Trading', href: routes.dashboard.trading, category: 'Trading' },
    { label: 'Wallet', href: routes.dashboard.wallet, category: 'Wallet' },
    { label: 'Portfolio', href: routes.dashboard.portfolio, category: 'Portfolio' },
    { label: 'Account Settings', href: routes.dashboard.account, category: 'Settings' },
    { label: 'KYC Status', href: routes.dashboard.accountKYC, category: 'Account' },
    { label: 'Transaction Limits', href: routes.dashboard.accountLimits, category: 'Account' },
    { label: 'Staking', href: routes.dashboard.staking, category: 'DeFi' },
    { label: 'NFT Marketplace', href: routes.dashboard.nft, category: 'NFT' },
    { label: 'DEX', href: routes.dashboard.dex, category: 'Trading' },
    { label: 'Market Data', href: routes.dashboard.market, category: 'Market' },
    { label: 'Presale', href: routes.presale, category: 'Investment' },
    { label: 'Support', href: routes.support, category: 'Support' },
  ];

  // Filter routes based on query
  commonRoutes.forEach((route) => {
    if (route.label.toLowerCase().includes(lowerQuery) || route.category.toLowerCase().includes(lowerQuery)) {
      results.push({
        id: route.href,
        label: route.label,
        href: route.href,
        description: `Go to ${route.label}`,
        category: route.category,
      });
    }
  });

  return results.slice(0, 10); // Limit to 10 results
}
