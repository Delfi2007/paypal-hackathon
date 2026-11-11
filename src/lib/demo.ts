// One-click demo: a visitor gets a ready-made group of three friends and can switch
// between them, so the whole flow (sign, pay, vote, payout) is testable from one browser.
// Demo accounts live on a reserved email domain that nobody can sign up with.

export const DEMO_DOMAIN = "@demo.kitty.test";
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(DEMO_DOMAIN);
/** On by default; set KITTY_DEMO=off to remove the demo entry point. */
export const demoEnabled = () => process.env.KITTY_DEMO !== "off";

/** The three friends of a demo group. Each pays in a different currency; Asha organises. */
export const DEMO_FRIENDS = [
  { name: "Asha", currency: "EUR" as const },
  { name: "Ben", currency: "GBP" as const },
  { name: "Chloe", currency: "USD" as const },
];

/** The ready-made group: EUR 3,000 for three friends, EUR 1,000 each, a EUR 1,000 per-payment cap and a quorum of 2. */
export function demoDraft(vendorEmail: string) {
  return {
    name: "Lisbon Weekender (demo)",
    destination: "Lisbon, Portugal",
    tagline: "Three friends, one villa in Alfama, zero awkward money chats.",
    baseCurrency: "EUR",
    totalBudget: 3000,
    perPaymentCap: 1000,
    quorum: 2,
    deadlineDays: 7,
    members: DEMO_FRIENDS.map((f) => ({ name: f.name })),
    vendors: [
      { name: "Alfama Villa", email: vendorEmail, category: "stay", approved: true },
      { name: "Tagus Sailing", email: vendorEmail, category: "activities", approved: false },
    ],
  };
}

const starts = new Map<string, number[]>();
/** A demo makes real sandbox calls, so keep one visitor (or script) from hammering it: 6 per hour per address. */
export function allowDemoStart(who: string, now = Date.now(), limit = 6): boolean {
  const recent = (starts.get(who) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= limit) { starts.set(who, recent); return false; }
  recent.push(now);
  starts.set(who, recent);
  if (starts.size > 5000) for (const [k, v] of starts) if (!v.some((t) => now - t < 3600_000)) starts.delete(k);
  return true;
}
