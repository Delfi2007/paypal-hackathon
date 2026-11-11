import { describe, expect, it } from "vitest";
import { allowDemoStart, DEMO_FRIENDS, demoDraft } from "../src/lib/demo";

describe("demo group", () => {
  it("is three friends paying in three currencies", () => {
    expect(DEMO_FRIENDS.map((f) => f.currency)).toEqual(["EUR", "GBP", "USD"]);
  });

  it("is built so the README tour works: EUR 800 pays at once, EUR 1,200 needs a vote", () => {
    const d = demoDraft("villa@example.com");
    expect(d.totalBudget / d.members.length).toBe(1000);
    expect(800).toBeLessThanOrEqual(d.perPaymentCap);
    expect(1200).toBeGreaterThan(d.perPaymentCap);
    expect(d.quorum).toBe(2);
    expect(d.vendors[0]).toMatchObject({ name: "Alfama Villa", approved: true });
  });
});

describe("demo rate limit", () => {
  it("allows a handful per hour per address, then refuses, then recovers", () => {
    const t = 1_000_000;
    for (let i = 0; i < 6; i++) expect(allowDemoStart("1.2.3.4", t + i, 6)).toBe(true);
    expect(allowDemoStart("1.2.3.4", t + 10, 6)).toBe(false);
    expect(allowDemoStart("5.6.7.8", t + 10, 6)).toBe(true);
    expect(allowDemoStart("1.2.3.4", t + 3600_001, 6)).toBe(true);
  });
});
