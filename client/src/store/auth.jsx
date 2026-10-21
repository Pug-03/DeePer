import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, setSessionExpiredHandler } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ google_enabled: false, smtp_enabled: false });

  useEffect(() => {
    api.get('/auth/config', { auth: false }).then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Only a server saying the session is over (401) signs the person out.
    // A network error or a 5xx/502 (no signal, or the host mid-deploy) used
    // to delete the token too, logging everyone out at each deploy: now it's
    // tried again a couple of times and, if it still fails, the token is
    // kept for the next visit.
    let cancelled = false;
    const load = async (tries) => {
      try {
        const d = await api.get('/auth/me');
        if (!cancelled) setUser(d.user);
      } catch (e) {
        if (cancelled) return;
        if (e.status === 401) setToken(null);
        else if (tries > 0) {
          await new Promise((r) => setTimeout(r, 2500));
          return load(tries - 1);
        }
      }
      if (!cancelled) setLoading(false);
    };
    load(2);
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuth = useCallback((token, u) => {
    setToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // The "log out" button: ends the session on the server as well, then
  // forgets it here. Signed out locally even if the server can't be reached.
  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* offline: the token is still dropped below */
    }
    logout();
  }, [logout]);

  // Any request anywhere that comes back with an invalid/expired token
  // routes through this so the user lands back on Login instead of being
  // stuck on a page that can no longer load anything — see api.js.
  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const d = await api.get('/auth/me');
    setUser(d.user);
    return d.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, config, applyAuth, logout, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
