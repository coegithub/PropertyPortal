import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as auth from '../services/auth.js';
import '../auth.css';

// Who is signed in. `status` is loading until /auth/me answers: gate on it (RequireAuth does) so a signed-in
// user is never bounced to /login on first render.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready

  useEffect(() => {
    let cancelled = false;
    auth
      .getMe()
      .then((r) => !cancelled && setUser(r.user))
      .catch(() => {}) // server unreachable: treat as signed out, pages show their own errors
      .finally(() => !cancelled && setStatus('ready'));
    return () => {
      cancelled = true;
    };
  }, []);

  // http.js fires this on any 401 (e.g. the session expired in another tab).
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const signIn = useCallback(async (creds) => setUser((await auth.login(creds)).user), []);
  const signUp = useCallback(async (details) => setUser((await auth.register(details)).user), []);
  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ enabled: true, user, status, signIn, signUp, signOut }), [user, status, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}