import { useState } from "react";
import { useStore } from "../store";
import {
  byCategory,
  currentMonthKey,
  expensesInMonth,
  monthLabel,
  shiftMonth,
  totalGBP,
} from "../stats";
import { Donut } from "../components/Donut";
import { BarBreakdown } from "../components/BarBreakdown";
import { CURRENCY_SYMBOL } from "../types";

export function Stats() {
  const { expenses, categories } = useStore();
  const [month, setMonth] = useState(currentMonthKey());

  const monthly = expensesInMonth(expenses, month);
  const total = totalGBP(monthly);
  const stats = byCategory(monthly, categories);
  const isCurrent = month === currentMonthKey();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Stats</h1>
      </header>

      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="month-label">{monthLabel(month)}</span>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrent}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {monthly.length === 0 ? (
        <p className="empty">No spending recorded for {monthLabel(month)}.</p>
      ) : (
        <>
          <div className="donut-wrap">
            <Donut stats={stats} total={total} symbol={CURRENCY_SYMBOL.GBP} />
          </div>
          <p className="stat-meta">
            {monthly.length} {monthly.length === 1 ? "expense" : "expenses"} across{" "}
            {stats.length} {stats.length === 1 ? "category" : "categories"}
          </p>
          <BarBreakdown stats={stats} />
        </>
      )}
    </div>
  );
}
