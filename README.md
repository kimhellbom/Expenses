# Expenses

A personal, mobile-first **expense tracker** that works **offline**. It replaces a
paid expense app for the everyday job of logging spend (lunch, dinner, drinks) and
shows simple category-based stats.

## Why it's built this way
- **Local-only, offline-first.** Every expense is written straight to **IndexedDB** on
  your device and the app shell is precached by a **service worker (PWA)**, so logging
  works with no network and no account. Trade-off: data lives on one device — back it up
  from **Settings → Export backup**.
- **GBP is the base currency.** You can log in **GBP, EUR or TRY**; foreign amounts are
  converted to GBP at entry time and the **GBP value is stored as the source of truth**
  (the original amount/currency/rate are kept for reference).
- **Rates**: fetched from the free, no-key [Frankfurter](https://www.frankfurter.app/)
  (ECB) API when online and cached on-device; offline it uses the last cached rate, and
  you can override the rate manually on the entry form.
- **YAGNI**: expenses only — no income/transfers, accounts, sync, budgets or login.

## Categories
Seeded from a Money Manager setup: Restaurant, Groceries, Beers, Social Life, Lunch,
Coffee & Snack, Transport, Public transport, Travel, Culture, Household, Apparel,
Health, Education, Gift. Fully editable in **Settings**.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # unit tests (FX conversion + stats)
npm run build      # static PWA into dist/
npm run preview    # serve the production build (needed to exercise the service worker)
```

## Install on your phone
1. Host `dist/` on any static host (GitHub Pages, Netlify, Vercel, etc.).
2. Open it in mobile Safari/Chrome → **Share / ⋮ → Add to Home Screen**.
3. Launch it from the home screen; it runs standalone and works offline.

## Tech
Vite + React + TypeScript, `vite-plugin-pwa` (Workbox), `idb` for IndexedDB. No backend.
