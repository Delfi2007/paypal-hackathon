// Trip close-out maths. Pure and deterministic: the model never decides who gets what.

import type { Kitty } from "./types";
import { poolBalance } from "./policy";

/**
 * Split the leftover pool between members in proportion to what each actually paid in.
 * Works in whole cents so the shares always add up to exactly the pool, with no cent lost or invented:
 * rounding remainders go to the biggest contributors first.
 */
export function refundShares(k: Kitty): { memberId: string; base: number }[] {
  const poolCents = Math.round(poolBalance(k) * 100);
  const payers = k.members
    .map((m) => ({ memberId: m.id, paidCents: Math.round(m.paid * 100) }))
    .filter((p) => p.paidCents > 0);
  const totalCents = payers.reduce((s, p) => s + p.paidCents, 0);
  if (poolCents <= 0 || totalCents <= 0) return [];

  const rows = payers
    .map((p) => ({ ...p, cents: Math.floor((poolCents * p.paidCents) / totalCents) }))
    .sort((a, b) => b.paidCents - a.paidCents);
  let remainder = poolCents - rows.reduce((s, r) => s + r.cents, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % rows.length, remainder--) rows[i].cents += 1;

  return rows.filter((r) => r.cents > 0).map((r) => ({ memberId: r.memberId, base: r.cents / 100 }));
}
