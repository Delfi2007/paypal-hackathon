import type { Kitty, Member } from "../src/lib/types";

export function member(over: Partial<Member> = {}): Member {
  return {
    id: "u1", name: "Ana", email: "ana@test.dev", currency: "EUR", share: 1000, paid: 1000,
    persona: "new", remindersSent: 0, avatarHue: 200, role: "member", ...over,
  };
}

/** A funded, signed, active kitty: 3 friends paid €1000 each, budget €4000, cap €1500, quorum 2. */
export function kitty(over: Partial<Kitty> = {}): Kitty {
  return {
    id: "k1", createdBy: "u1", inviteCode: "abc", status: "active", sharePerMember: 1000, expectedMembers: 3,
    name: "Test", destination: "Lisbon", tagline: "", baseCurrency: "EUR", createdAt: new Date().toISOString(),
    members: [member({ id: "u1", name: "Ana" }), member({ id: "u2", name: "Ben" }), member({ id: "u3", name: "Cy" })],
    vendors: [
      { id: "v_villa", name: "Villa", email: "villa@biz.test", category: "stay" },
      { id: "v_taxi", name: "Taxi", email: "taxi@biz.test", category: "transport" },
      { id: "v_noemail", name: "Mystery", email: "", category: "other" },
    ],
    mandate: {
      totalBudget: 4000, perPaymentCap: 1500, allowedCategories: ["stay", "transport", "food", "activities"],
      approvedPayees: ["v_villa"], quorum: 2, deadline: "2099-01-01", signedBy: ["u1", "u2"], version: 1,
    },
    proposals: [], ledger: [], payouts: [], bills: [], spent: 0,
    ...over,
  };
}
