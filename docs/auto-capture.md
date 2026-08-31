# Auto-capture: log expenses from Google Wallet notifications

Kill manual entry. When you pay with Google Wallet, Android shows a notification
like:

> **KARAGIANNIS IOANNI** · €7.50 with Barclaycard UK Mastercard Avios ••0005

That notification already contains the merchant, amount, and currency as **text**.
A small [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid)
macro appends each one to a file on your phone; the app imports that file,
**auto-files merchants it already knows**, and asks you to tag new ones once.

**Nothing leaves your phone.** MacroDroid only writes to a local file; the app
only reads it. There is no server, no third-party upload, and no AI required.

---

## One-time setup

### 1. Install MacroDroid

From the Play Store (free tier is enough — this needs one macro).

### 2. Create the macro

**Add macro → Trigger → Device Events → "Notification Received"**
- Application: **Google Wallet**
- (Optional) restrict to notifications that contain "with" so only payments fire.

**Add Action → Files → "Write to File"**
- File: `Documents/expenses-inbox.jsonl` (any folder you can find in Files)
- Mode: **Append** (not overwrite)
- Add a **newline** after each entry (enable "Add new line", or end the content with `\n`)
- Content — insert MacroDroid's magic-text variables where shown:

```json
{"ts":[timestamp],"title":"[notification_title]","text":"[notification_text]"}
```

Use the `{x}` magic-text button to pick:
- `[timestamp]` → the notification time in milliseconds (optional but recommended — it makes de-duplication exact)
- `[notification_title]` → the merchant
- `[notification_text]` → the "€7.50 with …" line

Save the macro.

### 3. Grant permission

MacroDroid will ask for **Notification access** the first time — allow it. This
permission stays on your device.

### 4. Import in the app

Pay as normal a few times, then open **Expenses → Settings → Auto-capture →
Import transactions** and pick `expenses-inbox.jsonl`.

- Merchants you've tagged before are **filed automatically**.
- New merchants appear under **Review** — tap a category once (leave "Remember"
  on) and that merchant auto-files from then on.

Re-importing the same file is safe: already-imported transactions are skipped.

---

## How it works

- **Parsing** is pure text: the merchant is the notification title; a regex reads
  the amount and currency symbol (`£`/`€`/`₺`). Foreign amounts convert to GBP
  using the app's cached ECB rates.
- **De-duplication** uses a fingerprint of `timestamp + merchant + amount`, so the
  same notification never becomes two expenses even if you import repeatedly.
- **Merchant memory** (`merchant → category`) is stored locally and included in
  your JSON backup, so it survives a move to a new phone.
- Captured expenses are tagged `source: "auto"` and keep the raw `merchant`
  string; you can still edit or delete them in History like any other.

## Privacy & offline

- The macro performs **no network action** — it writes a local file only.
- The app reads that file locally; import works with no connection (currency
  conversion uses cached rates).
- The only new app is MacroDroid, which you grant notification access to. If you
  prefer zero extra apps, the manual keypad entry still works exactly as before.

## Troubleshooting

- **"No new transactions found."** The file was empty or every line was already
  imported. Check the macro's file path and that it's set to **Append**.
- **"N unreadable."** A line had no recognisable amount — check the content
  template uses `[notification_text]`.
- **Wrong currency/amount.** The notification text was unusual; edit the expense
  in History, or adjust the macro to include the amount line.
- **A merchant files to the wrong category.** Remove it under **Settings →
  Remembered merchants**, then re-tag it on the next import.
