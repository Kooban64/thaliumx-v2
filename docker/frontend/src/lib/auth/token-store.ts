// Minimal in-memory token store for browser usage.
//
// This enables:
// - OIDC client flow to update the current access token
// - API client to attach `Authorization: Bearer <token>` to requests
//
// NOTE: This intentionally does NOT persist the token in localStorage.
// Persistence is handled by Authentik SSO session + PKCE re-auth.

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token && token.trim() ? token : null;
}

export function getAccessToken(): string | null {
  return accessToken;
}
