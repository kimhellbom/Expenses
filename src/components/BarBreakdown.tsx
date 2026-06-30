import type { CategoryStat } from "../stats";
import { colorForIndex } from "./Donut";
import { formatGBP } from "../format";

// Ranked category list with proportional bars.
export function BarBreakdown({ stats }: { stats: CategoryStat[] }) {
  const max = stats.reduce((m, s) => Math.max(m, s.total), 0);
  return (
    <ul className="bars">
      {stats.map((s, i) => (
        <li key={s.categoryId} className="bar-row">
          <div className="bar-head">
            <span className="bar-label">
              <span aria-hidden>{s.emoji}</span> {s.name}
            </span>
            <span className="bar-value">
              {formatGBP(s.total)}
              <span className="bar-share"> · {Math.round(s.share * 100)}%</span>
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${max > 0 ? (s.total / max) * 100 : 0}%`,
                background: colorForIndex(i),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
