import type { Currency } from "./types";

export function fmt(n: number, c: Currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: c,
      maximumFractionDigits: c === "JPY" ? 0 : 2,
    }).format(n || 0);
  } catch {
    return `${c} ${(n || 0).toFixed(2)}`;
  }
}

// Fallback rates (per 1 USD) used when the free FX API is unreachable.
const FALLBACK: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.37,
  JPY: 152,
  SGD: 1.34,
};

let cache: { at: number; rates: Record<string, number> } | null = null;

/** Rates per 1 USD. Uses the free, keyless Frankfurter API (ECB data). */
export async function usdRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.rates;
  try {
    const r = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,AUD,CAD,JPY,SGD",
      { signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { rates: Record<string, number> };
    cache = { at: Date.now(), rates: { USD: 1, ...j.rates } };
    return cache.rates;
  } catch {
    // Cache the fallback too so quotes and captures stay consistent.
    cache = { at: Date.now() - 50 * 60 * 1000, rates: FALLBACK };
    return FALLBACK;
  }
}

export async function convert(amount: number, from: Currency, to: Currency) {
  if (from === to) return amount;
  const r = await usdRates();
  const usd = amount / (r[from] ?? 1);
  return Math.round(usd * (r[to] ?? 1) * 100) / 100;
}
