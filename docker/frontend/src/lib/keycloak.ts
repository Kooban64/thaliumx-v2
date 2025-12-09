import Keycloak from 'keycloak-js';

let keycloak: Keycloak | null = null;

export function getKeycloak(): Keycloak {
  if (!keycloak) {
    keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'thaliumx-tenant',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'thaliumx-frontend'
    });
  }
  return keycloak;
}

export async function initKeycloak(): Promise<string | null> {
  const kc = getKeycloak();
  const authenticated = await kc.init({ onLoad: 'check-sso', silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html' });
  if (authenticated && kc.token) {
    localStorage.setItem('authToken', kc.token);
    return kc.token;
  }
  return null;
}

export async function login(): Promise<void> {
  const kc = getKeycloak();
  await kc.login();
}

export async function logout(): Promise<void> {
  const kc = getKeycloak();
  await kc.logout();
  localStorage.removeItem('authToken');
}


