import { CURRENCY_SYMBOL, type Currency } from "./types";

export function formatMoney(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatGBP(amount: number): string {
  return formatMoney(amount, "GBP");
}

/** "Today" / "Yesterday" / e.g. "Mon 15 Jun" for an ISO date. */
export function friendlyDate(isoDate: string): string {
  const today = todayISO();
  if (isoDate === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (isoDate === toISODate(y)) return "Yesterday";
  const [yr, mo, da] = isoDate.split("-").map(Number);
  return new Date(yr, mo - 1, da).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}
