import { CURRENCY_SYMBOL, type Currency } from "../types";

// Custom on-screen number pad so amount entry is instant and identical on iOS
// and Android (iOS Safari can't open the native keyboard without a tap).

/**
 * Apply a keypad press to the current amount string. Pure + testable.
 * Keys: "0".."9", ".", "back". Enforces a single decimal point, at most two
 * decimal places, and no pointless leading zeros (e.g. "00", "05").
 */
export function applyKeypad(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);

  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : current + ".";
  }

  // A digit.
  if (current.includes(".")) {
    const decimals = current.split(".")[1] ?? "";
    if (decimals.length >= 2) return current; // cap at 2 dp
    return current + key;
  }
  // Integer part: avoid leading zeros like "0", "05".
  if (current === "0") return key === "0" ? "0" : key;
  return current + key;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export function AmountKeypad({
  value,
  currency,
  onChange,
}: {
  value: string;
  currency: Currency;
  onChange: (next: string) => void;
}) {
  return (
    <div className="keypad">
      <div className="keypad-display">
        <span className="keypad-symbol">{CURRENCY_SYMBOL[currency]}</span>
        <span className="keypad-value">{value || "0"}</span>
      </div>
      <div className="keypad-grid">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`keypad-key ${k === "back" ? "keypad-back" : ""}`}
            aria-label={k === "back" ? "Delete" : k}
            onClick={() => onChange(applyKeypad(value, k))}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
