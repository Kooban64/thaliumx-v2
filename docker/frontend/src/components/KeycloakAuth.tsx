'use client';

import { useEffect, useState } from 'react';
import { initKeycloak, login, logout } from '@/lib/keycloak';

export default function KeycloakAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await initKeycloak();
        setToken(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-sm">Checking session...</div>;

  return (
    <div className="flex items-center gap-2">
      {token ? (
        <>
          <span className="text-xs text-green-700">Signed in</span>
          <button className="px-3 py-1 border rounded" onClick={logout}>Logout</button>
        </>
      ) : (
        <button className="px-3 py-1 border rounded" onClick={login}>Login</button>
      )}
    </div>
  );
}


