import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Category, Expense, FxCache } from "./types";
import {
  ensureSeeded,
  getCategories,
  getExpenses,
  getFxCache,
} from "./db";
import { refreshRates } from "./fx";

export type FxStatus = "idle" | "loading" | "ok" | "error";

interface Store {
  ready: boolean;
  categories: Category[];
  expenses: Expense[];
  fxCache?: FxCache;
  fxStatus: FxStatus;
  fxError?: string;
  online: boolean;
  /** Reload categories + expenses from IndexedDB. */
  reload: () => Promise<void>;
  /** Re-fetch FX rates (falls back to cache when offline). */
  reloadRates: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fxCache, setFxCache] = useState<FxCache | undefined>();
  const [fxStatus, setFxStatus] = useState<FxStatus>("idle");
  const [fxError, setFxError] = useState<string | undefined>();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const reload = useCallback(async () => {
    const [cats, exps] = await Promise.all([getCategories(), getExpenses()]);
    setCategories(cats);
    setExpenses(exps);
  }, []);

  const reloadRates = useCallback(async () => {
    setFxStatus("loading");
    setFxError(undefined);
    const { cache, error } = await refreshRates();
    if (cache) setFxCache(cache);
    setFxError(error);
    setFxStatus(error ? "error" : "ok");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      await reload();
      // Show whatever we cached immediately, then refresh in the background.
      const cached = await getFxCache();
      if (!cancelled) setFxCache(cached);
      await reloadRates();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, reloadRates]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // When the connection comes back, refresh rates.
  useEffect(() => {
    if (online) void reloadRates();
  }, [online, reloadRates]);

  const value: Store = {
    ready,
    categories,
    expenses,
    fxCache,
    fxStatus,
    fxError,
    online,
    reload,
    reloadRates,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
