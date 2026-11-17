// A small, safe calculator for the amount field — lets you collate several
// small expenses into one (e.g. "2.50 + 3 + 1.80"). Internally the expression
// uses ASCII operators (+ - * /); the UI shows ×, ÷, −.

/** Apply a calculator key to the expression string. Pure + testable. */
export function applyCalcKey(expr: string, key: string): string {
  if (key === "clear") return "";
  if (key === "back") return expr.slice(0, -1);

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    if (expr === "") return ""; // no leading operator
    if (/[+\-*/]$/.test(expr)) return expr.slice(0, -1) + key; // replace trailing op
    return expr + key;
  }

  if (key === ".") {
    const currentNumber = expr.split(/[+\-*/]/).pop() ?? "";
    if (currentNumber.includes(".")) return expr; // one dot per number
    return expr === "" || /[+\-*/]$/.test(expr) ? expr + "0." : expr + ".";
  }

  if (key === "00") return applyCalcKey(applyCalcKey(expr, "0"), "0");

  if (/^[0-9]$/.test(key)) return expr + key;

  return expr;
}

/**
 * Evaluate an expression with standard × ÷ precedence. A trailing operator is
 * ignored (so a live preview works mid-entry). Returns null when there's nothing
 * to evaluate or on divide-by-zero.
 */
export function evalExpr(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/]/g);
  if (!tokens) return null;
  const toks = [...tokens];
  while (toks.length && /[+\-*/]/.test(toks[toks.length - 1])) toks.pop();
  if (toks.length && /[+\-*/]/.test(toks[0])) toks.shift(); // no leading operator
  if (!toks.length) return null;

  // First pass: * and /.
  const pass1: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "*" || t === "/") {
      const a = Number(pass1.pop());
      const b = Number(toks[++i]);
      if (t === "/" && b === 0) return null;
      pass1.push(String(t === "*" ? a * b : a / b));
    } else {
      pass1.push(t);
    }
  }
  // Second pass: + and -.
  let acc = Number(pass1[0]);
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const b = Number(pass1[i + 1]);
    acc = op === "+" ? acc + b : acc - b;
  }
  return Number.isFinite(acc) ? acc : null;
}

/** Whether the expression contains at least one operator between numbers. */
export function hasOperation(expr: string): boolean {
  return /\d[+\-*/]\d/.test(expr) || /\d[+\-*/]$/.test(expr);
}

/** Expression with pretty operator glyphs for display. */
export function prettyExpr(expr: string): string {
  return expr.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, " − ").replace(/\+/g, " + ");
}
