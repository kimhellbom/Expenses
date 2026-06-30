export type Tab = "add" | "history" | "stats" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "add", label: "Add", icon: "＋" },
  { id: "history", label: "History", icon: "≣" },
  { id: "stats", label: "Stats", icon: "▦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? "tab-active" : ""}`}
          onClick={() => onChange(t.id)}
          aria-current={active === t.id}
        >
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
