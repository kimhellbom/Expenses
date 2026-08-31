import { describe, it, expect } from "vitest";
import {
  ingestLines,
  parseAmountToken,
  parseCapture,
  parseInboxLine,
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
