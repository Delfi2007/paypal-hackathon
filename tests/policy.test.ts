import { describe, expect, it } from "vitest";
import { evaluate, poolBalance } from "../src/lib/policy";
import { kitty } from "./helpers";
import type { AgentAction } from "../src/lib/types";

const pay = (vendorId: string, amount: number): AgentAction => ({ type: "pay_vendor", params: { vendorId, amount }, reasoning: "" });

describe("policy engine: pay_vendor", () => {
  it("allows a payment that is inside every rule", () => {
    const r = evaluate(kitty(), pay("v_villa", 800));
    expect(r.decision).toBe("allow");
    expect(r.checks.every((c) => c.pass)).toBe(true);
  });

  it("needs a group vote when over the per-payment cap", () => {
    const r = evaluate(kitty(), pay("v_villa", 1800));
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => !c.pass)?.rule).toBe("Under per-payment cap");
  });

  it("needs a vote for a payee that is not pre-approved", () => {
    const r = evaluate(kitty(), pay("v_taxi", 200));
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Pre-approved payee")?.pass).toBe(false);
  });

  it("needs a vote when it would exceed the total budget", () => {
    const k = kitty({ spent: 3500 });
    k.members.forEach((m) => (m.paid = 2000)); // pool = 6000 - 3500, so funds are fine; only the budget is the problem
    const r = evaluate(k, pay("v_villa", 600));
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Within total budget")?.pass).toBe(false);
  });

  it("hard-blocks an unknown payee", () => {
    expect(evaluate(kitty(), pay("v_ghost", 100)).decision).toBe("block");
  });

  it("hard-blocks a payee with no PayPal email", () => {
    const r = evaluate(kitty(), pay("v_noemail", 100));
    expect(r.decision).toBe("block");
    expect(r.checks.find((c) => c.rule === "Payee has a PayPal email")?.pass).toBe(false);
  });

  it("blocks non-positive and non-numeric amounts", () => {
    expect(evaluate(kitty(), pay("v_villa", 0)).decision).toBe("block");
    expect(evaluate(kitty(), pay("v_villa", -50)).decision).toBe("block");
    expect(evaluate(kitty(), pay("v_villa", NaN)).decision).toBe("block");
  });

  it("blocks when the pool cannot cover it (the agent then queues it)", () => {
    const k = kitty();
    k.members.forEach((m) => (m.paid = 100)); // pool = 300
    const r = evaluate(k, pay("v_villa", 800));
    expect(r.decision).toBe("block");
    expect(r.checks.filter((c) => !c.pass).map((c) => c.rule)).toEqual(["Pool has funds"]);
  });

  it("needs a vote until the mandate has enough signatures", () => {
    const r = evaluate(kitty({ mandate: { ...kitty().mandate, signedBy: ["u1"] } }), pay("v_villa", 100));
    expect(r.decision).toBe("needs_quorum");
    expect(r.checks.find((c) => c.rule === "Mandate signed")?.pass).toBe(false);
  });

  it("pool balance is money collected minus money spent", () => {
    expect(poolBalance(kitty())).toBe(3000);
    expect(poolBalance(kitty({ spent: 1250.5 }))).toBe(1749.5);
  });
});

describe("policy engine: other actions", () => {
  it("changing the mandate always needs the group", () => {
    const r = evaluate(kitty(), { type: "amend_mandate", params: { perPaymentCap: 5000 }, reasoning: "" });
    expect(r.decision).toBe("needs_quorum");
  });

  it("stops reminder spam after three nudges", () => {
    const k = kitty();
    k.members[1].paid = 0;
    k.members[1].remindersSent = 3;
    expect(evaluate(k, { type: "send_reminders", params: {}, reasoning: "" }).decision).toBe("needs_quorum");
  });

  it("notes and bill splits never move money", () => {
    expect(evaluate(kitty(), { type: "note", params: {}, reasoning: "" }).decision).toBe("allow");
    expect(evaluate(kitty(), { type: "split_bill", params: {}, reasoning: "" }).decision).toBe("allow");
  });
});
