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
- Access: **All File Access**, Folder `Documents`, Filename `expenses-inbox.txt`
- Mode: **Append**
- In the text field, enter (start with a leading `\n` so each entry is on its own line):

```
{system_time_ms}|{not_title}|{notification}
```

> **Important:** insert each `{…}` value from the **magic-text button** (the `…`
> beside the text field) — do **not** type them. MacroDroid's magic text uses
> curly braces `{…}`; typing the names writes them literally instead of the value.
> Type the `|` bars yourself between the inserted tokens.

The tokens (from the magic-text picker):
- `{system_time_ms}` → time in milliseconds — pick **System time (ms)**. (Seconds,
  `{system_time}`, also works — the app normalises it.)
- `{not_title}` → the merchant — **Notification Title**
- `{notification}` → the message, e.g. "€7.50 with Barclaycard …"

The app also accepts a JSON line (`{"ts":..,"title":"..","text":".."}`) if you
prefer, but pipe-separated avoids any quoting issues.

Save the macro.

### 3. Grant permission

MacroDroid will ask for **Notification access** the first time — allow it. This
permission stays on your device.

### 4. Import in the app

Pay as normal a few times, then open **Expenses → Settings → Auto-capture →
Import transactions** and pick `expenses-inbox.txt`.

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
- **Lines show `{not_title}` / `{notification}` literally.** MacroDroid didn't
  substitute the variables — you typed them instead of inserting them from the
  magic-text (`…`) button. Fix the macro's text, then pay again.
- **"N unreadable."** A line had no recognisable amount — check the content uses
  the `[notification]` token for the message.
- **Wrong currency/amount.** The notification text was unusual; edit the expense
  in History, or adjust the macro to include the amount line.
- **A merchant files to the wrong category.** Remove it under **Settings →
  Remembered merchants**, then re-tag it on the next import.
