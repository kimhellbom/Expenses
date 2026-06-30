/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Local-only, installable, offline-first PWA. The app shell is precached by
// Workbox so the app loads with no network; all data lives in IndexedDB.
export default defineConfig({
  // Relative base so the build works whether hosted at a domain root or a subpath
  // (e.g. GitHub Pages project pages).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Expense Tracker",
        short_name: "Expenses",
        description: "Log daily expenses, offline-first.",
        theme_color: "#0f766e",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Frankfurter FX rates: serve from network, fall back to cache offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.href.includes("frankfurter.app"),
            handler: "NetworkFirst",
            options: {
              cacheName: "fx-rates",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
  },
});
