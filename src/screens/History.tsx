import { useState } from "react";
import { useStore } from "../store";
import { groupByDay } from "../stats";
import { deleteExpense } from "../db";
import { formatGBP, formatMoney, friendlyDate } from "../format";
import { ExpenseForm } from "../components/ExpenseForm";
import type { Category, Expense } from "../types";

export function History() {
  const { expenses, categories, reload } = useStore();
  const [editing, setEditing] = useState<Expense | null>(null);

  const catById = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const groups = groupByDay(expenses);

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await deleteExpense(id);
    await reload();
  }

  if (editing) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Edit expense</h1>
        </header>
        <ExpenseForm
          initial={editing}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>History</h1>
      </header>

      {groups.length === 0 && (
        <p className="empty">No expenses yet. Add your first on the “Add” tab.</p>
      )}

      {groups.map((g) => (
        <section key={g.date} className="day-group">
          <div className="day-head">
            <span>{friendlyDate(g.date)}</span>
            <span className="day-total">{formatGBP(g.total)}</span>
          </div>
          <ul className="entry-list">
            {g.items.map((e) => {
              const cat = catById.get(e.categoryId);
              return (
                <li key={e.id} className="entry">
                  <button className="entry-main" onClick={() => setEditing(e)}>
                    <span className="entry-emoji" aria-hidden>
                      {cat?.emoji ?? "❓"}
                    </span>
                    <span className="entry-text">
                      <span className="entry-cat">{cat?.name ?? "Uncategorised"}</span>
                      {e.note && <span className="entry-note">{e.note}</span>}
                    </span>
                    <span className="entry-amount">
                      {formatGBP(e.amountGBP)}
                      {e.originalCurrency !== "GBP" && (
                        <span className="entry-orig">
                          {formatMoney(e.originalAmount, e.originalCurrency)}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    className="entry-del"
                    aria-label="Delete"
                    onClick={() => handleDelete(e.id)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
