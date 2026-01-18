/**
 * Currency Configuration and Formatting Utilities
 * 
 * This module provides currency formatting utilities for the ThaliumX frontend.
 * It fetches currency configuration from the backend API and provides
 * consistent formatting across the application.
 */

// Default currency configuration (South African Rand)
const DEFAULT_CURRENCY = {
  code: 'ZAR',
  symbol: 'R',
  name: 'South African Rand',
  decimals: 2,
  locale: 'en-ZA'
};

// Cached currency configuration
let cachedCurrency: typeof DEFAULT_CURRENCY | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch currency configuration from the backend API
 */
export async function fetchCurrencyConfig(): Promise<typeof DEFAULT_CURRENCY> {
  // Return cached value if still valid
  if (cachedCurrency && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedCurrency;
  }

  try {
    const response = await fetch('/api/config/currency');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        cachedCurrency = data.data;
        cacheTimestamp = Date.now();
        return cachedCurrency!;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch currency config, using defaults:', error);
  }

  return DEFAULT_CURRENCY;
}

/**
 * Get the currency symbol
 */
export function getCurrencySymbol(): string {
  return cachedCurrency?.symbol || DEFAULT_CURRENCY.symbol;
}

/**
 * Get the currency code
 */
export function getCurrencyCode(): string {
  return cachedCurrency?.code || DEFAULT_CURRENCY.code;
}

/**
 * Format an amount with the configured currency
 * @param amount - The amount to format
 * @param options - Optional formatting options
 */
export function formatCurrency(
  amount: number,
  options?: {
    showSymbol?: boolean;
    showCode?: boolean;
    decimals?: number;
  }
): string {
  const currency = cachedCurrency || DEFAULT_CURRENCY;
  const { showSymbol = true, showCode = false, decimals = currency.decimals } = options || {};

  try {
    const formatted = new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);

    if (!showSymbol && !showCode) {
      // Return just the number
      return new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(amount);
    }

    if (showCode && !showSymbol) {
      // Return with code instead of symbol
      return `${amount.toFixed(decimals)} ${currency.code}`;
    }

    return formatted;
  } catch (error) {
    // Fallback formatting
    return `${currency.symbol}${amount.toFixed(decimals)}`;
  }
}

/**
 * Format an amount with a simple symbol prefix
 * @param amount - The amount to format
 */
export function formatAmountSimple(amount: number): string {
  const currency = cachedCurrency || DEFAULT_CURRENCY;
  return `${currency.symbol}${amount.toLocaleString(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals
  })}`;
}

/**
 * Format a large amount with abbreviations (K, M, B)
 * @param amount - The amount to format
 */
export function formatAmountAbbreviated(amount: number): string {
  const currency = cachedCurrency || DEFAULT_CURRENCY;
  const symbol = currency.symbol;

  if (amount >= 1_000_000_000) {
    return `${symbol}${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${amount.toFixed(currency.decimals)}`;
}

/**
 * Parse a currency string to a number
 * @param value - The currency string to parse
 */
export function parseCurrencyString(value: string): number {
  // Remove currency symbols and formatting
  const cleaned = value
    .replace(/[^\d.-]/g, '')
    .replace(/,/g, '');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * React hook for currency configuration
 * Usage: const { symbol, code, format } = useCurrency();
 */
export function useCurrencyConfig() {
  return {
    symbol: getCurrencySymbol(),
    code: getCurrencyCode(),
    format: formatCurrency,
    formatSimple: formatAmountSimple,
    formatAbbreviated: formatAmountAbbreviated,
    parse: parseCurrencyString
  };
}

// Initialize currency config on module load
if (typeof window !== 'undefined') {
  fetchCurrencyConfig().catch(console.warn);
}

export default {
  fetchCurrencyConfig,
  getCurrencySymbol,
  getCurrencyCode,
  formatCurrency,
  formatAmountSimple,
  formatAmountAbbreviated,
  parseCurrencyString,
  useCurrencyConfig
};