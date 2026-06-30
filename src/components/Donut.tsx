import type { CategoryStat } from "../stats";

// Hand-rolled SVG donut (no chart dependency). Renders one arc per category.
const COLORS = [
  "#0f766e",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

export function colorForIndex(i: number): string {
  return COLORS[i % COLORS.length];
}

export function Donut({
  stats,
  total,
  symbol,
}: {
  stats: CategoryStat[];
  total: number;
  symbol: string;
}) {
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg
      className="donut"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Spending by category"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1f2937"
          strokeWidth={stroke}
        />
        {stats.map((s, i) => {
          const len = s.share * c;
          const seg = (
            <circle
              key={s.categoryId}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colorForIndex(i)}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </g>
      <text x="50%" y="46%" className="donut-total" textAnchor="middle">
        {symbol}
        {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </text>
      <text x="50%" y="60%" className="donut-sub" textAnchor="middle">
        this period
      </text>
    </svg>
  );
}
