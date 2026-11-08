import { describe, expect, it } from "vitest";
import { log, verifyChain } from "../src/lib/store";
import { personaOf } from "../src/lib/persona";
import { kitty, member } from "./helpers";

describe("tamper-evident audit chain", () => {
  const build = () => {
    const k = kitty();
    log(k, { actor: "member", kind: "command", title: "Pay the villa" });
    log(k, { actor: "policy", kind: "policy", title: "Approved by policy" });
    log(k, { actor: "paypal", kind: "payout", title: "Paid Villa €800", amount: 800 });
    return k;
  };

  it("verifies an untouched ledger", () => {
    const r = verifyChain(build());
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(3);
  });

  it("links every event to the one before it", () => {
    const k = build();
    const [c, b, a] = k.ledger; // newest first
    expect(a.prev).toBe("genesis");
    expect(b.prev).toBe(a.hash);
    expect(c.prev).toBe(b.hash);
  });

  it("detects an edited amount", () => {
    const k = build();
    k.ledger[0].amount = 8;
    const r = verifyChain(k);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(k.ledger[0].id);
  });

  it("detects a deleted event in the middle", () => {
    const k = build();
    k.ledger.splice(1, 1);
    expect(verifyChain(k).ok).toBe(false);
  });
});

describe("reminder tone comes from real behaviour", () => {
  const deadline = "2099-01-01";
  it("paid without a nudge → prompt payer", () => expect(personaOf(member({ paid: 1000, remindersSent: 0 }), deadline)).toBe("prompt"));
  it("paid after a nudge → forgetful", () => expect(personaOf(member({ paid: 1000, remindersSent: 1 }), deadline)).toBe("forgetful"));
  it("unpaid, never nudged → new", () => expect(personaOf(member({ paid: 0, remindersSent: 0 }), deadline)).toBe("new"));
  it("unpaid after one nudge → forgetful", () => expect(personaOf(member({ paid: 0, remindersSent: 1 }), deadline)).toBe("forgetful"));
  it("unpaid after two nudges → late", () => expect(personaOf(member({ paid: 0, remindersSent: 2 }), deadline)).toBe("late"));
  it("unpaid past the deadline → late", () => expect(personaOf(member({ paid: 0, remindersSent: 0 }), "2000-01-01")).toBe("late"));
});
