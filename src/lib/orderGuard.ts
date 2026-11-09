// Ownership checks for PayPal order captures. Kept pure so it is unit-testable.

import type { Kitty, Member } from "./types";

/**
 * Throws unless `me` may capture `orderId` into kitty `k`.
 * - An order id already credited to any member of the kitty is rejected (no double credit).
 * - A real PayPal order must carry the custom_id Kitty stamped on it ("kittyId:memberId"),
 *   so a member cannot credit themselves with an order created for someone else or another kitty.
 * `customId` is undefined only for simulated (SIM-) orders, which never touch PayPal.
 */
export function assertOrderOwnership(k: Kitty, me: Pick<Member, "id">, orderId: string, customId: string | undefined) {
  if (k.members.some((x) => x.orderId === orderId)) throw new Error("This order has already been recorded");
  const simulated = orderId.startsWith("SIM-");
  if (simulated) return;
  if (customId !== `${k.id}:${me.id}`) throw new Error("This PayPal order does not belong to you in this kitty");
}
