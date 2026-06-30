// Currencies the app supports. GBP is the base/canonical currency.
export const CURRENCIES = ["GBP", "EUR", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BASE_CURRENCY: Currency = "GBP";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  TRY: "₺",
};

export interface Category {
  id: string;
  name: string;
  emoji: string;
  order: number;
  archived: boolean;
}

export interface Expense {
  id: string;
  /** Canonical amount in GBP. All stats use this. */
  amountGBP: number;
  /** Amount as originally entered, in `originalCurrency`. */
  originalAmount: number;
  originalCurrency: Currency;
  /** Units of `originalCurrency` per 1 GBP at entry time (1 for GBP). */
  fxRate: number;
  categoryId: string;
  note: string;
  /** Calendar date of the expense, ISO `YYYY-MM-DD`. */
  date: string;
  /** Creation timestamp, epoch ms. */
  createdAt: number;
}

/** Cached foreign-exchange rates: units of currency per 1 GBP. */
export interface FxCache {
  base: Currency;
  /** Rate date as reported by the source, ISO `YYYY-MM-DD`. */
  date: string;
  /** e.g. { EUR: 1.17, TRY: 41.2 } — GBP is implicitly 1. */
  rates: Partial<Record<Currency, number>>;
  /** When we last fetched, epoch ms. */
  fetchedAt: number;
}
