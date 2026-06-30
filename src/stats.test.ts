import { describe, it, expect } from "vitest";
import {
  byCategory,
  currentMonthKey,
  expensesInMonth,
  groupByDay,
  monthKey,
  shiftMonth,
  totalGBP,
} from "./stats";
import type { Category, Expense } from "./types";

const cats: Category[] = [
  { id: "food", name: "Lunch", emoji: "🍱", order: 0, archived: false },
  { id: "beer", name: "Beers", emoji: "🍺", order: 1, archived: false },
];

function exp(partial: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36),
    amountGBP: 10,
    originalAmount: 10,
    originalCurrency: "GBP",
    fxRate: 1,
    categoryId: "food",
    note: "",
    date: "2026-06-15",
    createdAt: 0,
    ...partial,
  };
}

describe("month helpers", () => {
  it("derives a month key", () => {
    expect(monthKey("2026-06-15")).toBe("2026-06");
  });
  it("computes the current month key", () => {
    expect(currentMonthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("filtering and totals", () => {
  const data = [
    exp({ date: "2026-06-01", amountGBP: 5 }),
    exp({ date: "2026-06-20", amountGBP: 7.5 }),
    exp({ date: "2026-05-30", amountGBP: 100 }),
  ];
  it("filters to a month", () => {
    expect(expensesInMonth(data, "2026-06")).toHaveLength(2);
  });
  it("sums GBP amounts", () => {
    expect(totalGBP(expensesInMonth(data, "2026-06"))).toBe(12.5);
  });
});

describe("byCategory", () => {
  const data = [
    exp({ categoryId: "food", amountGBP: 30 }),
    exp({ categoryId: "food", amountGBP: 10 }),
    exp({ categoryId: "beer", amountGBP: 60 }),
  ];
  it("aggregates and ranks by total spend", () => {
    const stats = byCategory(data, cats);
    expect(stats.map((s) => s.categoryId)).toEqual(["beer", "food"]);
    expect(stats[0].total).toBe(60);
    expect(stats[0].count).toBe(1);
    expect(stats[1].total).toBe(40);
    expect(stats[1].count).toBe(2);
  });
  it("computes share of total", () => {
    const stats = byCategory(data, cats);
    expect(stats[0].share).toBeCloseTo(0.6, 5);
    expect(stats[1].share).toBeCloseTo(0.4, 5);
  });
  it("labels unknown categories", () => {
    const stats = byCategory([exp({ categoryId: "gone" })], cats);
    expect(stats[0].name).toBe("Uncategorised");
  });
});

describe("groupByDay", () => {
  it("groups by date, newest first, with daily totals", () => {
    const groups = groupByDay([
      exp({ date: "2026-06-01", amountGBP: 5 }),
      exp({ date: "2026-06-02", amountGBP: 7 }),
      exp({ date: "2026-06-02", amountGBP: 3 }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-06-02", "2026-06-01"]);
    expect(groups[0].total).toBe(10);
    expect(groups[1].total).toBe(5);
  });
});
