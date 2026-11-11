import { describe, expect, it, vi } from "vitest";
import { execute } from "../src/lib/agent";

vi.mock("../src/lib/store", async (orig) => ({ ...(await orig<typeof import("../src/lib/store")>()), notify: () => {} }));
import { refundShares } from "../src/lib/closeout";
import { evaluate, poolBalance } from "../src/lib/policy";
import { kitty, member } from "./helpers";

const sum = (xs: { base: number }[]) => Math.round(xs.reduce((s, x) => s + x.base, 0) * 100) / 100;

describe("refundShares", () => {
  it("returns the leftover pool in proportion to what each friend paid", () => {
    const k = kitty({ spent: 1500 }); // 3 x 1000 paid, 1500 spent -> 1500 left
    const r = refundShares(k);
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.base === 500)).toBe(true);
    expect(sum(r)).toBe(1500);
  });

  it("weights by amount paid, not by share owed", () => {
    const k = kitty({
      spent: 0,
      members: [member({ id: "u1", paid: 1000 }), member({ id: "u2", paid: 500 }), member({ id: "u3", paid: 500 })],
    });
    const r = Object.fromEntries(refundShares(k).map((x) => [x.memberId, x.base]));
    expect(r).toEqual({ u1: 1000, u2: 500, u3: 500 });
  });

  it("always adds up to exactly the pool, to the cent (no cent lost or invented)", () => {
    for (const [spent, a, b, c] of [[0.01, 333.33, 333.33, 333.34], [100.1, 1000, 999.99, 0.01], [1234.56, 700, 700, 701]] as const) {
      const k = kitty({
        spent,
        members: [member({ id: "u1", paid: a }), member({ id: "u2", paid: b }), member({ id: "u3", paid: c })],
      });
      expect(sum(refundShares(k))).toBe(poolBalance(k));
    }
  });

  it("gives rounding cents to the biggest contributor first", () => {
    const k = kitty({
      spent: 0,
      members: [member({ id: "u1", paid: 1 }), member({ id: "u2", paid: 1 }), member({ id: "u3", paid: 1 })],
    });
    // pool = 3.00 -> 1.00 each, no remainder
    expect(refundShares(k).map((x) => x.base)).toEqual([1, 1, 1]);
    const odd = kitty({
      spent: 2.99, // pool 0.01 across 3 equal payers: exactly one cent goes out, to one person
      members: [member({ id: "u1", paid: 1 }), member({ id: "u2", paid: 1 }), member({ id: "u3", paid: 1 })],
    });
    const r = refundShares(odd);
    expect(r).toHaveLength(1);
    expect(sum(r)).toBe(0.01);
  });

  it("skips members who paid nothing and returns nothing for an empty pool", () => {
    const k = kitty({ members: [member({ id: "u1", paid: 800 }), member({ id: "u2", paid: 0 })], spent: 0 });
    expect(refundShares(k).map((x) => x.memberId)).toEqual(["u1"]);
    expect(refundShares(kitty({ spent: 3000 }))).toEqual([]);
  });

  it("never refunds money that was already refunded", () => {
    const k = kitty({ spent: 1500, members: [member({ id: "u1", paid: 500 }), member({ id: "u2", paid: 500 }), member({ id: "u3", paid: 500 })] });
    expect(poolBalance(k)).toBe(0);
    expect(refundShares(k)).toEqual([]);
  });
});

describe("close_out policy", () => {
  const act = { type: "close_out" as const, params: {}, reasoning: "trip over" };

  it("always needs the group when there is money to return", () => {
    const r = evaluate(kitty({ spent: 1500 }), act);
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Closing the kitty needs the group")?.severity).toBe("quorum");
  });

  it("is blocked when the pool is empty", () => {
    const r = evaluate(kitty({ spent: 3000 }), act);
    expect(r.decision).toBe("block");
    expect(r.checks.find((c) => c.rule === "Money left to return")?.pass).toBe(false);
  });

  it("is blocked while approved payments are still queued for funds", () => {
    const k = kitty({ spent: 1500 });
    k.proposals.push({
      id: "p1", createdAt: "", status: "pending", approvals: ["u1", "u2"], rejections: [], title: "Pay Villa", awaitingFunds: true,
      action: { type: "pay_vendor", params: { vendorId: "v_villa", amount: 5000 }, reasoning: "" },
      policy: { decision: "allow", checks: [], summary: "" },
    });
    expect(evaluate(k, act).decision).toBe("block");
  });

  it("is blocked before the mandate is in force", () => {
    expect(evaluate(kitty({ status: "forming", spent: 1500 }), act).decision).toBe("block");
  });

  it("makes a closed kitty read-only for money", () => {
    const closed = kitty({ status: "closed", spent: 1500 });
    const pay = { type: "pay_vendor" as const, params: { vendorId: "v_villa", amount: 10 }, reasoning: "" };
    expect(evaluate(closed, pay).decision).toBe("block");
    expect(evaluate(closed, act).decision).toBe("block");
    expect(evaluate(closed, { type: "request_contributions", params: {}, reasoning: "" }).decision).toBe("block");
    expect(evaluate(closed, { type: "note", params: {}, reasoning: "" }).decision).toBe("allow");
  });
});

describe("close_out execution", () => {
  const act = { type: "close_out" as const, params: {}, reasoning: "trip over" };

  it("refunds every member through the refund path, empties the pool and closes the kitty", async () => {
    const k = kitty({ spent: 1500 });
    await execute(k, act, { idem: "pr1" });
    expect(k.status).toBe("closed");
    expect(poolBalance(k)).toBe(0);
    expect(k.closeOut?.status).toBe("complete");
    expect(k.closeOut?.collected).toBe(3000);
    expect(k.closeOut?.refunded).toBe(1500);
    expect(k.closeOut?.refunds.map((r) => r.base)).toEqual([500, 500, 500]);
    expect(k.members.map((m) => m.paid)).toEqual([500, 500, 500]);
    expect(k.ledger.filter((e) => e.title.startsWith("Refunded ")).length).toBe(3);
  });

  it("cannot be run twice", async () => {
    const k = kitty({ spent: 1500 });
    await execute(k, act, { idem: "pr1" });
    await expect(execute(k, act, { idem: "pr1" })).rejects.toThrow(/not open/);
    expect(k.members.map((m) => m.paid)).toEqual([500, 500, 500]);
  });
});
