'use client';

import { setAccessToken } from './token-store';

type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
};

const ZITADEL_ISSUER = (process.env.NEXT_PUBLIC_ZITADEL_ISSUER || 'https://auth.thaliumx.com').replace(/\/+$/, '');
const ZITADEL_CLIENT_ID = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || 'thaliumx-frontend';
const ZITADEL_SCOPES = process.env.NEXT_PUBLIC_ZITADEL_SCOPES || 'openid profile email';

const STORAGE_KEYS = {
  verifier: 'thaliumx_oidc_verifier',
  state: 'thaliumx_oidc_state',
  postLoginNext: 'thaliumx_oidc_next',
  accessToken: 'thaliumx_oidc_access_token',
  accessTokenExp: 'thaliumx_oidc_access_token_exp',
};

// For E2E only: allow Playwright storageState to capture the token via localStorage.
// Playwright's `storageState` includes localStorage but not sessionStorage.
const E2E_PERSIST_TOKEN = process.env.NEXT_PUBLIC_E2E_TOKEN_PERSIST === '1';

let discoveryCache: OidcDiscovery | null = null;

const base64UrlEncode = (input: ArrayBuffer): string => {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const sha256 = async (input: string): Promise<ArrayBuffer> => {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest('SHA-256', data);
};

const randomString = (bytes: number): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // base64url-ish, without padding.
  return base64UrlEncode(arr.buffer);
};

const getDiscovery = async (): Promise<OidcDiscovery> => {
  if (discoveryCache) return discoveryCache;
  const url = `${ZITADEL_ISSUER}/.well-known/openid-configuration`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Failed to load OIDC discovery: ${res.status}`);
  }
  const json = (await res.json()) as OidcDiscovery;
  discoveryCache = json;
  return json;
};

const setPersistedAccessToken = (token: string, expiresInSeconds?: number): void => {
  setAccessToken(token);
  try {
    sessionStorage.setItem(STORAGE_KEYS.accessToken, token);
    if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds)) {
      const exp = Date.now() + expiresInSeconds * 1000;
      sessionStorage.setItem(STORAGE_KEYS.accessTokenExp, String(exp));
    }

    if (E2E_PERSIST_TOKEN) {
      localStorage.setItem(STORAGE_KEYS.accessToken, token);
      if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds)) {
        const exp = Date.now() + expiresInSeconds * 1000;
        localStorage.setItem(STORAGE_KEYS.accessTokenExp, String(exp));
      }
    }
  } catch {
    // ignore (private mode, disabled storage)
  }
};

export const initZitadel = async (): Promise<void> => {
  // Restore token from this tab session if present and not expired.
  try {
    const token = sessionStorage.getItem(STORAGE_KEYS.accessToken);
    const expRaw = sessionStorage.getItem(STORAGE_KEYS.accessTokenExp);
    const exp = expRaw ? Number(expRaw) : NaN;

    if (token && (!Number.isFinite(exp) || exp > Date.now() + 15_000)) {
      setAccessToken(token);
      return;
    }
  } catch {
    // ignore
  }

  // E2E fallback: restore from localStorage (only when explicitly enabled).
  if (E2E_PERSIST_TOKEN) {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.accessToken);
      const expRaw = localStorage.getItem(STORAGE_KEYS.accessTokenExp);
      const exp = expRaw ? Number(expRaw) : NaN;
      if (token && (!Number.isFinite(exp) || exp > Date.now() + 15_000)) {
        setAccessToken(token);
        // Mirror to sessionStorage for runtime behavior.
        sessionStorage.setItem(STORAGE_KEYS.accessToken, token);
        if (Number.isFinite(exp)) sessionStorage.setItem(STORAGE_KEYS.accessTokenExp, String(exp));
        return;
      }
    } catch {
      // ignore
    }
  }
  setAccessToken(null);
};

export const loginZitadel = async (opts: { nextPath: string }): Promise<void> => {
  // IMPORTANT: In prod-v1, `/auth/*` on `thaliumx.com` is reserved for the IdP proxy.
  // Use a callback path that stays on the frontend origin.
  const redirectUri = `${window.location.origin}/oidc/callback`;
  const verifier = randomString(48);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomString(24);

  try {
    sessionStorage.setItem(STORAGE_KEYS.verifier, verifier);
    sessionStorage.setItem(STORAGE_KEYS.state, state);
    sessionStorage.setItem(STORAGE_KEYS.postLoginNext, opts.nextPath);
  } catch {
    // ignore
  }

  const discovery = await getDiscovery();
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set('client_id', ZITADEL_CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', ZITADEL_SCOPES);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);

  window.location.href = authorizeUrl.toString();
};

export const handleZitadelCallback = async (search: string): Promise<{ nextPath: string } > => {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    throw new Error(errorDescription || error);
  }
  if (!code || !state) {
    throw new Error('Missing authorization code/state');
  }

  const storedState = sessionStorage.getItem(STORAGE_KEYS.state);
  const verifier = sessionStorage.getItem(STORAGE_KEYS.verifier);
  const nextPath = sessionStorage.getItem(STORAGE_KEYS.postLoginNext) || '/dashboard';

  if (!storedState || storedState !== state) {
    throw new Error('Invalid state');
  }
  if (!verifier) {
    throw new Error('Missing PKCE verifier');
  }

  const discovery = await getDiscovery();
  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ZITADEL_CLIENT_ID,
      code,
      redirect_uri: `${window.location.origin}/oidc/callback`,
      code_verifier: verifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(`Token exchange failed (${tokenRes.status}). ${text}`);
  }

  const tokenJson: any = await tokenRes.json();
  const accessToken: string | undefined = tokenJson?.access_token;
  const expiresIn: number | undefined = typeof tokenJson?.expires_in === 'number' ? tokenJson.expires_in : undefined;
  if (!accessToken) {
    throw new Error('No access_token returned by token endpoint');
  }

  // Cleanup transient values.
  try {
    sessionStorage.removeItem(STORAGE_KEYS.verifier);
    sessionStorage.removeItem(STORAGE_KEYS.state);
  } catch {
    // ignore
  }

  setPersistedAccessToken(accessToken, expiresIn);
  return { nextPath };
};

export const logoutZitadel = async (): Promise<void> => {
  setAccessToken(null);
  try {
    sessionStorage.removeItem(STORAGE_KEYS.accessToken);
    sessionStorage.removeItem(STORAGE_KEYS.accessTokenExp);

    if (E2E_PERSIST_TOKEN) {
      localStorage.removeItem(STORAGE_KEYS.accessToken);
      localStorage.removeItem(STORAGE_KEYS.accessTokenExp);
    }
  } catch {
    // ignore
  }

  // Best-effort: redirect to end_session_endpoint if provided.
  try {
    const discovery = await getDiscovery();
    if (discovery.end_session_endpoint) {
      const url = new URL(discovery.end_session_endpoint);
      url.searchParams.set('post_logout_redirect_uri', `${window.location.origin}/`);
      window.location.href = url.toString();
      return;
    }
  } catch {
    // ignore
  }

  window.location.href = '/';
};
