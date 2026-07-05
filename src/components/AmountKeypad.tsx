import { CURRENCY_SYMBOL, type Currency } from "../types";

// Custom on-screen number pad so amount entry is instant and identical on iOS
// and Android (iOS Safari can't open the native keyboard without a tap).
//
// "Pence mode": the value is a raw string of digits interpreted as pence, so
// the decimal point places itself automatically. Typing 1,2,3,4 gives £12.34;
// no dot key needed. A "00" key makes round amounts fast.

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

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];

export function AmountKeypad({
  digits,
  currency,
  onChange,
}: {
  digits: string;
  currency: Currency;
  onChange: (next: string) => void;
}) {
  return (
    <div className="keypad">
      <div className="keypad-display">
        <span className="keypad-symbol">{CURRENCY_SYMBOL[currency]}</span>
        <span className="keypad-value">{formatPence(digits)}</span>
      </div>
      <div className="keypad-grid">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`keypad-key ${k === "back" ? "keypad-back" : ""}`}
            aria-label={k === "back" ? "Delete" : k}
            onClick={() => onChange(applyPence(digits, k))}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
