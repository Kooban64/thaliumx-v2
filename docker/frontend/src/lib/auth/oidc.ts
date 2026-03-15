import { setAccessToken } from './token-store';

type OidcLoginOptions = {
  nextPath?: string;
};

const buildOidcAuthorizeUrl = (nextPath: string): string => {
  const issuer = (process.env.NEXT_PUBLIC_OIDC_ISSUER || '').replace(/\/+$/, '');
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'thaliumx-frontend';
  const redirectUri = `${window.location.origin}/oidc/callback`;
  const scope = encodeURIComponent('openid profile email');
  const state = encodeURIComponent(nextPath);
  const codeVerifier = crypto.randomUUID().replace(/-/g, '');
  const codeChallengePromise = window.crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(codeVerifier))
    .then(buffer => {
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });

  sessionStorage.setItem('thaliumx_oidc_code_verifier', codeVerifier);
  sessionStorage.setItem('thaliumx_oidc_next_path', nextPath);

  if (!issuer) {
    throw new Error('OIDC issuer is not configured');
  }

  return codeChallengePromise.then(codeChallenge => {
    return `${issuer}/protocol/openid-connect/auth?response_type=code&client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&code_challenge=${encodeURIComponent(
      codeChallenge,
    )}&code_challenge_method=S256&state=${state}`;
  }) as unknown as string;
};

export async function loginOidc({ nextPath = '/dashboard' }: OidcLoginOptions): Promise<void> {
  const url = (await buildOidcAuthorizeUrl(nextPath)) as unknown as string;
  window.location.assign(url);
}

export async function handleOidcCallback(search: string): Promise<{ nextPath: string; accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state') || sessionStorage.getItem('thaliumx_oidc_next_path') || '/dashboard';
  const issuer = (process.env.NEXT_PUBLIC_OIDC_ISSUER || '').replace(/\/+$/, '');
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'thaliumx-frontend';
  const redirectUri = `${window.location.origin}/oidc/callback`;
  const codeVerifier = sessionStorage.getItem('thaliumx_oidc_code_verifier') || '';

  if (!issuer) throw new Error('OIDC issuer is not configured');
  if (!code) throw new Error('Missing authorization code');
  if (!codeVerifier) throw new Error('Missing PKCE verifier');

  const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('OIDC token exchange failed');
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string; expires_in?: number };
  if (!tokenPayload.access_token) {
    throw new Error('Missing access token');
  }

  sessionStorage.removeItem('thaliumx_oidc_code_verifier');
  sessionStorage.removeItem('thaliumx_oidc_next_path');

  setAccessToken(tokenPayload.access_token);

  return {
    nextPath: state,
    accessToken: tokenPayload.access_token,
    expiresIn: tokenPayload.expires_in || 3600,
  };
}
