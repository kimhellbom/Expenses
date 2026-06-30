import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshRates } from "./fx";
import { FX_CACHE_KEY, setMeta } from "./db";

function okResponse(rates: Record<string, number>) {
  return {
    ok: true,
    json: async () => ({ base: "GBP", date: "2026-06-30", rates }),
  } as Response;
}

describe("refreshRates", () => {
  beforeEach(async () => {
    // Start each test with no cached rates. (The module keeps one DB connection
    // open, so we clear the key rather than deleting the database.)
    await setMeta(FX_CACHE_KEY, undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and caches from the primary endpoint", async () => {
    const fetchMock = vi.fn(async () => okResponse({ EUR: 1.17, TRY: 41.2 }));
    vi.stubGlobal("fetch", fetchMock);

    const { cache, error } = await refreshRates();
    expect(error).toBeUndefined();
    expect(cache?.rates.EUR).toBe(1.17);
    expect(cache?.rates.TRY).toBe(41.2);
    // Only the first (primary) endpoint should be needed.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy endpoint when the primary fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(okResponse({ EUR: 1.2, TRY: 40 }));
    vi.stubGlobal("fetch", fetchMock);

    const { cache, error } = await refreshRates();
    expect(error).toBeUndefined();
    expect(cache?.rates.EUR).toBe(1.2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports an error and no fresh cache when all endpoints fail", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { cache, error } = await refreshRates();
    expect(cache).toBeUndefined(); // nothing cached previously
    expect(error).toBeTruthy();
  });

  it("keeps the previous cache when a later refresh fails", async () => {
    // First, a successful fetch populates the cache.
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ EUR: 1.1, TRY: 39 })));
    await refreshRates();

    // Then every endpoint fails; the prior cache should survive.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const { cache, error } = await refreshRates();
    expect(error).toBeTruthy();
    expect(cache?.rates.EUR).toBe(1.1);
  });
});
