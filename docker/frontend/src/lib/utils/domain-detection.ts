/**
 * Domain Detection Utility
 * 
 * Detects and tracks which domain the user entered from:
 * - thal.thaliumx.com (token presale domain)
 * - thaliumx.com (main exchange domain)
 * 
 * Stores entry domain in sessionStorage to persist across navigation
 * and login flows.
 */

const ENTRY_DOMAIN_KEY = 'thaliumx_entry_domain';
const PRESALE_DOMAIN = 'thal.thaliumx.com';
const MAIN_DOMAIN = 'thaliumx.com';

/**
 * Get the current hostname
 */
export function getCurrentHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.hostname;
}

/**
 * Detect if current domain is the presale domain
 */
export function isPresaleDomain(): boolean {
  const hostname = getCurrentHostname();
  return hostname === PRESALE_DOMAIN || hostname.includes('thal.thaliumx.com');
}

/**
 * Detect if current domain is the main exchange domain
 */
export function isMainDomain(): boolean {
  const hostname = getCurrentHostname();
  return hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`;
}

/**
 * Get the entry domain (where user first landed)
 * Returns 'presale' for thal.thaliumx.com, 'main' for thaliumx.com, or null
 */
export function getEntryDomain(): 'presale' | 'main' | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check sessionStorage first
  const stored = sessionStorage.getItem(ENTRY_DOMAIN_KEY);
  if (stored === 'presale' || stored === 'main') {
    return stored;
  }

  // If not stored, detect from current hostname
  if (isPresaleDomain()) {
    return 'presale';
  }
  if (isMainDomain()) {
    return 'main';
  }

  return null;
}

/**
 * Set and store the entry domain
 * Should be called when user first lands on a page
 */
export function setEntryDomain(domain: 'presale' | 'main' | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Only set if not already set (preserve first entry)
  const existing = sessionStorage.getItem(ENTRY_DOMAIN_KEY);
  if (!existing && domain) {
    sessionStorage.setItem(ENTRY_DOMAIN_KEY, domain);
  } else if (domain) {
    // Update if explicitly set
    sessionStorage.setItem(ENTRY_DOMAIN_KEY, domain);
  }
}

/**
 * Initialize entry domain detection
 * Call this on page load to detect and store entry domain
 */
export function initializeEntryDomain(): 'presale' | 'main' | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if already stored
  const stored = getEntryDomain();
  if (stored) {
    return stored;
  }

  // Detect from current hostname
  let detected: 'presale' | 'main' | null = null;
  if (isPresaleDomain()) {
    detected = 'presale';
  } else if (isMainDomain()) {
    detected = 'main';
  }

  // Store detected domain
  if (detected) {
    setEntryDomain(detected);
  }

  return detected;
}

/**
 * Clear entry domain (useful for logout or testing)
 */
export function clearEntryDomain(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(ENTRY_DOMAIN_KEY);
}

/**
 * Check if user came from presale domain
 */
export function cameFromPresaleDomain(): boolean {
  return getEntryDomain() === 'presale';
}

/**
 * Check if user came from main domain
 */
export function cameFromMainDomain(): boolean {
  return getEntryDomain() === 'main';
}

/**
 * Get redirect path based on entry domain
 * - presale domain users should go to /token-presale after login
 * - main domain users should go to /dashboard after login
 */
export function getPostLoginRedirectPath(defaultPath: string = '/dashboard'): string {
  const entryDomain = getEntryDomain();
  
  if (entryDomain === 'presale') {
    return '/token-presale';
  }
  
  return defaultPath;
}
