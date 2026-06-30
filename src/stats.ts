import type { Category, Expense } from "./types";
import { round2 } from "./fx";

// Pure helpers for filtering by month and aggregating spend by category.
// Everything here works on the canonical GBP amount.

/** Month key `YYYY-MM` for an ISO date string. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function currentMonthKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Shift a `YYYY-MM` key by `delta` months. */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonthKey(d);
}

/** Human label for a month key, e.g. "June 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function expensesInMonth(expenses: Expense[], key: string): Expense[] {
  return expenses.filter((e) => monthKey(e.date) === key);
}

export function totalGBP(expenses: Expense[]): number {
  return round2(expenses.reduce((sum, e) => sum + e.amountGBP, 0));
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  emoji: string;
  total: number;
  count: number;
  /** Share of the period total, 0..1. */
  share: number;
}

/**
 * Spend grouped by category, largest first. Categories with no spend in the
 * period are omitted. Unknown category ids (e.g. deleted) fall back to a label.
 */
export function byCategory(
  expenses: Expense[],
  categories: Category[],
): CategoryStat[] {
  const lookup = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const cur = totals.get(e.categoryId) ?? { total: 0, count: 0 };
    cur.total += e.amountGBP;
    cur.count += 1;
    totals.set(e.categoryId, cur);
  }
  const grand = totalGBP(expenses);
  const stats: CategoryStat[] = [];
  for (const [categoryId, { total, count }] of totals) {
    const cat = lookup.get(categoryId);
    stats.push({
      categoryId,
      name: cat?.name ?? "Uncategorised",
      emoji: cat?.emoji ?? "❓",
      total: round2(total),
      count,
      share: grand > 0 ? total / grand : 0,
    });
  }
  return stats.sort((a, b) => b.total - a.total);
}

/** Group expenses by calendar day (ISO date), newest day first. */
export function groupByDay(expenses: Expense[]): Array<{
  date: string;
  total: number;
  items: Expense[];
}> {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, total: totalGBP(items), items }));
}
