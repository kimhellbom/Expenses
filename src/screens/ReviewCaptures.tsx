import { useEffect, useState } from "react";
import { useStore } from "../store";
import { dismissPending, resolvePending } from "../db";
import { convertToGBP, rateFor } from "../fx";
import { formatGBP, formatMoney, friendlyDate } from "../format";
import { CategoryGrid } from "../components/CategoryGrid";

// Review queue for auto-captured transactions whose merchant hasn't been seen
// before. Known merchants are auto-filed elsewhere and never reach here. Picking
// a category (with "remember" on) teaches the merchant so it auto-files next time.
export function ReviewCaptures({ onDone }: { onDone: () => void }) {
  const { pending, categories, fxCache, reload } = useStore();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const item = pending[0];

  // Reset the picker whenever we advance to the next transaction.
  useEffect(() => {
    setCategoryId(null);
    setRemember(true);
  }, [item?.fingerprint]);

  useEffect(() => {
    if (pending.length === 0) onDone();
  }, [pending.length, onDone]);

  if (!item) return null;

  const rate = rateFor(item.currency, fxCache);
  const gbp = rate !== undefined ? convertToGBP(item.amount, item.currency, rate) : NaN;

  async function add() {
    if (!categoryId || !item || busy) return;
    setBusy(true);
    await resolvePending(item.fingerprint, categoryId, remember);
    await reload();
    setBusy(false);
  }

  async function skip() {
    if (!item || busy) return;
    setBusy(true);
    await dismissPending(item.fingerprint);
    await reload();
    setBusy(false);
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Review</h1>
        <button type="button" className="btn btn-ghost review-close" onClick={onDone}>
          Done
        </button>
      </header>

      <p className="review-progress">
        {pending.length} to review
      </p>

      <div className="review-card">
        <div className="review-merchant">{item.merchant}</div>
        <div className="review-amount">
          {formatMoney(item.amount, item.currency)}
          {item.currency !== "GBP" && (
            <span className="review-gbp">
              {Number.isFinite(gbp) ? `≈ ${formatGBP(gbp)}` : "· no rate yet"}
            </span>
          )}
        </div>
        <div className="review-meta">{friendlyDate(item.date)}</div>
      </div>

      <label className="field-label">Category</label>
      <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />

      <label className="review-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Remember <strong>{item.merchant}</strong> — auto-file next time
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={skip} disabled={busy}>
          Skip
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={add}
          disabled={!categoryId || busy}
        >
          Add expense
        </button>
      </div>
    </div>
  );
}
