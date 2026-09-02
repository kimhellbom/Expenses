import { describe, it, expect } from "vitest";
import {
  ingestLines,
  parseAmountToken,
  parseCapture,
  parseInboxLine,
  prettyMerchant,
  splitInboxText,
  type PendingTxn,
} from "./capture";
import type { FxCache } from "./types";

const FX: FxCache = {
  base: "GBP",
  date: "2026-08-30",
  rates: { EUR: 1.17, TRY: 41.2 },
  fetchedAt: 0,
};

// Real Google Wallet notifications from the user's screenshots.
const WALLET_EUR = {
  ts: 1756590300000,
  title: "KARAGIANNIS IOANNI",
  text: "€7.50 with Barclaycard UK Mastercard Avios ••0005",
};

describe("parseAmountToken", () => {
  it("handles dot decimals and thousands", () => {
    expect(parseAmountToken("7.50")).toBe(7.5);
    expect(parseAmountToken("1,234.56")).toBe(1234.56);
  });
  it("handles a lone comma as decimal", () => {
    expect(parseAmountToken("7,50")).toBe(7.5);
  });
});

describe("parseCapture", () => {
  it("parses a real Wallet EUR notification", () => {
    const p = parseCapture(WALLET_EUR)!;
    expect(p.merchant).toBe("KARAGIANNIS IOANNI");
    expect(p.amount).toBe(7.5);
    expect(p.currency).toBe("EUR");
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("parses GBP and TRY symbols", () => {
    expect(parseCapture({ title: "Tesco", text: "£12.34 with card" })!.currency).toBe("GBP");
    expect(parseCapture({ title: "Shop", text: "₺450.00 with card" })!.currency).toBe("TRY");
  });
  it("returns null when there is no amount", () => {
    expect(parseCapture({ title: "X", text: "no money here" })).toBeNull();
  });
  it("gives the same fingerprint for the same notification", () => {
    expect(parseCapture(WALLET_EUR)!.fingerprint).toBe(parseCapture(WALLET_EUR)!.fingerprint);
  });
});

describe("splitInboxText", () => {
  it("separates JSON objects glued together without newlines", () => {
    const glued =
      '{"ts":1788252270346,"title":"Preparing your receipt","text":"We\'re adding the location"}' +
      '{"ts":1788252274017,"title":"K KOTSANITIS P TZIMI K","text":"€5.00 with Barclaycard ••0005"}';
    const lines = splitInboxText(glued);
    expect(lines).toHaveLength(2);
    const parsed = lines.map((l) => parseInboxLine(l));
    // The receipt line has no amount and is skipped; the payment parses.
    expect(parsed[0]).toBeNull();
    expect(parsed[1]!.merchant).toBe("K KOTSANITIS P TZIMI K");
    expect(parsed[1]!.amount).toBe(5);
    expect(parsed[1]!.currency).toBe("EUR");
  });
});

describe("parseInboxLine", () => {
  it("reads a JSON line", () => {
    const p = parseInboxLine(JSON.stringify(WALLET_EUR))!;
    expect(p.amount).toBe(7.5);
    expect(p.merchant).toBe("KARAGIANNIS IOANNI");
  });
  it("reads a tab-separated line", () => {
    const p = parseInboxLine("Pret\t£3.20 with card")!;
    expect(p.merchant).toBe("Pret");
    expect(p.currency).toBe("GBP");
    expect(p.amount).toBe(3.2);
  });
  it("reads a pipe-separated line with a ms timestamp", () => {
    const p = parseInboxLine("1756590300000|KARAGIANNIS IOANNI|€7.50 with Barclaycard")!;
    expect(p.merchant).toBe("KARAGIANNIS IOANNI");
    expect(p.amount).toBe(7.5);
    expect(p.currency).toBe("EUR");
    expect(p.ts).toBe(1756590300000);
  });
  it("normalises a seconds timestamp to milliseconds", () => {
    const p = parseInboxLine("1756590300|Shop|£5.00 with card")!;
    expect(p.ts).toBe(1756590300000);
  });
  it("reads a pipe line with no timestamp", () => {
    const p = parseInboxLine("Costa|£2.40 with card")!;
    expect(p.merchant).toBe("Costa");
    expect(p.amount).toBe(2.4);
  });
  it("skips blank lines", () => {
    expect(parseInboxLine("   ")).toBeNull();
  });
});

describe("prettyMerchant", () => {
  it("title-cases ALL-CAPS names", () => {
    expect(prettyMerchant("KEA BREEZE MON IKE")).toBe("Kea Breeze Mon Ike");
  });
  it("leaves mixed-case names untouched", () => {
    expect(prettyMerchant("Pret A Manger")).toBe("Pret A Manger");
  });
});

describe("ingestLines", () => {
  const base = {
    merchantRules: {},
    capturedKeys: [],
    pending: [] as PendingTxn[],
    fxCache: FX,
    categoryIds: new Set(["cat-lunch"]),
    now: 1756600000000,
  };

  it("queues an unknown merchant as pending", () => {
    const r = ingestLines({ ...base, lines: [JSON.stringify(WALLET_EUR)] });
    expect(r.autoAdded).toHaveLength(0);
    expect(r.newPending).toHaveLength(1);
    expect(r.newPending[0].merchant).toBe("KARAGIANNIS IOANNI");
  });

  it("collapses Wallet's duplicate re-posted notifications (same day, different ts)", () => {
    // Same merchant + amount, timestamps ~66 min apart (payment, then receipt update).
    const a = JSON.stringify({ ts: 1788292400692, title: "ENNEA KORES", text: "€45.75 with Barclaycard" });
    const b = JSON.stringify({ ts: 1788296358029, title: "ENNEA KORES", text: "€45.75 with Barclaycard" });
    const r = ingestLines({ ...base, lines: [a, b] });
    expect(r.newPending).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });

  it("writes the merchant into the note and tidies ALL-CAPS", () => {
    const r = ingestLines({
      ...base,
      lines: [JSON.stringify({ title: "ENNEA KORES", text: "€45.75 with card" })],
      merchantRules: { "ENNEA KORES": "cat-lunch" },
    });
    expect(r.autoAdded[0].note).toBe("Ennea Kores");
    expect(r.autoAdded[0].merchant).toBe("ENNEA KORES");
  });

  it("auto-files a known merchant and converts to GBP", () => {
    const r = ingestLines({
      ...base,
      lines: [JSON.stringify(WALLET_EUR)],
      merchantRules: { "KARAGIANNIS IOANNI": "cat-lunch" },
    });
    expect(r.newPending).toHaveLength(0);
    expect(r.autoAdded).toHaveLength(1);
    const e = r.autoAdded[0];
    expect(e.categoryId).toBe("cat-lunch");
    expect(e.originalCurrency).toBe("EUR");
    expect(e.amountGBP).toBe(6.41); // 7.50 / 1.17
    expect(e.source).toBe("auto");
    expect(e.id).toContain("auto:");
  });

  it("dedupes against captured keys", () => {
    const p = parseCapture(WALLET_EUR)!;
    const r = ingestLines({
      ...base,
      lines: [JSON.stringify(WALLET_EUR)],
      capturedKeys: [p.fingerprint],
    });
    expect(r.autoAdded).toHaveLength(0);
    expect(r.newPending).toHaveLength(0);
    expect(r.duplicates).toBe(1);
  });

  it("marks foreign transactions needsRate when no FX cache", () => {
    const r = ingestLines({
      ...base,
      lines: [JSON.stringify(WALLET_EUR)],
      merchantRules: { "KARAGIANNIS IOANNI": "cat-lunch" },
      fxCache: undefined,
    });
    expect(r.autoAdded).toHaveLength(0);
    expect(r.newPending[0].needsRate).toBe(true);
  });

  it("ignores a rule pointing at a deleted category", () => {
    const r = ingestLines({
      ...base,
      lines: [JSON.stringify(WALLET_EUR)],
      merchantRules: { "KARAGIANNIS IOANNI": "cat-gone" },
    });
    expect(r.autoAdded).toHaveLength(0);
    expect(r.newPending).toHaveLength(1);
  });
});
