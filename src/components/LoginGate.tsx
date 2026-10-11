import React, { useState } from 'react';

interface LoginGateProps {
  /** 'unknown' while checking, 'ok' when authenticated, 'login' when a session
   * is required, 'unconfigured' when the server fails closed without OWNER_TOKEN. */
  status: 'unknown' | 'ok' | 'login' | 'unconfigured';
  onSuccess: () => void;
}

/**
 * Minimal single-owner login gate (TASK-006/DEC-011). Exchanges the owner
 * access token for an HttpOnly session cookie via POST /api/auth/login.
 */
export const LoginGate: React.FC<LoginGateProps> = ({ status, onSuccess }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'ok' || status === 'unknown') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({ error: 'unexpected response' }));
      if (res.ok && body.ok) {
        onSuccess();
      } else {
        setError(body.error || `Login failed (${res.status})`);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-6" role="dialog" aria-modal="true" aria-label="Owner login">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h1 className="text-lg font-bold text-white">ManhwaUrdu DubStudio — Owner access</h1>
        {status === 'unconfigured' ? (
          <p className="text-sm text-red-300">
            Owner authentication is not configured on this server (OWNER_TOKEN is missing). The
            service fails closed and no private route is reachable. Set the OWNER_TOKEN environment
            variable and restart the server.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              This is a private single-owner tool. Enter the owner access token to continue.
            </p>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
              aria-label="Owner access token"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              placeholder="Owner access token"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || token.length === 0}
              className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}
      </form>
    </div>
  );
};
