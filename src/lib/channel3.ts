// Channel3 product & merchant discovery (free tier: 1,000 credits/month, one per search).
// Helps a group find real things to buy (stays, gear, gifts) and see real prices in the kitty's
// currency before proposing a payment. Everything Channel3 returns is untrusted text, so each
// result goes through the prompt-injection guard before anything else sees it.
//
// Needs CHANNEL3_API_KEY (free at https://trychannel3.com). Without it the feature reports it is off.

import { convert } from "./money";
import { scan, sanitize, reason } from "./guard";
import type { Currency } from "./types";

const BASE = "https://api.trychannel3.com";
export const channel3Configured = () => !!process.env.CHANNEL3_API_KEY;

type Offer = { url: string; domain: string; price: { price: number; currency: string; compare_at_price?: number | null }; availability: string };
type Product = { id: string; title: string; description?: string | null; brands?: { id: string; name: string }[]; images?: { url: string; is_main_image?: boolean }[]; offers?: Offer[] };

export interface Suggestion {
  id: string;
  title: string;
  brand?: string;
  merchant: string; // merchant domain
  price: number; // in the kitty's base currency
  originalPrice: number;
  originalCurrency: string;
  inStock: boolean;
  url: string; // affiliate-tracked buy link
  image?: string;
  withinCap: boolean; // fits under the mandate's per-payment cap
}

const cache = new Map<string, { at: number; products: Product[] }>();
const TTL = 10 * 60_000; // a repeated search within 10 minutes costs no credit

export async function searchProducts(query: string, opts: { limit?: number; maxPriceUsd?: number } = {}): Promise<Product[]> {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) throw new Error("Product discovery is off: set CHANNEL3_API_KEY (free at trychannel3.com)");
  const q = sanitize(query, 200);
  if (!q) throw new Error("Give me something to look for");
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 30);
  const ck = JSON.stringify([q, limit, opts.maxPriceUsd ?? null]);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return hit.products;
  const r = await fetch(`${BASE}/v1/search`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, limit, ...(opts.maxPriceUsd ? { filters: { price: { max_price: opts.maxPriceUsd } } } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Channel3 search failed (${r.status})`);
  const j = (await r.json()) as { products?: Product[] };
  const products = j.products ?? [];
  cache.set(ck, { at: Date.now(), products });
  return products;
}

/** Search, drop anything the guard flags, and price every result in the kitty's currency. */
export async function discover(q: string, base: Currency, perPaymentCap: number, limit = 8): Promise<{ suggestions: Suggestion[]; quarantined: { title: string; reason: string }[] }> {
  const products = await searchProducts(q, { limit });
  const suggestions: Suggestion[] = [];
  const quarantined: { title: string; reason: string }[] = [];
  for (const p of products) {
    const offer = p.offers?.find((o) => o.availability === "InStock") ?? p.offers?.[0];
    if (!offer) continue;
    const v = scan(`${p.title}\n${p.description ?? ""}\n${p.brands?.map((b) => b.name).join(" ") ?? ""}`);
    if (v.blocked) {
      quarantined.push({ title: sanitize(p.title, 60), reason: reason(v) });
      continue;
    }
    const price = Math.round((await convert(offer.price.price, offer.price.currency as Currency, base)) * 100) / 100;
    suggestions.push({
      id: p.id,
      title: sanitize(p.title, 120),
      brand: p.brands?.[0] ? sanitize(p.brands[0].name, 40) : undefined,
      merchant: sanitize(offer.domain, 60),
      price,
      originalPrice: offer.price.price,
      originalCurrency: offer.price.currency,
      inStock: offer.availability === "InStock",
      url: offer.url,
      image: (p.images?.find((i) => i.is_main_image) ?? p.images?.[0])?.url,
      withinCap: price <= perPaymentCap,
    });
  }
  return { suggestions, quarantined };
}
