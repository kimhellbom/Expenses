import { CURRENCIES, type Currency, type Expense, type FxCache } from "./types";
import { convertToGBP, rateFor, round2 } from "./fx";
import { toISODate } from "./format";

// Auto-capture pipeline. A MacroDroid macro appends each Google Wallet payment
// notification to a local file; the app imports that file, parses each line
// here, auto-files known merchants and queues unknown ones for a one-tap
// category. Everything below is pure so it can be unit-tested and stays offline.

/** One raw notification line from the inbox file. */
export interface RawCapture {
  /** Epoch ms of the notification (written by the macro). */
  ts?: number;
  /** Notification title = merchant descriptor, e.g. "KARAGIANNIS IOANNI". */
  title: string;
  /** Notification body, e.g. "€7.50 with Barclaycard UK Mastercard ••0005". */
  text: string;
}

export interface ParsedTxn {
  fingerprint: string;
  merchant: string;
  merchantKey: string;
  amount: number;
  currency: Currency;
  date: string;
  ts: number;
  raw: string;
}

export interface PendingTxn extends ParsedTxn {
  /** True when a foreign amount couldn't be converted (no FX rate yet). */
  needsRate?: boolean;
}

const SYMBOL_CURRENCY: Record<string, Currency> = {
  "£": "GBP",
  "€": "EUR",
  "₺": "TRY",
};

/** Normalise a merchant descriptor into a stable key for memory lookups. */
export function merchantKeyOf(title: string): string {
  return title.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Dedup fingerprint. Deliberately excludes the exact timestamp: Google Wallet
 * re-posts a payment notification (payment time, then again when the receipt is
 * updated), so the "same" transaction arrives with different timestamps. Keying
 * on merchant + amount + calendar day collapses those. (Trade-off: two genuinely
 * identical purchases at the same merchant on the same day merge into one — rare,
 * and a real second one can be added manually.)
 */
export function fingerprintOf(
  merchantKey: string,
  currency: Currency,
  amount: number,
  date: string,
): string {
  return `${date}|${merchantKey}|${currency}${amount.toFixed(2)}`;
}

/** Tidy an ALL-CAPS merchant descriptor for display; leave mixed-case as-is. */
export function prettyMerchant(name: string): string {
  const n = name.trim();
  if (/[a-z]/.test(n)) return n;
  return n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse a money token like "7.50", "1,234.56" or "7,50" into a number.
 * Wallet uses a dot decimal; we defensively handle a comma decimal too.
 */
export function parseAmountToken(token: string): number {
  let t = token.replace(/[^\d.,]/g, "");
  if (t.includes(",") && t.includes(".")) {
    t = t.replace(/,/g, ""); // comma = thousands separator
  } else if (t.includes(",") && !t.includes(".")) {
    // Lone comma: treat as decimal if it looks like ",dd", else thousands.
    t = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Find the first currency amount in a body string. */
function findAmount(text: string): { amount: number; currency: Currency } | null {
  // Symbol-prefixed, e.g. "€7.50".
  const sym = text.match(/([£€₺])\s?([\d.,]+)/);
  if (sym) {
    const currency = SYMBOL_CURRENCY[sym[1]];
    const amount = parseAmountToken(sym[2]);
    if (currency && Number.isFinite(amount) && amount > 0) return { amount, currency };
  }
  // ISO code, e.g. "7.50 EUR" or "EUR 7.50".
  const code = text.match(/\b(GBP|EUR|TRY)\b\s?([\d.,]+)|([\d.,]+)\s?\b(GBP|EUR|TRY)\b/);
  if (code) {
    const currency = (code[1] ?? code[4]) as Currency;
    const amount = parseAmountToken(code[2] ?? code[3]);
    if (CURRENCIES.includes(currency) && Number.isFinite(amount) && amount > 0) {
      return { amount, currency };
    }
  }
  return null;
}

/** Parse one raw notification into a transaction, or null if no amount found. */
export function parseCapture(raw: RawCapture, now = Date.now()): ParsedTxn | null {
  const found = findAmount(raw.text || "");
  if (!found) return null;
  const merchant = (raw.title || "").trim() || "Unknown merchant";
  const rawTs = typeof raw.ts === "number" && raw.ts > 0 ? raw.ts : undefined;
  // Accept either seconds ({system_time}) or milliseconds ({system_time_ms}).
  let ts = rawTs ?? now;
  if (ts < 1e12) ts *= 1000;
  const date = toISODate(new Date(ts));
  const merchantKey = merchantKeyOf(merchant);
  const fingerprint = fingerprintOf(merchantKey, found.currency, found.amount, date);
  return {
    fingerprint,
    merchant,
    merchantKey,
    amount: found.amount,
    currency: found.currency,
    date,
    ts,
    raw: `${raw.title} — ${raw.text}`,
  };
}

/**
 * Split raw inbox file text into individual entry lines. Tolerates a macro that
 * forgot per-entry newlines by also breaking apart concatenated JSON objects
 * (`}{` -> `}` / `{`).
 */
export function splitInboxText(text: string): string[] {
  return text
    .replace(/\}\s*\{/g, "}\n{")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse one inbox file line into a transaction. Accepts several macro output
 * shapes so setup is forgiving:
 *   - pipe/tab-separated:  `ts|title|text`  or  `title|text`  (recommended)
 *   - JSON object:         `{"ts":..,"title":"..","text":".."}`
 *   - plain text:          amount is still extracted; merchant unknown
 */
export function parseInboxLine(line: string, now = Date.now()): ParsedTxn | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let raw: RawCapture | null = null;

  if (trimmed.startsWith("{") && trimmed.includes('"text"')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      raw = {
        ts: typeof obj.ts === "number" ? obj.ts : undefined,
        title: String(obj.title ?? obj.merchant ?? ""),
        text: String(obj.text ?? obj.body ?? ""),
      };
    } catch {
      raw = null;
    }
  }

  if (!raw) {
    const delim = trimmed.includes("|") ? "|" : trimmed.includes("\t") ? "\t" : null;
    if (delim) {
      const parts = trimmed.split(delim).map((s) => s.trim());
      if (/^\d{9,}$/.test(parts[0])) {
        raw = { ts: Number(parts[0]), title: parts[1] ?? "", text: parts.slice(2).join(" ") };
      } else {
        raw = { title: parts[0], text: parts.slice(1).join(" ") };
      }
    }
  }

  if (!raw) raw = { title: "", text: trimmed };
  return parseCapture(raw, now);
}

export interface IngestInput {
  lines: string[];
  /** merchantKey -> categoryId */
  merchantRules: Record<string, string>;
  /** Fingerprints already resolved (added or dismissed). */
  capturedKeys: string[];
  /** Fingerprints already queued for review. */
  pending: PendingTxn[];
  fxCache?: FxCache;
  /** Valid category ids (a rule pointing at a deleted category is ignored). */
  categoryIds: Set<string>;
  now: number;
}

/** Deterministic expense id for a captured transaction (doubles as dedup key). */
export function autoExpenseId(fingerprint: string): string {
  return `auto:${fingerprint}`;
}

export interface IngestResult {
  autoAdded: Expense[];
  newPending: PendingTxn[];
  duplicates: number;
  failed: number;
}

/**
 * Turn raw inbox lines into auto-filed expenses (known merchants with a usable
 * FX rate) and pending items (unknown merchants, or foreign amounts with no
 * rate yet). Pure: the caller persists the result and updates capturedKeys.
 */
export function ingestLines(input: IngestInput): IngestResult {
  const seen = new Set<string>(input.capturedKeys);
  for (const p of input.pending) seen.add(p.fingerprint);

  const autoAdded: Expense[] = [];
  const newPending: PendingTxn[] = [];
  let duplicates = 0;
  let failed = 0;

  for (const line of input.lines) {
    const parsed = parseInboxLine(line, input.now);
    if (!parsed) {
      if (line.trim()) failed++;
      continue;
    }
    if (seen.has(parsed.fingerprint)) {
      duplicates++;
      continue;
    }
    seen.add(parsed.fingerprint);

    const ruleCat = input.merchantRules[parsed.merchantKey];
    const known = ruleCat && input.categoryIds.has(ruleCat);
    const rate = rateFor(parsed.currency, input.fxCache);
    const gbp =
      rate !== undefined ? convertToGBP(parsed.amount, parsed.currency, rate) : NaN;
    const rateOk = Number.isFinite(gbp);

    if (known && rateOk) {
      autoAdded.push({
        id: autoExpenseId(parsed.fingerprint),
        amountGBP: gbp,
        originalAmount: round2(parsed.amount),
        originalCurrency: parsed.currency,
        fxRate: parsed.currency === "GBP" ? 1 : (rate as number),
        categoryId: ruleCat,
        note: prettyMerchant(parsed.merchant),
        date: parsed.date,
        createdAt: parsed.ts,
        merchant: parsed.merchant,
        source: "auto",
      });
    } else {
      newPending.push({ ...parsed, needsRate: !rateOk });
    }
  }

  return { autoAdded, newPending, duplicates, failed };
}
