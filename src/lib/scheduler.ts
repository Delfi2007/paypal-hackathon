// Scheduled automation. `runTick()` is idempotent and safe to call as often as you like:
// it only acts on what is actually due. It is triggered by an in-process timer
// (src/instrumentation.ts), by GET/POST /api/cron/tick (any free cron service works), or by hand.
//
// What it does for every kitty:
//  - chases late payers with personalised reminders, paced by each friend's behaviour (max 3);
//  - runs the hold lifecycle: renews holds after PayPal's honor period, captures them at the
//    deadline once the mandate is in force, releases them if it never was, expires stale ones;
//  - nudges members who have not voted on an open proposal, and expires proposals nobody decided;
//  - syncs PayPal payout and invoice status (webhooks cannot reach localhost) and releases
//    queued payouts the moment the pool can cover them.

import { db } from "./db";
import { execute, recordContribution, releaseQueued } from "./agent";
import { evaluate } from "./policy";
import { captureHold, holdAgeDays, holdsOf, HONOR_DAYS, MAX_AUTH_DAYS, reauthorizeHold, voidHold } from "./holds";
import * as paypal from "./paypal";
import { log, mutate, notify } from "./store";
import type { Kitty, Persona } from "./types";

const HOUR = 3_600_000;
const GAP_HOURS: Record<Persona, number> = { late: 24, forgetful: 48, new: 48, prompt: 72 };

export interface TickReport {
  kitties: number;
  reminders: number;
  holdsCaptured: number;
  holdsReleased: number;
  holdsRenewed: number;
  nudges: number;
  proposalsExpired: number;
  payoutsUpdated: number;
  invoicesSynced: number;
  errors: string[];
}

let running = false;

export async function runTick(now = new Date()): Promise<TickReport> {
  const rep: TickReport = { kitties: 0, reminders: 0, holdsCaptured: 0, holdsReleased: 0, holdsRenewed: 0, nudges: 0, proposalsExpired: 0, payoutsUpdated: 0, invoicesSynced: 0, errors: [] };
  if (running) return { ...rep, errors: ["a tick is already running"] };
  running = true;
  try {
    const rows = await (await db()).execute("SELECT id FROM kitties");
    for (const r of rows.rows) {
      const id = String(r.id);
      try {
        await mutate(id, (k) => tickKitty(k, now, rep));
        rep.kitties++;
      } catch (e) {
        rep.errors.push(`${id}: ${(e as Error).message}`);
      }
    }
  } finally {
    running = false;
  }
  return rep;
}

async function tickKitty(k: Kitty, now: Date, rep: TickReport) {
  const t = now.getTime();
  const today = now.toISOString().slice(0, 10);
  const deadlineReached = today >= k.mandate.deadline;

  // ---- holds
  for (const h of holdsOf(k).filter((x) => x.status === "created" || x.status === "authorized")) {
    try {
      if (h.status === "created" && t - Date.parse(h.createdAt) > 24 * HOUR) {
        await voidHold(k, h.id, "scheduler", "Hold expired: never approved on PayPal");
        rep.holdsReleased++;
      } else if (h.status === "authorized") {
        const age = holdAgeDays(h, t);
        if (k.status !== "active" && deadlineReached) {
          await voidHold(k, h.id, "scheduler", "Deadline passed and the mandate never came into force");
          rep.holdsReleased++;
        } else if (age >= MAX_AUTH_DAYS) {
          await voidHold(k, h.id, "scheduler", "Authorization expired");
          rep.holdsReleased++;
        } else if (k.status === "active" && deadlineReached) {
          await captureHold(k, h.id, "scheduler");
          rep.holdsCaptured++;
        } else if (age >= HONOR_DAYS) {
          await reauthorizeHold(k, h);
          rep.holdsRenewed++;
        }
      }
    } catch (e) {
      rep.errors.push(`hold ${h.id}: ${(e as Error).message}`);
    }
  }

  // ---- sync invoices paid on PayPal (webhook backup)
  for (const m of k.members) {
    if (!m.invoiceId || m.paid >= m.share) continue;
    const s = await paypal.invoiceStatus(m.invoiceId).catch(() => null);
    if (s && (s.status === "PAID" || s.status === "MARKED_AS_PAID") && s.paid > 0) {
      await recordContribution(k, m, { amount: s.paid, currency: m.currency }, m.invoiceId);
      rep.invoicesSynced++;
    }
  }

  // ---- sync payout status
  for (const po of k.payouts.filter((x) => x.paypalBatchId && /^(PENDING|PROCESSING|ONHOLD|UNCLAIMED|NEW)$/i.test(x.status)).slice(0, 5)) {
    const info = await paypal.payoutStatus(po.paypalBatchId!).catch(() => null);
    if (info && info.status && info.status !== po.status) {
      log(k, { actor: "paypal", kind: "payout", title: `Payout ${po.status} → ${info.status}`, detail: `PayPal batch ${po.paypalBatchId}`, ref: po.paypalBatchId });
      po.status = info.status;
      po.itemId = po.itemId ?? info.itemId;
      rep.payoutsUpdated++;
    }
  }

  // ---- queued payouts the pool can now cover
  await releaseQueued(k);

  // ---- auto reminders (active kitties, close to or past the deadline)
  const daysLeft = (Date.parse(k.mandate.deadline) - t) / (24 * HOUR);
  if (k.status === "active" && daysLeft <= 5) {
    const open = new Set(holdsOf(k).filter((h) => h.status === "authorized").map((h) => h.memberId)); // a hold = they have committed
    const due = k.members.filter((m) => {
      if (m.paid >= m.share || m.remindersSent >= 3 || open.has(m.id)) return false;
      const last = m.lastRemindedAt ? Date.parse(m.lastRemindedAt) : 0;
      return t - last >= GAP_HOURS[m.persona] * HOUR;
    });
    if (due.length) {
      const action = { type: "send_reminders" as const, params: { memberIds: due.map((m) => m.id) }, reasoning: `Scheduled: ${due.length} member(s) are due a nudge and the deadline is ${daysLeft < 0 ? "past" : `${Math.ceil(daysLeft)} day(s) away`}.` };
      if (evaluate(k, action).decision === "allow") {
        await execute(k, action);
        rep.reminders += due.length;
      }
    }
  }

  // ---- votes: nudge non-voters, expire old proposals
  for (const pr of k.proposals.filter((p) => p.status === "pending" && !p.awaitingFunds)) {
    const age = t - Date.parse(pr.createdAt);
    if (age > 7 * 24 * HOUR) {
      pr.status = "rejected";
      log(k, { actor: "system", kind: "policy", title: `Expired without a decision — ${pr.title}`, detail: "No quorum within 7 days." });
      rep.proposalsExpired++;
    } else if (age > 24 * HOUR && (!pr.nudgedAt || t - Date.parse(pr.nudgedAt) > 24 * HOUR)) {
      const waiting = k.members.filter((m) => !pr.approvals.includes(m.id) && !pr.rejections.includes(m.id));
      if (waiting.length) {
        notify(waiting.map((m) => m.id), { kittyId: k.id, kind: "vote", title: `Still waiting on your vote: ${pr.title}`, body: `${pr.approvals.length}/${k.mandate.quorum} approvals so far.`, href: `/k/${k.id}/approvals` });
        pr.nudgedAt = new Date(t).toISOString();
        rep.nudges += waiting.length;
      }
    }
  }
}
