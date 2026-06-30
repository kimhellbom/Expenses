import type { Currency, FxCache } from "./types";
import { BASE_CURRENCY } from "./types";
import { FX_CACHE_KEY, getFxCache, setMeta } from "./db";

// Foreign exchange. Rates are expressed as "units of currency per 1 GBP",
// matching the Frankfurter API response when base=GBP.

// The Frankfurter project moved hosting: api.frankfurter.dev/v1 is current,
// api.frankfurter.app is the legacy host kept as a fallback. We try each in
// order so a single host being down doesn't break conversion.
const FRANKFURTER_URLS = [
  "https://api.frankfurter.dev/v1/latest?base=GBP&symbols=EUR,TRY",
  "https://api.frankfurter.app/latest?base=GBP&symbols=EUR,TRY",
];

/** Round to 2 dp without floating-point drift (e.g. 1.005 -> 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Convert an amount in `currency` to GBP given a rate of "units per GBP".
 * Returns the GBP amount rounded to 2 dp.
 */
export function convertToGBP(
  amount: number,
  currency: Currency,
  ratePerGBP: number,
): number {
  if (currency === BASE_CURRENCY) return round2(amount);
  if (!ratePerGBP || ratePerGBP <= 0) return NaN;
  return round2(amount / ratePerGBP);
}

/** The rate (units per GBP) to use for a currency from a cache. 1 for GBP. */
export function rateFor(currency: Currency, cache?: FxCache): number | undefined {
  if (currency === BASE_CURRENCY) return 1;
  return cache?.rates?.[currency];
}

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface RefreshResult {
  /** Best rates available: freshly fetched, or the previous cache on failure. */
  cache?: FxCache;
  /** Human-readable reason the live fetch failed, if it did. */
  error?: string;
}

async function fetchFrom(url: string): Promise<FxCache> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as FrankfurterResponse;
  if (!json.rates || (json.rates.EUR == null && json.rates.TRY == null)) {
    throw new Error("Response had no rates");
  }
  return {
    base: BASE_CURRENCY,
    date: json.date,
    rates: { EUR: json.rates.EUR, TRY: json.rates.TRY },
    fetchedAt: Date.now(),
  };
}

/**
 * Refresh rates from the network and cache them. Tries each known host in turn.
 * On success returns the fresh cache; on failure returns the previous cache (so
 * offline use keeps working) plus an `error` describing what went wrong.
 */
export async function refreshRates(): Promise<RefreshResult> {
  let lastError = "Unknown error";
  for (const url of FRANKFURTER_URLS) {
    try {
      const cache = await fetchFrom(url);
      await setMeta(FX_CACHE_KEY, cache);
      return { cache };
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  // Every host failed: keep whatever we cached last so manual/offline use works.
  const fallback = await getFxCache();
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  return {
    cache: fallback,
    error: offline ? "You're offline — couldn't fetch live rates." : `Couldn't reach the rates service (${lastError}).`,
  };
}
