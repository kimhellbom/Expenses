import { describe, it, expect } from "vitest";
import {
  amountToPence,
  applyPence,
  formatPence,
  penceToAmount,
} from "./AmountKeypad";

describe("applyPence", () => {
  it("accumulates digits as pence", () => {
    let d = "";
    for (const k of ["1", "2", "3", "4"]) d = applyPence(d, k);
    expect(d).toBe("1234");
    expect(penceToAmount(d)).toBe(12.34);
  });

  it("treats a single digit as pence", () => {
    expect(penceToAmount(applyPence("", "5"))).toBe(0.05);
  });

  it("supports the 00 key for round amounts", () => {
    let d = applyPence("", "1"); // 1
    d = applyPence(d, "5"); // 15
    d = applyPence(d, "00"); // 1500
    expect(d).toBe("1500");
    expect(penceToAmount(d)).toBe(15);
  });

  it("drops leading zeros so the value stays canonical", () => {
    expect(applyPence("", "0")).toBe("");
    expect(applyPence("", "00")).toBe("");
    expect(penceToAmount(applyPence("", "0"))).toBe(0);
  });

  it("backspaces one digit at a time", () => {
    expect(applyPence("1234", "back")).toBe("123");
    expect(applyPence("1", "back")).toBe("");
    expect(applyPence("", "back")).toBe("");
  });

  it("caps the number of digits", () => {
    let d = "";
    for (let i = 0; i < 20; i++) d = applyPence(d, "9");
    expect(d.length).toBeLessThanOrEqual(9);
  });
});

describe("formatPence", () => {
  it("always shows two decimals", () => {
    expect(formatPence("")).toBe("0.00");
    expect(formatPence("5")).toBe("0.05");
    expect(formatPence("850")).toBe("8.50");
    expect(formatPence("1500")).toBe("15.00");
  });

  it("groups thousands", () => {
    expect(formatPence("123456")).toBe("1,234.56");
  });
});

describe("amountToPence", () => {
  it("round-trips an amount", () => {
    expect(amountToPence(12.5)).toBe("1250");
    expect(penceToAmount(amountToPence(12.34))).toBe(12.34);
  });
  it("returns empty for zero/invalid", () => {
    expect(amountToPence(0)).toBe("");
    expect(amountToPence(NaN)).toBe("");
  });
});
