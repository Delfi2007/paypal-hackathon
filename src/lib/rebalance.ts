// What changes when a friend drops out of a kitty? Pure maths, shared by the policy engine, the
// executor and the approval screen, so the group votes on exactly the numbers that will be applied.
//
//  - the budget stays the same, so everyone who remains pays a bigger share;
//  - the leaver is refunded whatever they already paid;
//  - friends who already paid owe only the DIFFERENCE (a top-up), not a fresh full share.

import type { Kitty } from "./types";

export interface RebalanceRow {
  memberId: string;
  name: string;
  paid: number;
  owedBefore: number;
  owedAfter: number;
  topUp: number; // extra they must pay because of the change
}

export interface RebalancePreview {
  ok: boolean;
  reason?: string;
  leaverId: string;
  leaverName: string;
  refund: number;
  remaining: number; // friends left
  oldShare: number;
  newShare: number;
  increase: number;
  rows: RebalanceRow[];
  totalTopUp: number;
  poolAfterRefund: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function rebalancePreview(k: Kitty, memberId: string): RebalancePreview {
  const leaver = k.members.find((m) => m.id === memberId);
  const empty: RebalancePreview = { ok: false, leaverId: memberId, leaverName: leaver?.name ?? "?", refund: 0, remaining: k.members.length, oldShare: k.sharePerMember, newShare: k.sharePerMember, increase: 0, rows: [], totalTopUp: 0, poolAfterRefund: 0 };
  if (!leaver) return { ...empty, reason: "Not a member of this kitty" };
  if (leaver.role === "organizer") return { ...empty, reason: "The organiser can't drop out: hand the kitty over first" };
  const left = k.members.filter((m) => m.id !== memberId);
  if (left.length < 2) return { ...empty, reason: "A kitty needs at least two friends" };

  const oldShare = r2(k.sharePerMember);
  const newShare = r2(k.mandate.totalBudget / left.length);
  const refund = r2(leaver.paid);
  const collected = k.members.reduce((s, m) => s + m.paid, 0);
  const rows: RebalanceRow[] = left.map((m) => {
    const owedBefore = r2(Math.max(0, m.share - m.paid));
    const owedAfter = r2(Math.max(0, newShare - m.paid));
    return { memberId: m.id, name: m.name, paid: m.paid, owedBefore, owedAfter, topUp: r2(Math.max(0, owedAfter - owedBefore)) };
  });
  return {
    ok: true,
    leaverId: leaver.id,
    leaverName: leaver.name,
    refund,
    remaining: left.length,
    oldShare,
    newShare,
    increase: r2(newShare - oldShare),
    rows,
    totalTopUp: r2(rows.reduce((s, r) => s + r.topUp, 0)),
    poolAfterRefund: r2(collected - k.spent - refund),
  };
}
