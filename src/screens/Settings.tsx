import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import {
  addCategory,
  exportBackup,
  getMerchantRules,
  importBackup,
  importInbox,
  removeCategory,
  removeMerchantRule,
  saveCategory,
  type Backup,
} from "../db";
import { splitInboxText } from "../capture";
import type { Category } from "../types";

export function Settings({ onReview }: { onReview: () => void }) {
  const { categories, pending, fxCache, fxStatus, fxError, reload, reloadRates, online } =
    useStore();
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const inboxInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rules, setRules] = useState<Record<string, string>>({});

  useEffect(() => {
    void getMerchantRules().then(setRules);
  }, []);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  async function handleImportInbox(file: File) {
    try {
      const lines = splitInboxText(await file.text());
      const res = await importInbox(lines);
      await reload();
      setRules(await getMerchantRules());
      // Detect the classic MacroDroid mistake: variable names written literally.
      const unfilled = lines.some((l) =>
        /[[{](not_title|notification|system_time_ms|system_time|notification_title|notification_text|timestamp)[\]}]/.test(l),
      );
      if (unfilled && res.added + res.pending === 0) {
        setMessage(
          "Those lines still show the MacroDroid variable names (e.g. {not_title}) instead of real values. In the macro's Write-to-File text, insert each value from the magic-text (…) button rather than typing it, then pay again.",
        );
        return;
      }
      // Non-payment notifications (e.g. Wallet's "preparing your receipt") have
      // no amount and are silently ignored — not surfaced as errors.
      const parts: string[] = [];
      if (res.added) parts.push(`${res.added} auto-filed`);
      if (res.pending) parts.push(`${res.pending} to review`);
      if (res.duplicates) parts.push(`${res.duplicates} already imported`);
      setMessage(parts.length ? `Imported — ${parts.join(", ")}.` : "No new transactions found.");
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  }

  async function forgetMerchant(key: string) {
    await removeMerchantRule(key);
    setRules(await getMerchantRules());
  }

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
        <h2>Auto-capture</h2>
        <p className="muted">
          Log expenses straight from your Google Wallet payment notifications — no
          typing. Import the file your MacroDroid macro writes; known merchants file
          themselves, new ones you tag once and they're remembered.
        </p>
        {pending.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={onReview}>
            Review {pending.length} pending
          </button>
        )}
        <div className="backup-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => inboxInput.current?.click()}
          >
            Import transactions
          </button>
          <input
            ref={inboxInput}
            type="file"
            accept=".jsonl,.json,.txt,text/plain,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportInbox(f);
              e.target.value = "";
            }}
          />
        </div>

        {Object.keys(rules).length > 0 && (
          <div className="merchant-memory">
            <h3>Remembered merchants</h3>
            <ul className="cat-edit-list">
              {Object.entries(rules).map(([key, catId]) => (
                <li key={key} className="merchant-row">
                  <span className="merchant-name">{key}</span>
                  <span className="merchant-cat">{catName(catId)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Forget ${key}`}
                    onClick={() => void forgetMerchant(key)}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="setup-guide">
          <summary>Set up auto-capture (one-time)</summary>
          <ol className="setup-steps">
            <li>Install <strong>MacroDroid</strong> from the Play Store (free).</li>
            <li>
              New macro → <strong>Trigger</strong>: Device Events → “Notification
              Received” → select <strong>Google Wallet</strong>.
            </li>
            <li>
              <strong>Action</strong>: Files → “Write to File” → <strong>All File
              Access</strong>, folder <code>Documents</code>, filename{" "}
              <code>expenses-inbox.txt</code>, mode <strong>Append</strong>, and in
              the text field enter (with a leading <code>{"\\n"}</code>):
              <code className="setup-code">{"{system_time_ms}|{not_title}|{notification}"}</code>
              <strong>Insert each <code>{"{…}"}</code> from the magic-text button</strong>{" "}
              (the <code>…</code> beside the field) — pick <em>System time (ms)</em>,{" "}
              <em>Notification Title</em>, <em>Notification</em> — and type the{" "}
              <code>|</code> bars between them yourself.
            </li>
            <li>Grant MacroDroid notification access when prompted.</li>
            <li>
              Pay as normal, then back here tap <strong>Import transactions</strong>{" "}
              and choose that file. Nothing leaves your phone.
            </li>
          </ol>
        </details>
      </section>

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
