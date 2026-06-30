import { useRef, useState } from "react";
import { useStore } from "../store";
import {
  addCategory,
  exportBackup,
  importBackup,
  removeCategory,
  saveCategory,
  type Backup,
} from "../db";
import type { Category } from "../types";

export function Settings() {
  const { categories, fxCache, fxStatus, fxError, reload, reloadRates, online } =
    useStore();
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    await addCategory(newName, newEmoji);
    setNewName("");
    setNewEmoji("");
    await reload();
  }

  async function handleRename(cat: Category, name: string, emoji: string) {
    await saveCategory({ ...cat, name: name.trim() || cat.name, emoji: emoji.trim() || cat.emoji });
    await reload();
  }

  async function handleRemove(cat: Category) {
    if (!confirm(`Remove “${cat.name}”?`)) return;
    const result = await removeCategory(cat.id);
    await reload();
    setMessage(
      result === "archived"
        ? `“${cat.name}” has past expenses, so it was hidden rather than deleted.`
        : `Removed “${cat.name}”.`,
    );
  }

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      if (
        !confirm(
          `Import ${data.expenses?.length ?? 0} expenses? This replaces all current data.`,
        )
      )
        return;
      await importBackup(data);
      await reload();
      setMessage("Backup imported.");
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      {message && <p className="banner">{message}</p>}

      <section className="card">
        <h2>Categories</h2>
        <ul className="cat-edit-list">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              cat={c}
              onSave={handleRename}
              onRemove={handleRemove}
            />
          ))}
        </ul>
        <div className="cat-add">
          <input
            className="emoji-input"
            placeholder="🙂"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            maxLength={4}
          />
          <input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
            Add
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Exchange rates</h2>
        {fxCache ? (
          <p className="muted">
            ECB rates from {fxCache.date}: 1 GBP ={" "}
            {fxCache.rates.EUR ? `${fxCache.rates.EUR} EUR` : "—"},{" "}
            {fxCache.rates.TRY ? `${fxCache.rates.TRY} TRY` : "—"}.
          </p>
        ) : (
          <p className="muted">No rates cached yet.</p>
        )}
        {fxStatus === "error" && fxError && <p className="fx-warn">{fxError}</p>}
        {fxStatus === "ok" && <p className="fx-converted">Rates up to date.</p>}
        <button
          className="btn btn-ghost"
          onClick={() => reloadRates()}
          disabled={!online || fxStatus === "loading"}
        >
          {fxStatus === "loading"
            ? "Refreshing…"
            : online
              ? "Refresh rates"
              : "Offline — can't refresh"}
        </button>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">
          Your data lives only on this device. Export a JSON backup regularly, or to move to a
          new phone.
        </p>
        <div className="backup-actions">
          <button className="btn btn-ghost" onClick={handleExport}>
            Export backup
          </button>
          <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>
    </div>
  );
}

function CategoryRow({
  cat,
  onSave,
  onRemove,
}: {
  cat: Category;
  onSave: (cat: Category, name: string, emoji: string) => void;
  onRemove: (cat: Category) => void;
}) {
  const [name, setName] = useState(cat.name);
  const [emoji, setEmoji] = useState(cat.emoji);
  const dirty = name !== cat.name || emoji !== cat.emoji;

  return (
    <li className="cat-edit-row">
      <input
        className="emoji-input"
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        maxLength={4}
      />
      <input value={name} onChange={(e) => setName(e.target.value)} />
      {dirty ? (
        <button className="icon-btn" aria-label="Save" onClick={() => onSave(cat, name, emoji)}>
          ✓
        </button>
      ) : (
        <button className="icon-btn" aria-label="Remove" onClick={() => onRemove(cat)}>
          🗑
        </button>
      )}
    </li>
  );
}
