// Authorization holds: a member reserves their share on their own PayPal (Orders v2 intent=AUTHORIZE).
// Nothing is charged until the conditions are met. Captured => the share lands in the pool.
// Voided/expired => the member's money was never touched.
//
// Rules:
//  - capture needs the mandate in force (a quorum has signed), done by the organiser or the scheduler;
//  - the hold is voided automatically if the kitty never activates by its deadline;
//  - a hold older than PayPal's 3-day honor period is re-authorised so it stays valid;
//  - the member (or the organiser) can void a hold at any time before capture.

import type { Hold, Kitty, Member } from "./types";
import * as paypal from "./paypal";
import { convert, fmt } from "./money";
import { round2 } from "./policy";
import { log, notify, uid, HttpError } from "./store";
import { recordContribution } from "./agent";

const DAY = 86_400_000;
export const HONOR_DAYS = 3; // PayPal guarantees funds for the first 3 days
export const MAX_AUTH_DAYS = 29; // authorizations lapse after 29 days

export const holdsOf = (k: Kitty): Hold[] => (k.holds ??= []);

export async function createHold(k: Kitty, member: Member, urls: { returnUrl: string; cancelUrl: string }) {
  if (holdsOf(k).some((h) => h.memberId === member.id && (h.status === "created" || h.status === "authorized")))
    throw new HttpError(409, "You already have an open hold for this kitty");
  const owed = round2(Math.max(0, member.share - member.paid));
  if (owed <= 0) throw new HttpError(400, "You have already paid your share");
  const local = round2(await convert(owed, k.baseCurrency, member.currency));
  const id = uid("h_");
  const o = await paypal.createHoldOrder({
    amount: local,
    currency: member.currency,
    kittyId: k.id,
    memberId: member.id,
    description: `${k.name} — hold for your share`,
    returnUrl: `${urls.returnUrl}${urls.returnUrl.includes("?") ? "&" : "?"}hold=${id}`,
    cancelUrl: urls.cancelUrl,
  });
  const hold: Hold = { id, memberId: member.id, orderId: o.id, amount: local, currency: member.currency, baseAmount: owed, status: "created", createdAt: new Date().toISOString(), simulated: o.simulated };
  holdsOf(k).unshift(hold);
  log(k, { actor: "paypal", kind: "info", title: `${member.name} started a hold for ${fmt(local, member.currency)}`, detail: `PayPal order ${o.id} · intent AUTHORIZE · nothing is charged yet${o.simulated ? " (simulated)" : ""}`, ref: o.id });
  return { hold, approveUrl: o.approveUrl };
}

export async function authorizeHold(k: Kitty, holdId: string, member: Member) {
  const h = find(k, holdId);
  if (h.memberId !== member.id) throw new HttpError(403, "This is not your hold");
  if (h.status !== "created") throw new HttpError(409, `Hold is already ${h.status}`);
  const a = await paypal.authorizeOrder(h.orderId);
  h.authorizationId = a.authorizationId;
  h.status = "authorized";
  h.authorizedAt = new Date().toISOString();
  log(k, { actor: "paypal", kind: "info", title: `${member.name}'s ${fmt(h.amount, h.currency)} is on hold`, detail: `Authorization ${a.authorizationId} · funds reserved, not yet charged${a.simulated ? " (simulated)" : ""}`, ref: a.authorizationId });
  const org = k.members.find((m) => m.role === "organizer");
  if (org) notify([org.id], { kittyId: k.id, kind: "payment", title: `${member.name} put ${fmt(h.amount, h.currency)} on hold`, body: "It is captured when the mandate is in force.", href: `/k/${k.id}` });
  return h;
}

/** Captures an authorised hold into the pool. `by` is the organiser or "scheduler". */
export async function captureHold(k: Kitty, holdId: string, by: Member | "scheduler") {
  const h = find(k, holdId);
  if (by !== "scheduler" && by.role !== "organizer") throw new HttpError(403, "Only the organiser can capture holds");
  if (h.status !== "authorized" || !h.authorizationId) throw new HttpError(409, `Only an authorised hold can be captured (this one is ${h.status})`);
  if (k.status !== "active") throw new HttpError(409, "The mandate is not in force yet: holds can only be captured once a quorum has signed");
  const m = k.members.find((x) => x.id === h.memberId)!;
  if (m.paid >= m.share) {
    await voidHold(k, holdId, by, "Share already paid another way");
    return h;
  }
  const c = await paypal.captureAuthorization(h.authorizationId, h.amount, h.currency);
  if (c.status !== "COMPLETED" && c.status !== "PENDING") throw new HttpError(502, `PayPal capture ${c.status}`);
  h.status = "captured";
  h.captureId = c.captureId;
  h.closedAt = new Date().toISOString();
  m.captureId = c.captureId;
  m.orderId = h.orderId;
  await recordContribution(k, m, { amount: h.amount, currency: h.currency }, c.captureId);
  log(k, { actor: by === "scheduler" ? "system" : "member", actorName: by === "scheduler" ? undefined : by.name, kind: "info", title: `Captured ${m.name}'s hold ${fmt(h.amount, h.currency)}`, detail: `Capture ${c.captureId}${c.simulated ? " (simulated)" : ""}` });
  return h;
}

export async function voidHold(k: Kitty, holdId: string, by: Member | "scheduler", why = "Released") {
  const h = find(k, holdId);
  if (by !== "scheduler" && by.id !== h.memberId && by.role !== "organizer") throw new HttpError(403, "Only the holder or the organiser can release a hold");
  if (h.status === "captured" || h.status === "voided" || h.status === "expired") throw new HttpError(409, `Hold is already ${h.status}`);
  if (h.authorizationId) await paypal.voidAuthorization(h.authorizationId);
  h.status = by === "scheduler" && /expired|deadline/i.test(why) ? "expired" : "voided";
  h.closedAt = new Date().toISOString();
  h.note = why;
  const m = k.members.find((x) => x.id === h.memberId);
  log(k, { actor: by === "scheduler" ? "system" : "member", actorName: by === "scheduler" ? undefined : by.name, kind: "info", title: `Released ${m?.name ?? "member"}'s hold of ${fmt(h.amount, h.currency)}`, detail: `${why}. Nothing was charged.` });
  if (m) notify([m.id], { kittyId: k.id, kind: "payment", title: "Your PayPal hold was released", body: `${why}. You were not charged.`, href: `/pay/${k.id}` });
  return h;
}

/** Re-authorise holds that outlived PayPal's 3-day honor period so funds stay reserved. */
export async function reauthorizeHold(k: Kitty, h: Hold) {
  if (!h.authorizationId) return;
  await paypal.reauthorize(h.authorizationId, h.amount, h.currency);
  h.reauthorizedAt = new Date().toISOString();
  log(k, { actor: "system", kind: "info", title: `Renewed the PayPal hold for ${k.members.find((m) => m.id === h.memberId)?.name ?? "a member"}`, detail: `Authorization ${h.authorizationId} re-authorised after the ${HONOR_DAYS}-day honor period` });
}

export const holdAgeDays = (h: Hold, now = Date.now()) => (now - Date.parse(h.reauthorizedAt ?? h.authorizedAt ?? h.createdAt)) / DAY;

function find(k: Kitty, id: string): Hold {
  const h = holdsOf(k).find((x) => x.id === id);
  if (!h) throw new HttpError(404, "Hold not found");
  return h;
}
