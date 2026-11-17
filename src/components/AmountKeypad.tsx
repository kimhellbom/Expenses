import { memo, useState } from "react";
import { CURRENCY_SYMBOL, type Currency } from "../types";
import { applyCalcKey, evalExpr, prettyExpr } from "../calc";

// Custom on-screen number pad so amount entry is instant and identical on iOS
// and Android (iOS Safari can't open the native keyboard without a tap).
//
// "Pence mode": the value is a raw string of digits interpreted as pence, so
// the decimal point places itself automatically. Typing 1,2,3,4 gives £12.34;
// no dot key needed. A "00" key makes round amounts fast. A calculator mode
// (toggled by the icon) lets you collate several small expenses into one.

const MAX_DIGITS = 9; // up to £9,999,999.99

/**
 * Apply a keypad press to the raw digit string. Pure + testable.
 * Keys: "0".."9", "00", "back". Leading zeros are dropped so the value stays
 * canonical ("" means zero).
 */
export function applyPence(digits: string, key: string): string {
  if (key === "back") return digits.slice(0, -1);
  const add = key === "00" ? "00" : key;
  const next = (digits + add).replace(/^0+/, ""); // drop leading zeros
  return next.slice(0, MAX_DIGITS);
}

/** Raw pence-digits -> numeric amount (e.g. "1234" -> 12.34, "" -> 0). */
export function penceToAmount(digits: string): number {
  return digits === "" ? 0 : Number(digits) / 100;
}

/** Numeric amount -> raw pence-digits (e.g. 12.5 -> "1250"). */
export function amountToPence(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return String(Math.round(amount * 100));
}

/** Formatted display string, always two decimals with grouping (e.g. "1,234.50"). */
export function formatPence(digits: string): string {
  return penceToAmount(digits).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];

// prettier-ignore
const CALC_KEYS = [
  "clear", "/", "*", "back",
  "7", "8", "9", "-",
  "4", "5", "6", "+",
  "1", "2", "3", "=",
  "0", "00", ".", "done",
];
const CALC_GLYPH: Record<string, string> = {
  clear: "AC", "/": "÷", "*": "×", "-": "−", "+": "+", back: "⌫", "=": "=", done: "Done",
};
const CALC_OPS = new Set(["clear", "/", "*", "-", "+"]);

function CalcIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx="0.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Grid of nine dots — "back to the number pad".
function KeypadIcon() {
  const dots = [7, 12, 17];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      {dots.map((y) =>
        dots.map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

export const AmountKeypad = memo(function AmountKeypad({
  digits,
  currency,
  onChange,
}: {
  digits: string;
  currency: Currency;
  onChange: (next: string) => void;
}) {
  const [calc, setCalc] = useState(false);
  const [expr, setExpr] = useState("");

  function openCalc() {
    const amt = penceToAmount(digits);
    setExpr(amt > 0 ? String(amt) : "");
    setCalc(true);
  }

  if (calc) {
    const live = evalExpr(expr);
    function press(k: string) {
      if (k === "done") {
        const v = evalExpr(expr);
        onChange(v && v > 0 ? amountToPence(v) : "");
        setCalc(false);
        return;
      }
      if (k === "=") {
        const v = evalExpr(expr);
        setExpr(v === null ? "" : String(Math.round(v * 1e9) / 1e9));
        return;
      }
      setExpr((e) => applyCalcKey(e, k));
    }
    return (
      <div className="keypad">
        <div className="keypad-display keypad-display-calc">
          <button
            type="button"
            className="keypad-calc-btn"
            aria-label="Back to keypad"
            onClick={() => setCalc(false)}
          >
            <KeypadIcon />
          </button>
          <div className="calc-result">
            <span className="keypad-symbol">{CURRENCY_SYMBOL[currency]}</span>
            <span className="keypad-value">{formatAmount(live ?? 0)}</span>
          </div>
          <div className="calc-expr">{prettyExpr(expr) || " "}</div>
        </div>
        <div className="keypad-grid calc-grid">
          {CALC_KEYS.map((k, i) => (
            <button
              key={`${k}-${i}`}
              type="button"
              className={
                "keypad-key" +
                (CALC_OPS.has(k) ? " calc-op" : "") +
                (k === "=" ? " calc-eq" : "") +
                (k === "done" ? " calc-done" : "") +
                (k === "back" ? " keypad-back" : "")
              }
              aria-label={k === "clear" ? "Clear" : k === "back" ? "Delete" : CALC_GLYPH[k] ?? k}
              onPointerDown={() => press(k)}
            >
              {CALC_GLYPH[k] ?? k}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="keypad">
      <div className="keypad-display">
        <span className="keypad-symbol">{CURRENCY_SYMBOL[currency]}</span>
        {/* key re-mounts the span on each change so the pop animation replays. */}
        <span className="keypad-value" key={digits}>
          {formatPence(digits)}
        </span>
        <button
          type="button"
          className="keypad-calc-btn"
          aria-label="Calculator"
          onClick={openCalc}
        >
          <CalcIcon />
        </button>
      </div>
      <div className="keypad-grid">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`keypad-key ${k === "back" ? "keypad-back" : ""}`}
            aria-label={k === "back" ? "Delete" : k}
            // Fire on pointerdown (not click) so rapid taps register the instant
            // the finger lands — no click-settle delay, no dropped presses.
            onPointerDown={() => onChange(applyPence(digits, k))}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
    </div>
  );
});
