import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Category, Expense, FxCache } from "./types";
import {
  autoExpenseId,
  fingerprintOf,
  ingestLines,
  merchantKeyOf,
  prettyMerchant,
  type PendingTxn,
} from "./capture";
import { convertToGBP, rateFor, round2 } from "./fx";

// Local-only IndexedDB. No server, no sync — adding an expense works fully
// offline because everything is written straight to the device.

interface ExpenseDB extends DBSchema {
  expenses: {
    key: string;
    value: Expense;
    indexes: { "by-date": string };
  };
  categories: {
    key: string;
    value: Category;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "expense-tracker";
const DB_VERSION = 1;

// The user's Money Manager categories (from their screenshot).
const SEED_CATEGORIES: Array<Omit<Category, "id" | "order" | "archived">> = [
  { name: "Restaurant", emoji: "🍜" },
  { name: "Groceries", emoji: "🥕" },
  { name: "Beers", emoji: "🍺" },
  { name: "Social Life", emoji: "👬" },
  { name: "Lunch", emoji: "🍱" },
  { name: "Coffee & Snack", emoji: "☕" },
  { name: "Transport", emoji: "🚕" },
  { name: "Public transport", emoji: "🚌" },
  { name: "Travel", emoji: "✈️" },
  { name: "Culture", emoji: "🖼️" },
  { name: "Household", emoji: "🪑" },
  { name: "Apparel", emoji: "🧥" },
  { name: "Health", emoji: "🧘" },
  { name: "Education", emoji: "📙" },
  { name: "Gift", emoji: "🎁" },
];

let dbPromise: Promise<IDBPDatabase<ExpenseDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ExpenseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const expenses = db.createObjectStore("expenses", { keyPath: "id" });
        expenses.createIndex("by-date", "date");
        db.createObjectStore("categories", { keyPath: "id" });
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Seed default categories on first run. Safe to call on every startup. */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();
  const count = await db.count("categories");
  if (count > 0) return;
  const tx = db.transaction("categories", "readwrite");
  SEED_CATEGORIES.forEach((c, i) => {
    void tx.store.put({
      id: newId(),
      name: c.name,
      emoji: c.emoji,
      order: i,
      archived: false,
    });
  });
  await tx.done;
}

// --- Categories -----------------------------------------------------------

export async function getCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDB();
  const all = await db.getAll("categories");
  return all
    .filter((c) => includeArchived || !c.archived)
    .sort((a, b) => a.order - b.order);
}

export async function saveCategory(cat: Category): Promise<void> {
  const db = await getDB();
  await db.put("categories", cat);
}

export async function addCategory(name: string, emoji: string): Promise<Category> {
  const existing = await getCategories(true);
  const maxOrder = existing.reduce((m, c) => Math.max(m, c.order), -1);
  const cat: Category = {
    id: newId(),
    name: name.trim(),
    emoji: emoji.trim() || "💸",
    order: maxOrder + 1,
    archived: false,
  };
  await saveCategory(cat);
  return cat;
}

/**
 * Remove a category. If it still has expenses we archive it (to keep historical
 * rows meaningful); otherwise we delete it outright.
 */
export async function removeCategory(id: string): Promise<"deleted" | "archived"> {
  const db = await getDB();
  const used = (await db.getAll("expenses")).some((e) => e.categoryId === id);
  if (used) {
    const cat = await db.get("categories", id);
    if (cat) await db.put("categories", { ...cat, archived: true });
    return "archived";
  }
  await db.delete("categories", id);
  return "deleted";
}

// --- Expenses -------------------------------------------------------------

export async function getExpenses(): Promise<Expense[]> {
  const db = await getDB();
  const all = await db.getAll("expenses");
  // Newest first by date, then by creation time.
  return all.sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}

export async function saveExpense(exp: Expense): Promise<void> {
  const db = await getDB();
  await db.put("expenses", exp);
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("expenses", id);
}

// --- Meta (settings + FX cache) ------------------------------------------

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("meta", value, key);
}

export const FX_CACHE_KEY = "fxCache";
export const LAST_RATES_KEY = "lastManualRates";

export function getFxCache(): Promise<FxCache | undefined> {
  return getMeta<FxCache>(FX_CACHE_KEY);
}

// --- Auto-capture (merchant memory + import inbox) ------------------------

const MERCHANT_RULES_KEY = "merchantRules";
const PENDING_KEY = "capturePending";
const CAPTURED_KEYS_KEY = "captureCapturedKeys";

/** merchantKey -> categoryId. The learned "auto-file" memory. */
export async function getMerchantRules(): Promise<Record<string, string>> {
  return (await getMeta<Record<string, string>>(MERCHANT_RULES_KEY)) ?? {};
}

export async function setMerchantRule(merchantKey: string, categoryId: string): Promise<void> {
  const rules = await getMerchantRules();
  rules[merchantKey] = categoryId;
  await setMeta(MERCHANT_RULES_KEY, rules);
}

export async function removeMerchantRule(merchantKey: string): Promise<void> {
  const rules = await getMerchantRules();
  delete rules[merchantKey];
  await setMeta(MERCHANT_RULES_KEY, rules);
}

export async function getPending(): Promise<PendingTxn[]> {
  return (await getMeta<PendingTxn[]>(PENDING_KEY)) ?? [];
}

async function setPending(items: PendingTxn[]): Promise<void> {
  await setMeta(PENDING_KEY, items);
}

async function getCapturedKeys(): Promise<string[]> {
  return (await getMeta<string[]>(CAPTURED_KEYS_KEY)) ?? [];
}

async function setCapturedKeys(keys: string[]): Promise<void> {
  await setMeta(CAPTURED_KEYS_KEY, keys);
}

export interface ImportSummary {
  added: number;
  pending: number;
  duplicates: number;
  failed: number;
  pendingTotal: number;
}

/**
 * Import raw inbox lines: auto-file known merchants (with a usable FX rate),
 * queue the rest for review. Deduplicates against what's already been captured.
 */
export async function importInbox(lines: string[]): Promise<ImportSummary> {
  const [rules, capturedKeys, pending, cats, fxCache, expenses] = await Promise.all([
    getMerchantRules(),
    getCapturedKeys(),
    getPending(),
    getCategories(),
    getFxCache(),
    getExpenses(),
  ]);
  // Also dedup against expenses already saved (robust even if capturedKeys is
  // ever lost, or the fingerprint scheme changed under an existing row).
  const existingKeys = expenses
    .filter((e) => e.source === "auto" && e.merchant)
    .map((e) =>
      fingerprintOf(merchantKeyOf(e.merchant as string), e.originalCurrency, e.originalAmount, e.date),
    );
  const res = ingestLines({
    lines,
    merchantRules: rules,
    capturedKeys: [...capturedKeys, ...existingKeys],
    pending,
    fxCache,
    categoryIds: new Set(cats.map((c) => c.id)),
    now: Date.now(),
  });

  if (res.autoAdded.length) {
    const db = await getDB();
    const tx = db.transaction("expenses", "readwrite");
    for (const e of res.autoAdded) void tx.store.put(e);
    await tx.done;
    const prefix = "auto:".length;
    await setCapturedKeys([
      ...capturedKeys,
      ...res.autoAdded.map((e) => e.id.slice(prefix)),
    ]);
  }
  if (res.newPending.length) {
    await setPending([...pending, ...res.newPending]);
  }
  return {
    added: res.autoAdded.length,
    pending: res.newPending.length,
    duplicates: res.duplicates,
    failed: res.failed,
    pendingTotal: pending.length + res.newPending.length,
  };
}

/**
 * Resolve a pending capture into an expense under `categoryId`. When `remember`
 * is set, every future transaction from this merchant auto-files to the same
 * category (no review needed).
 */
export async function resolvePending(
  fingerprint: string,
  categoryId: string,
  remember: boolean,
): Promise<void> {
  const pending = await getPending();
  const item = pending.find((p) => p.fingerprint === fingerprint);
  if (!item) return;

  const fxCache = await getFxCache();
  const rate = rateFor(item.currency, fxCache);
  let gbp = rate !== undefined ? convertToGBP(item.amount, item.currency, rate) : NaN;
  let fxRate = item.currency === "GBP" ? 1 : (rate ?? NaN);
  if (!Number.isFinite(gbp)) {
    // No rate available at all (offline, never cached): store face value so the
    // row isn't lost; it can be corrected later from History.
    gbp = round2(item.amount);
    fxRate = Number.isFinite(fxRate) ? fxRate : 1;
  }

  const expense: Expense = {
    id: autoExpenseId(fingerprint),
    amountGBP: gbp,
    originalAmount: round2(item.amount),
    originalCurrency: item.currency,
    fxRate,
    categoryId,
    note: prettyMerchant(item.merchant),
    date: item.date,
    createdAt: item.ts,
    merchant: item.merchant,
    source: "auto",
  };
  await saveExpense(expense);
  await setPending(pending.filter((p) => p.fingerprint !== fingerprint));
  await setCapturedKeys([...(await getCapturedKeys()), fingerprint]);
  if (remember) await setMerchantRule(item.merchantKey, categoryId);
}

/** Discard a pending capture without creating an expense. */
export async function dismissPending(fingerprint: string): Promise<void> {
  const pending = await getPending();
  await setPending(pending.filter((p) => p.fingerprint !== fingerprint));
  await setCapturedKeys([...(await getCapturedKeys()), fingerprint]);
}

// --- Backup (export / import) --------------------------------------------

export interface Backup {
  app: "expense-tracker";
  version: 1;
  exportedAt: string;
  categories: Category[];
  expenses: Expense[];
  /** Learned merchant -> category memory (optional; added later). */
  merchantRules?: Record<string, string>;
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "expense-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await getCategories(true),
    expenses: await getExpenses(),
    merchantRules: await getMerchantRules(),
  };
}

/** Replace all categories and expenses with the backup's contents. */
export async function importBackup(data: Backup): Promise<void> {
  if (data.app !== "expense-tracker" || !Array.isArray(data.expenses)) {
    throw new Error("Not a valid Expenses backup file.");
  }
  const db = await getDB();
  const tx = db.transaction(["categories", "expenses"], "readwrite");
  await tx.objectStore("categories").clear();
  await tx.objectStore("expenses").clear();
  for (const c of data.categories ?? []) tx.objectStore("categories").put(c);
  for (const e of data.expenses) tx.objectStore("expenses").put(e);
  await tx.done;
  if (data.merchantRules) await setMeta(MERCHANT_RULES_KEY, data.merchantRules);
}
