import type { Category } from "../types";

// Money-Manager-style grid of emoji tiles for fast category selection.
export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="cat-grid">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`cat-tile ${selectedId === c.id ? "cat-tile-active" : ""}`}
          onClick={() => onSelect(c.id)}
        >
          <span className="cat-emoji" aria-hidden>
            {c.emoji}
          </span>
          <span className="cat-name">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
