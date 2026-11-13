import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { getCatalog } from '../services/api.js';

// The catalog (communities, properties, units) comes from the server; EOIs are fetched by their own pages.
const StoreContext = createContext(null);
const EMPTY = { communities: [], properties: [], units: [] };

export function StoreProvider({ children }) {
  const [catalog, setCatalog] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [toast, setToast] = useState(null);

  const refreshCatalog = useCallback(async () => {
    try {
      setCatalog(await getCatalog());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((msg) => setToast({ msg, key: Date.now() }), []);

  const maps = useMemo(
    () => ({
      community: new Map(catalog.communities.map((c) => [c.id, c])),
      property: new Map(catalog.properties.map((p) => [p.id, p])),
      unit: new Map(catalog.units.map((u) => [u.id, u])),
    }),
    [catalog]
  );

  const value = { ...catalog, status, refreshCatalog, maps, toast, notify };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
