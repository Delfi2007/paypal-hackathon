import { describe, expect, it } from "vitest";
import { rebalancePreview } from "../src/lib/rebalance";
import { evaluate } from "../src/lib/policy";
import { kitty, member } from "./helpers";

// 4 friends, 4000 budget, 1000 each. Ana (organiser), Ben and Dev paid; Cy has not.
const four = () => {
  const k = kitty({
    sharePerMember: 1000,
    expectedMembers: 4,
    members: [
      member({ id: "u1", name: "Ana", role: "organizer", paid: 1000 }),
      member({ id: "u2", name: "Ben", paid: 1000 }),
      member({ id: "u3", name: "Cy", paid: 0 }),
      member({ id: "u4", name: "Dev", paid: 1000 }),
    ],
  });
  k.mandate.totalBudget = 4000;
  return k;
};

describe("friend drops out: rebalance", () => {
  it("re-splits the same budget between the friends who remain", () => {
    const pv = rebalancePreview(four(), "u4");
    expect(pv.ok).toBe(true);
    expect(pv.oldShare).toBe(1000);
    expect(pv.newShare).toBe(1333.33);
    expect(pv.increase).toBe(333.33);
    expect(pv.remaining).toBe(3);
  });

  it("refunds exactly what the leaver paid", () => {
    expect(rebalancePreview(four(), "u4").refund).toBe(1000);
    expect(rebalancePreview(four(), "u3").refund).toBe(0); // Cy never paid
  });

  it("friends who already paid owe only the difference", () => {
    const pv = rebalancePreview(four(), "u4");
    const ben = pv.rows.find((r) => r.name === "Ben")!;
    expect(ben.paid).toBe(1000);
    expect(ben.owedBefore).toBe(0);
    expect(ben.owedAfter).toBe(333.33);
    expect(ben.topUp).toBe(333.33);
  });

  it("someone who has not paid yet just owes the new, larger share", () => {
    const cy = rebalancePreview(four(), "u4").rows.find((r) => r.name === "Cy")!;
    expect(cy.owedBefore).toBe(1000);
    expect(cy.owedAfter).toBe(1333.33);
    expect(cy.topUp).toBe(333.33);
  });

  it("total top-up is the sum of everyone's difference", () => {
    const pv = rebalancePreview(four(), "u4");
    expect(pv.totalTopUp).toBe(pv.rows.reduce((s, r) => Math.round((s + r.topUp) * 100) / 100, 0));
  });

  it("the organiser cannot drop out", () => {
    const pv = rebalancePreview(four(), "u1");
    expect(pv.ok).toBe(false);
    expect(pv.reason).toMatch(/organiser/i);
  });

  it("a kitty keeps at least two friends", () => {
    const k = kitty({ members: [member({ id: "u1", role: "organizer" }), member({ id: "u2" })] });
    expect(rebalancePreview(k, "u2").ok).toBe(false);
  });

  it("an unknown member is rejected", () => {
    expect(rebalancePreview(four(), "ghost").ok).toBe(false);
  });
});

describe("policy: drop_member", () => {
  const drop = (id: string) => ({ type: "drop_member" as const, params: { memberId: id }, reasoning: "" });

  it("always needs the group's vote", () => {
    const r = evaluate(four(), drop("u4"));
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Shares change for everyone")?.pass).toBe(false);
  });

  it("is blocked for the organiser", () => {
    expect(evaluate(four(), drop("u1")).decision).toBe("block");
  });

  it("is blocked when the pool cannot refund the leaver", () => {
    const k = four();
    k.spent = 2900; // pool = 3000 - 2900 = 100, leaver paid 1000
    const r = evaluate(k, drop("u4"));
    expect(r.decision).toBe("block");
    expect(r.checks.find((c) => !c.pass && c.severity === "block")?.rule).toBe("Pool can refund them");
  });
});
