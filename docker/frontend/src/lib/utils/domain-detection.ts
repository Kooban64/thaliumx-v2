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
const ENTRY_CHANNEL_KEY = 'thaliumx_entry_channel';
const ENTRY_BROKER_SLUG_KEY = 'thaliumx_entry_broker_slug';
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

export function resolveBrokerSlugFromHostname(hostname: string): string | null {
  if (!hostname) return null;
  const normalized = hostname.toLowerCase().replace(/:\d+$/, '');
  const blocked = new Set(['thaliumx.com', 'www.thaliumx.com', 'api.thaliumx.com', 'auth.thaliumx.com', 'thal.thaliumx.com', 'localhost']);
  if (blocked.has(normalized)) return null;

  const suffix = '.thaliumx.com';
  if (!normalized.endsWith(suffix)) return null;

  const slug = normalized.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return null;
  if (!/^[a-z0-9-]{2,63}$/.test(slug)) return null;
  return slug;
}

export function getEntryChannel(): 'direct' | 'broker' {
  if (typeof window === 'undefined') return 'direct';
  const stored = sessionStorage.getItem(ENTRY_CHANNEL_KEY);
  if (stored === 'direct' || stored === 'broker') return stored;
  const slug = resolveBrokerSlugFromHostname(getCurrentHostname());
  return slug ? 'broker' : 'direct';
}

export function getEntryBrokerSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(ENTRY_BROKER_SLUG_KEY);
  if (stored && stored.trim().length > 0) return stored;
  return resolveBrokerSlugFromHostname(getCurrentHostname());
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

  // Detect from current hostname on every auth entry.
  // This prevents stale sessionStorage values (e.g. prior presale visit)
  // from overriding current-domain login/register intent.
  let detected: 'presale' | 'main' | null = null;
  if (isPresaleDomain()) {
    detected = 'presale';
  } else if (isMainDomain()) {
    detected = 'main';
  }

  // Persist detected domain when known.
  if (detected) {
    setEntryDomain(detected);
  } else {
    // Fall back to stored value for non-primary hosts where detection is unknown.
    const stored = getEntryDomain();
    if (stored) {
      detected = stored;
    }
  }

  const brokerSlug = resolveBrokerSlugFromHostname(getCurrentHostname());
  sessionStorage.setItem(ENTRY_CHANNEL_KEY, brokerSlug ? 'broker' : 'direct');
  if (brokerSlug) {
    sessionStorage.setItem(ENTRY_BROKER_SLUG_KEY, brokerSlug);
  } else {
    sessionStorage.removeItem(ENTRY_BROKER_SLUG_KEY);
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
  sessionStorage.removeItem(ENTRY_CHANNEL_KEY);
  sessionStorage.removeItem(ENTRY_BROKER_SLUG_KEY);
}

export function getSafePostLoginPath(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/dashboard';
  const candidate = path.trim();
  if (!candidate.startsWith('/')) return '/dashboard';
  if (candidate.startsWith('//')) return '/dashboard';
  if (candidate.includes('..')) return '/dashboard';
  return candidate;
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
 * Get redirect path based on entry domain and user role
 * - Admins/super_admins always go to /admin (ignore domain)
 * - Brokers always go to /broker (ignore domain)
 * - Regular users: presale domain → /token-presale, main domain → /dashboard
 * 
 * @param defaultPath - Default path if no domain detected (default: '/dashboard')
 * @param userRole - Optional user role to override domain logic for admins/brokers
 */
const normalizeRole = (role?: string | null): string | null => {
  if (!role) return null;
  const normalized = role.trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return null;
  return normalized;
};

const isAdminRole = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return (
    normalized === 'admin' ||
    normalized === 'super_admin' ||
    normalized === 'platform_admin' ||
    normalized === 'master_system_admin'
  );
};

const isBrokerRole = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return normalized === 'broker_admin' || normalized.startsWith('broker_');
};

export function getPostLoginRedirectPath(defaultPath: string = '/dashboard', userRole?: string | null): string {
  // Role-based redirects take priority
  if (isAdminRole(userRole)) {
    return '/admin';
  }

  if (isBrokerRole(userRole)) {
    return '/broker';
  }

  // For regular users, use domain detection
  const entryDomain = getEntryDomain();

  if (entryDomain === 'presale') {
    return '/token-presale';
  }

  return defaultPath;
}
