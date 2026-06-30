import { describe, it, expect } from "vitest";
import { convertToGBP, rateFor, round2 } from "./fx";
import type { FxCache } from "./types";

describe("round2", () => {
  it("rounds to two decimals without float drift", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(10)).toBe(10);
  });
});

describe("convertToGBP", () => {
  it("returns the amount unchanged for GBP", () => {
    expect(convertToGBP(12.5, "GBP", 1)).toBe(12.5);
  });

  it("converts EUR to GBP using units-per-GBP", () => {
    // 1 GBP = 1.17 EUR  =>  11.70 EUR = 10.00 GBP
    expect(convertToGBP(11.7, "EUR", 1.17)).toBe(10);
  });

  it("converts TRY to GBP", () => {
    // 1 GBP = 41.2 TRY  =>  412 TRY = 10.00 GBP
    expect(convertToGBP(412, "TRY", 41.2)).toBe(10);
  });

  it("returns NaN for a missing/invalid rate", () => {
    expect(Number.isNaN(convertToGBP(10, "EUR", 0))).toBe(true);
    expect(Number.isNaN(convertToGBP(10, "EUR", -1))).toBe(true);
  });
});

describe("rateFor", () => {
  const cache: FxCache = {
    base: "GBP",
    date: "2026-06-30",
    rates: { EUR: 1.17, TRY: 41.2 },
    fetchedAt: 0,
  };

  it("is always 1 for the base currency", () => {
    expect(rateFor("GBP", undefined)).toBe(1);
  });

  it("reads the rate from cache", () => {
    expect(rateFor("EUR", cache)).toBe(1.17);
    expect(rateFor("TRY", cache)).toBe(41.2);
  });

  it("is undefined when no cache is available", () => {
    expect(rateFor("EUR", undefined)).toBeUndefined();
  });
});
