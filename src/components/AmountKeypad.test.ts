import { describe, it, expect } from "vitest";
import { applyKeypad } from "./AmountKeypad";

describe("applyKeypad", () => {
  it("appends digits", () => {
    let v = "";
    v = applyKeypad(v, "1");
    v = applyKeypad(v, "2");
    expect(v).toBe("12");
  });

  it("avoids leading zeros", () => {
    expect(applyKeypad("0", "0")).toBe("0");
    expect(applyKeypad("0", "5")).toBe("5");
    expect(applyKeypad("", "0")).toBe("0");
  });

  it("starts a decimal from nothing", () => {
    expect(applyKeypad("", ".")).toBe("0.");
    expect(applyKeypad("5", ".")).toBe("5.");
  });

  it("allows only one decimal point", () => {
    expect(applyKeypad("5.5", ".")).toBe("5.5");
  });

  it("caps at two decimal places", () => {
    let v = applyKeypad("1.2", "3"); // 1.23
    expect(v).toBe("1.23");
    v = applyKeypad(v, "4"); // ignored
    expect(v).toBe("1.23");
  });

  it("backspaces", () => {
    expect(applyKeypad("1.2", "back")).toBe("1.");
    expect(applyKeypad("1", "back")).toBe("");
    expect(applyKeypad("", "back")).toBe("");
  });

  it("builds a typical amount", () => {
    let v = "";
    for (const k of ["1", "2", ".", "5", "0"]) v = applyKeypad(v, k);
    expect(v).toBe("12.50");
    expect(Number(v)).toBe(12.5);
  });
});
