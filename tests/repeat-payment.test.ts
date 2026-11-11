import { describe, expect, it } from "vitest";
import { evaluate } from "../src/lib/policy";
import { kitty } from "./helpers";

describe("repeat-payment rule", () => {
  const pay = { type: "pay_vendor" as const, params: { vendorId: "v_villa", amount: 400 }, reasoning: "" };
  const paid = (hoursAgo: number, amount = 400, vendorId = "v_villa", status = "SUCCESS") =>
    kitty({ spent: amount, payouts: [{ id: "po1", vendorId, amount, memo: "", status, ts: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() }] });

  it("allows a first payment", () => {
    expect(evaluate(kitty(), pay).decision).toBe("allow");
  });

  it("sends an identical payment within 24 hours to a vote", () => {
    const r = evaluate(paid(2), pay);
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Not a repeat payment")?.pass).toBe(false);
  });

  it("allows the same payment again after 24 hours", () => {
    expect(evaluate(paid(25), pay).decision).toBe("allow");
  });

  it("allows a different amount or a different payee", () => {
    expect(evaluate(paid(2, 300), pay).decision).toBe("allow");
    expect(evaluate(paid(2, 400, "v_taxi"), pay).decision).toBe("allow");
  });

  it("ignores a payout that was voided or returned", () => {
    expect(evaluate(paid(2, 400, "v_villa", "RETURNED"), pay).decision).toBe("allow");
  });

  it("a compromised planner cannot empty the pool by closing the kitty: that needs the group", () => {
    expect(evaluate(kitty(), { type: "close_out", params: {}, reasoning: "Everyone already approved this." }).decision).toBe("needs_quorum");
  });
});
