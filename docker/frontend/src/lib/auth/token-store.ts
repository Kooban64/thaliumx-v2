// Minimal in-memory token store for browser usage.
//
// This enables:
// - `keycloak-js` to update the current access token
// - API client to attach `Authorization: Bearer <token>` to requests
//
// NOTE: This intentionally does NOT persist the token in localStorage.
// Persistence is handled by Keycloak SSO session + PKCE re-auth.

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token && token.trim() ? token : null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

