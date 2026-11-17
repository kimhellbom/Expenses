import { describe, it, expect } from "vitest";
import { applyCalcKey, evalExpr, hasOperation, prettyExpr } from "./calc";

describe("applyCalcKey", () => {
  it("appends digits", () => {
    let e = "";
    for (const k of ["1", "2", "3"]) e = applyCalcKey(e, k);
    expect(e).toBe("123");
  });

  it("'00' appends two zeros", () => {
    expect(applyCalcKey("5", "00")).toBe("500");
  });

  it("clears and backspaces", () => {
    expect(applyCalcKey("123", "back")).toBe("12");
    expect(applyCalcKey("123", "clear")).toBe("");
    expect(applyCalcKey("", "back")).toBe("");
  });

  it("ignores a leading operator", () => {
    expect(applyCalcKey("", "+")).toBe("");
    expect(applyCalcKey("", "*")).toBe("");
  });

  it("replaces a trailing operator rather than stacking", () => {
    expect(applyCalcKey("5+", "-")).toBe("5-");
    expect(applyCalcKey("5*", "/")).toBe("5/");
  });

  it("appends an operator between numbers", () => {
    expect(applyCalcKey("5", "+")).toBe("5+");
    expect(applyCalcKey("5+3", "*")).toBe("5+3*");
  });

  it("handles the decimal point", () => {
    expect(applyCalcKey("5", ".")).toBe("5.");
    expect(applyCalcKey("5.2", ".")).toBe("5.2"); // only one dot per number
    expect(applyCalcKey("", ".")).toBe("0."); // leading dot becomes 0.
    expect(applyCalcKey("5+", ".")).toBe("5+0."); // dot after operator
    expect(applyCalcKey("1.5+2", ".")).toBe("1.5+2."); // second number can have its own dot
  });
});

describe("evalExpr", () => {
  it("returns null for empty / operator-only input", () => {
    expect(evalExpr("")).toBeNull();
    expect(evalExpr("+")).toBeNull();
  });

  it("sums the collate-expenses case", () => {
    expect(evalExpr("2.50+3+1.80")).toBeCloseTo(7.3, 10);
  });

  it("respects × ÷ precedence", () => {
    expect(evalExpr("2+3*4")).toBe(14);
    expect(evalExpr("12/4+1")).toBe(4);
    expect(evalExpr("2*3+4*5")).toBe(26);
  });

  it("subtracts", () => {
    expect(evalExpr("10-3-2")).toBe(5);
  });

  it("ignores a trailing operator (live preview mid-entry)", () => {
    expect(evalExpr("5+")).toBe(5);
    expect(evalExpr("2+3*")).toBe(5);
  });

  it("returns null on divide-by-zero", () => {
    expect(evalExpr("5/0")).toBeNull();
  });

  it("handles a single number", () => {
    expect(evalExpr("42")).toBe(42);
    expect(evalExpr("0.99")).toBeCloseTo(0.99, 10);
  });
});

describe("hasOperation", () => {
  it("detects an operator between/after numbers", () => {
    expect(hasOperation("2+3")).toBe(true);
    expect(hasOperation("2+")).toBe(true);
    expect(hasOperation("25")).toBe(false);
    expect(hasOperation("")).toBe(false);
  });
});

describe("prettyExpr", () => {
  it("swaps in display glyphs", () => {
    expect(prettyExpr("2*3/4-1+5")).toBe("2 × 3 ÷ 4 − 1 + 5");
  });
});
