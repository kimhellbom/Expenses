import { useMemo, useState } from "react";
import { useStore } from "../store";
import { CURRENCIES, CURRENCY_SYMBOL, type Currency, type Expense } from "../types";
import { convertToGBP, rateFor, round2 } from "../fx";
import { newId, saveExpense } from "../db";
import { todayISO } from "../format";
import { CategoryGrid } from "./CategoryGrid";

// Shared form for creating and editing an expense. Computes and stores the
// canonical GBP amount, keeping the original amount/currency/rate for reference.
export function ExpenseForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Expense;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { categories, fxCache, reload, online } = useStore();

  const [amount, setAmount] = useState(
    initial ? String(initial.originalAmount) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    initial?.originalCurrency ?? "GBP",
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.categoryId ?? null,
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");

  // Rate = units of `currency` per 1 GBP. Editable so the user can override
  // when offline or paying at a known rate.
  const cacheRate = rateFor(currency, fxCache);
  const [rateOverride, setRateOverride] = useState<string>("");
  const effectiveRate =
    currency === "GBP"
      ? 1
      : rateOverride.trim() !== ""
        ? Number(rateOverride)
        : (cacheRate ?? NaN);

  const numericAmount = Number(amount);
  const gbp = useMemo(
    () =>
      Number.isFinite(numericAmount) && numericAmount > 0
        ? convertToGBP(numericAmount, currency, effectiveRate)
        : NaN,
    [numericAmount, currency, effectiveRate],
  );

  const needsRate = currency !== "GBP";
  const rateKnown = currency === "GBP" || Number.isFinite(effectiveRate);
  const canSave =
    !!categoryId &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    Number.isFinite(gbp);

  async function handleSave() {
    if (!canSave || !categoryId) return;
    const expense: Expense = {
      id: initial?.id ?? newId(),
      amountGBP: gbp,
      originalAmount: round2(numericAmount),
      originalCurrency: currency,
      fxRate: currency === "GBP" ? 1 : effectiveRate,
      categoryId,
      note: note.trim(),
      date,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    await saveExpense(expense);
    await reload();
    onDone();
  }

  return (
    <div className="form">
      <div className="amount-block">
        <div className="currency-toggle">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`cur-btn ${currency === c ? "cur-btn-active" : ""}`}
              onClick={() => {
                setCurrency(c);
                setRateOverride("");
              }}
            >
              {CURRENCY_SYMBOL[c]} {c}
            </button>
          ))}
        </div>
        <div className="amount-input">
          <span className="amount-symbol">{CURRENCY_SYMBOL[currency]}</span>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            autoFocus={!initial}
          />
        </div>

        {needsRate && (
          <div className="fx-line">
            {rateKnown ? (
              <span className="fx-converted">
                ≈ {Number.isFinite(gbp) ? `£${gbp.toFixed(2)}` : "—"} GBP
              </span>
            ) : (
              <span className="fx-warn">
                No rate for {currency}
                {online ? " yet" : " (offline)"} — enter one below.
              </span>
            )}
            <details className="fx-details">
              <summary>
                rate: 1 GBP = {Number.isFinite(effectiveRate) ? effectiveRate : "?"} {currency}
                {cacheRate && fxCache?.date ? ` (ECB ${fxCache.date})` : ""}
              </summary>
              <label className="fx-override">
                Override rate (1 GBP =)
                <input
                  inputMode="decimal"
                  placeholder={cacheRate ? String(cacheRate) : `${currency} per GBP`}
                  value={rateOverride}
                  onChange={(e) =>
                    setRateOverride(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
                {currency}
              </label>
            </details>
          </div>
        )}
      </div>

      <label className="field-label">Category</label>
      <CategoryGrid
        categories={categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
      />

      <div className="row">
        <label className="field">
          <span className="field-label">Date</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Note</span>
        <input
          type="text"
          placeholder="e.g. lunch with Sam"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={handleSave}
        >
          {initial ? "Save changes" : "Add expense"}
        </button>
      </div>
    </div>
  );
}
