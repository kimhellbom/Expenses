import type { Currency, FxCache } from "./types";
import { BASE_CURRENCY } from "./types";
import { FX_CACHE_KEY, getFxCache, setMeta } from "./db";

// Foreign exchange. Rates are expressed as "units of currency per 1 GBP",
// matching the Frankfurter API response when base=GBP.

const FRANKFURTER_URL =
  "https://api.frankfurter.app/latest?base=GBP&symbols=EUR,TRY";

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

/**
 * Refresh rates from the network and cache them. Returns the cache used
 * (freshly fetched, or the previous cache if the network is unavailable).
 */
export async function refreshRates(): Promise<FxCache | undefined> {
  try {
    const res = await fetch(FRANKFURTER_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as FrankfurterResponse;
    const cache: FxCache = {
      base: BASE_CURRENCY,
      date: json.date,
      rates: { EUR: json.rates.EUR, TRY: json.rates.TRY },
      fetchedAt: Date.now(),
    };
    await setMeta(FX_CACHE_KEY, cache);
    return cache;
  } catch {
    // Offline or blocked: fall back to whatever we cached last.
    return getFxCache();
  }
}
