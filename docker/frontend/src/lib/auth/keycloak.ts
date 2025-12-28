'use client';

import Keycloak, { KeycloakInstance } from 'keycloak-js';
import { setAccessToken } from './token-store';

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'https://auth.thaliumx.com/auth';
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'thaliumx-platform';
const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'thaliumx-frontend';

let keycloak: KeycloakInstance | null = null;

export function getKeycloak(): KeycloakInstance {
  if (!keycloak) {
    keycloak = new Keycloak({
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: KEYCLOAK_CLIENT_ID,
    });
  }
  return keycloak;
}

export async function initKeycloak(): Promise<void> {
  const kc = getKeycloak();

  // Prevent duplicate init
  if ((kc as any).__thaliumx_initialized) return;
  (kc as any).__thaliumx_initialized = true;

  // Keep token store in sync
  const sync = () => setAccessToken(kc.token || null);
  kc.onAuthSuccess = sync;
  kc.onAuthRefreshSuccess = sync;
  kc.onAuthLogout = () => setAccessToken(null);
  kc.onTokenExpired = async () => {
    try {
      await kc.updateToken(30);
      sync();
    } catch {
      setAccessToken(null);
    }
  };

  await kc.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    // Enables silent SSO check without full-page redirects.
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    checkLoginIframe: true,
  });

  sync();
}
