import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Category, Expense, FxCache } from "./types";

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

// --- Backup (export / import) --------------------------------------------

export interface Backup {
  app: "expense-tracker";
  version: 1;
  exportedAt: string;
  categories: Category[];
  expenses: Expense[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "expense-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await getCategories(true),
    expenses: await getExpenses(),
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
}
