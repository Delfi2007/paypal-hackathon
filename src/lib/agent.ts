// The agent loop: plan (LLM) → evaluate (policy) → execute (PayPal) or
// escalate (group vote) → record (ledger). Each step is visible to the group.

import type { AgentAction, Kitty, Member, Proposal } from "./types";
import { evaluate, poolBalance, round2 } from "./policy";
import { draftReminders, planCommand, summarizeTrip } from "./ai";
import { refundShares } from "./closeout";
import * as paypal from "./paypal";
import { convert, fmt } from "./money";
import { log, notify, uid } from "./store";
import { personaOf } from "./persona";

function title(k: Kitty, a: AgentAction): string {
  const p = a.params;
  switch (a.type) {
    case "pay_vendor": {
      const v = k.vendors.find((x) => x.id === p.vendorId);
      return `Pay ${v?.name ?? "vendor"} ${fmt(Number(p.amount), k.baseCurrency)}`;
    }
    case "add_vendor":
      return `Add payee ${p.name}`;
    case "request_contributions":
      return "Send PayPal requests to everyone who owes";
    case "send_reminders":
      return "Send payment reminders";
    case "close_out":
      return "Close out the trip and return the leftover pool to everyone";
    case "amend_mandate":
      return `Amend mandate: ${Object.entries(p)
        .map(([key, v]) => `${key} → ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("; ")}`;
    default:
      return "Note";
  }
}

export async function runCommand(k: Kitty, text: string, actor: Member) {
  log(k, { actor: "member", actorName: actor.name, kind: "command", title: `“${text}”` });
  const plan = await planCommand(k, text, actor);
  if (plan.reply)
    log(k, { actor: "agent", kind: "plan", title: plan.reply, detail: plan.actions.length ? `${plan.actions.length} action(s) proposed` : undefined });

  let newVendorId: string | undefined;
  const results: { title: string; decision: string }[] = [];

  for (const action of plan.actions) {
    if (action.type === "pay_vendor" && action.params.vendorId === "NEW" && newVendorId)
      action.params.vendorId = newVendorId;
    const r = await handle(k, action, actor);
    if (action.type === "add_vendor" && r.vendorId) newVendorId = r.vendorId;
    results.push({ title: title(k, action), decision: r.decision });
  }
  return { reply: plan.reply, results };
}

export async function proposeAction(k: Kitty, action: AgentAction, actor: Member) {
  return handle(k, action, actor);
}

async function handle(k: Kitty, action: AgentAction, actor: Member) {
  if (action.type === "note") {
    log(k, { actor: "agent", kind: "info", title: String(action.params.text ?? ""), reasoning: action.reasoning });
    return { decision: "allow" };
  }

  // add_vendor: the vendor record is harmless to create; approval of the payee
  // happens through the mandate.
  if (action.type === "add_vendor") {
    const policy = evaluate(k, action);
    const v = {
      id: uid("v_"),
      name: String(action.params.name ?? "New vendor"),
      email: String(action.params.email || `${String(action.params.name ?? "vendor").toLowerCase().replace(/[^a-z]/g, "")}@business.example.com`),
      category: (action.params.category as Kitty["vendors"][0]["category"]) ?? "other",
      addedBy: actor.id,
    };
    k.vendors.push(v);
    log(k, { actor: "agent", kind: "info", title: `Added ${v.name} as a payee (not pre-approved)`, reasoning: action.reasoning, policy });
    return { decision: policy.decision, vendorId: v.id };
  }

  const policy = evaluate(k, action);
  const fundsOnly =
    policy.decision === "block" &&
    policy.checks.filter((c) => !c.pass && c.severity === "block").every((c) => c.rule === "Pool has funds");

  if (policy.decision === "allow") {
    log(k, { actor: "policy", kind: "policy", title: `Approved by policy — ${title(k, action)}`, policy, reasoning: action.reasoning });
    try {
      await execute(k, action);
    } catch (e) {
      return { decision: "failed", error: (e as Error).message };
    }
    return { decision: "allow" };
  }

  if (policy.decision === "block" && !fundsOnly) {
    log(k, { actor: "policy", kind: "policy", title: `Blocked — ${title(k, action)}`, policy, reasoning: action.reasoning });
    return { decision: "block" };
  }

  // Needs the group, or waiting for the pool to fill up.
  // "Queued" only when funds are the sole problem; if a vote is also needed it is a vote first,
  // and it will queue for funds after the group approves.
  const quorumIssues = policy.checks.some((c) => !c.pass && c.severity === "quorum");
  const queuedOnly = fundsOnly && !quorumIssues;
  const proposal: Proposal = {
    id: uid("p_"),
    createdAt: new Date().toISOString(),
    action,
    policy,
    status: "pending",
    approvals: [actor.id],
    rejections: [],
    title: title(k, action),
    awaitingFunds: queuedOnly,
    requestedBy: actor.id,
  };
  if (queuedOnly) proposal.preApproved = true;
  k.proposals.unshift(proposal);
  if (!queuedOnly)
    notify(k.members.filter((m) => m.id !== actor.id).map((m) => m.id), { kittyId: k.id, kind: "vote", title: `Your vote: ${proposal.title}`, body: `${actor.name} asked the group — needs ${k.mandate.quorum} approvals.`, href: `/k/${k.id}/approvals` });
  log(k, {
    actor: "policy",
    kind: "policy",
    title: queuedOnly
      ? `Queued until the pool is funded — ${proposal.title}`
      : `Needs ${k.mandate.quorum} votes — ${proposal.title}`,
    policy,
    reasoning: action.reasoning,
  });
  return { decision: queuedOnly ? "queued" : "needs_quorum" };
}

/**
 * `idemKey` identifies this one intended payment (the proposal id for voted/queued payments).
 * It is sent to PayPal as the payout's idempotency key, so a retry of the same proposal can never pay twice.
 */
export async function execute(k: Kitty, action: AgentAction, idemKey: string = uid("po")) {
  const p = action.params;
  try {
    switch (action.type) {
      case "pay_vendor": {
        const v = k.vendors.find((x) => x.id === p.vendorId)!;
        const amount = round2(Number(p.amount));
        const r = await paypal.payout({
          email: v.email,
          amount,
          currency: k.baseCurrency,
          note: String(p.memo || `${k.name} — payment to ${v.name}`),
          ref: `${k.id}-${idemKey}`,
        });
        k.spent = round2(k.spent + amount);
        k.payouts.unshift({ id: uid("po_"), vendorId: v.id, amount, memo: String(p.memo ?? ""), paypalBatchId: r.batchId, status: r.status, ts: new Date().toISOString() });
        log(k, {
          actor: "paypal",
          kind: "payout",
          title: `Paid ${v.name} ${fmt(amount, k.baseCurrency)}`,
          detail: `PayPal Payouts · batch ${r.batchId} · ${r.status}${r.simulated ? " (simulated)" : ""}`,
          amount,
          ref: r.batchId,
        });
        notify(k.members.map((m) => m.id), { kittyId: k.id, kind: "payout", title: `Paid ${v.name} ${fmt(amount, k.baseCurrency)}`, body: "Sent from the pool with PayPal Payouts.", href: `/k/${k.id}/activity` });
        break;
      }
      case "request_contributions": {
        const owing = k.members.filter((m) => m.paid < m.share && !m.invoiceId);
        if (!owing.length) {
          log(k, { actor: "agent", kind: "info", title: "Everyone has already been billed" });
          break;
        }
        for (const m of owing) {
          const local = await convert(m.share - m.paid, k.baseCurrency, m.currency);
          const inv = await paypal.createAndSendInvoice({
            email: m.paypalEmail || m.email,
            name: m.name,
            amount: local,
            currency: m.currency,
            itemName: `${k.name} — your share`,
            note: `Your share of the ${k.destination} kitty, managed by Kitty. Due ${k.mandate.deadline}.`,
            dueDate: k.mandate.deadline,
          });
          m.invoiceId = inv.id;
          log(k, {
            actor: "paypal",
            kind: "invoice",
            title: `Invoiced ${m.name} ${fmt(local, m.currency)}`,
            detail: `≈ ${fmt(m.share - m.paid, k.baseCurrency)} · PayPal invoice ${inv.id} · ${inv.status}${inv.simulated ? " (simulated)" : ""}`,
            ref: inv.id,
          });
          notify([m.id], { kittyId: k.id, kind: "invoice", title: `Your share: ${fmt(local, m.currency)}`, body: `PayPal invoice for ${k.name}, due ${k.mandate.deadline}.`, href: `/pay/${k.id}` });
        }
        break;
      }
      case "send_reminders": {
        const ids = (p.memberIds as string[] | undefined) ?? [];
        const targets = k.members.filter((m) => (ids.length ? ids.includes(m.id) : true) && m.paid < m.share);
        if (!targets.length) {
          log(k, { actor: "agent", kind: "info", title: "Nobody to remind — everyone is paid up" });
          break;
        }
        const msgs = await draftReminders(k, targets);
        for (const m of targets) {
          const text = msgs.find((x) => x.memberId === m.id)?.text ?? `Reminder: your share for ${k.name}`;
          m.remindersSent += 1;
          m.lastRemindedAt = new Date().toISOString();
          m.persona = personaOf(m, k.mandate.deadline);
          notify([m.id], { kittyId: k.id, kind: "reminder", title: `Reminder from ${k.name}`, body: text, href: `/pay/${k.id}` });
          if (m.invoiceId) await paypal.remindInvoice(m.invoiceId, `Reminder: ${k.name}`, text).catch(() => {});
        }
        log(k, {
          actor: "agent",
          kind: "reminder",
          title: `Sent ${targets.length} personalised reminder${targets.length > 1 ? "s" : ""}`,
          reasoning: action.reasoning,
          messages: targets.map((m) => ({ to: m.name, text: msgs.find((x) => x.memberId === m.id)?.text ?? "" })),
        });
        break;
      }
      case "record_cash": {
        const m = k.members.find((x) => x.id === p.memberId);
        if (!m) throw new Error("Unknown member");
        const owedBase = round2(Math.max(0, m.share - m.paid));
        if (owedBase <= 0) throw new Error(`${m.name} has already paid in full`);
        const local = await convert(owedBase, k.baseCurrency, m.currency);
        if (m.invoiceId) {
          try {
            await paypal.recordInvoicePayment(m.invoiceId, local, m.currency, `Paid in cash to the organiser (${k.name})`);
          } catch (e) {
            // PayPal already has this invoice as paid: nothing to record there, only update the kitty.
            if (!/does not support payment processing/i.test((e as Error).message)) throw e;
          }
        }
        await recordContribution(k, m, { amount: local, currency: m.currency }, m.invoiceId ?? "cash");
        log(k, { actor: "member", actorName: String(p.byName ?? "Organiser"), kind: "payment", title: `${m.name}'s share recorded as paid in cash`, detail: m.invoiceId ? `Recorded on PayPal invoice ${m.invoiceId}` : "No invoice yet, recorded in the kitty only" });
        break;
      }
      case "close_out": {
        if (k.status !== "active") throw new Error("This kitty is not open");
        const shares = refundShares(k);
        if (!shares.length) throw new Error("Nothing left to return");
        const refunds = [];
        for (const s of shares) {
          const m = k.members.find((x) => x.id === s.memberId)!;
          refunds.push({ m, base: s.base, local: await convert(s.base, k.baseCurrency, m.currency) });
        }
        // One Payouts batch for everybody, keyed by the proposal id: a retry can never refund twice.
        const r = await paypal.payoutBatch({
          ref: `${k.id}-${idemKey}-refunds`,
          subject: `Your leftover share from ${k.name}`,
          items: refunds.map((x) => ({
            email: x.m.paypalEmail || x.m.email,
            amount: x.local,
            currency: x.m.currency,
            note: `Your share of the leftover ${k.name} pool, returned at close-out.`,
            itemId: `${idemKey}-${x.m.id}`,
          })),
        });
        const total = round2(refunds.reduce((s, x) => s + x.base, 0));
        const collectedTotal = round2(k.members.reduce((s, x) => s + x.paid, 0));
        k.refunded = round2((k.refunded ?? 0) + total);
        k.status = "closed";
        const base = {
          closedAt: new Date().toISOString(),
          collected: collectedTotal,
          spent: k.spent,
          refunded: total,
          refunds: refunds.map((x) => ({ memberId: x.m.id, name: x.m.name, base: x.base, local: x.local, currency: x.m.currency })),
          paypalBatchId: r.batchId,
          status: r.status,
          simulated: r.simulated,
        };
        k.closeOut = { ...base, summary: await summarizeTrip(k, base) };
        for (const x of refunds)
          log(k, { actor: "paypal", kind: "payout", title: `Refunded ${x.m.name} ${fmt(x.local, x.m.currency)}`, detail: `≈ ${fmt(x.base, k.baseCurrency)} back from the pool`, amount: x.base, ref: r.batchId });
        log(k, {
          actor: "agent",
          kind: "info",
          title: `Trip closed: ${fmt(total, k.baseCurrency)} returned to ${refunds.length} friend${refunds.length === 1 ? "" : "s"}`,
          detail: `PayPal Payouts · batch ${r.batchId} · ${r.status}${r.simulated ? " (simulated)" : ""}`,
          reasoning: k.closeOut.summary,
          ref: r.batchId,
        });
        for (const x of refunds)
          notify([x.m.id], { kittyId: k.id, kind: "payout", title: `Refund on its way: ${fmt(x.local, x.m.currency)}`, body: `Your share of what was left in ${k.name}, sent with PayPal Payouts.`, href: `/k/${k.id}` });
        break;
      }
      case "amend_mandate": {
        const m = k.mandate;
        if (p.totalBudget) m.totalBudget = Number(p.totalBudget);
        if (p.perPaymentCap) m.perPaymentCap = Number(p.perPaymentCap);
        if (p.quorum) m.quorum = Math.max(1, Math.min(k.members.length, Number(p.quorum)));
        if (p.deadline) m.deadline = String(p.deadline);
        if (Array.isArray(p.approvePayees))
          for (const id of p.approvePayees as string[]) if (!m.approvedPayees.includes(id)) m.approvedPayees.push(id);
        m.version += 1;
        log(k, { actor: "system", kind: "mandate", title: `Mandate amended → v${m.version}`, detail: title(k, action).replace("Amend mandate: ", "") });
        break;
      }
    }
  } catch (e) {
    log(k, { actor: "system", kind: "error", title: `Failed: ${title(k, action)}`, detail: (e as Error).message });
    throw e;
  }
}

export async function vote(k: Kitty, proposalId: string, member: Member, approve: boolean) {
  const pr = k.proposals.find((x) => x.id === proposalId);
  if (!pr || pr.status !== "pending") throw new Error("Proposal is not open");
  pr.approvals = pr.approvals.filter((x) => x !== member.id);
  pr.rejections = pr.rejections.filter((x) => x !== member.id);
  (approve ? pr.approvals : pr.rejections).push(member.id);
  log(k, {
    actor: "member",
    actorName: member.name,
    kind: "vote",
    title: `${member.name} ${approve ? "approved" : "rejected"} “${pr.title}”`,
    detail: `${pr.approvals.length}/${k.mandate.quorum} approvals`,
  });

  if (pr.rejections.length > k.members.length - k.mandate.quorum) {
    pr.status = "rejected";
    log(k, { actor: "system", kind: "policy", title: `Rejected by the group — ${pr.title}` });
    return pr;
  }
  if (pr.approvals.length >= k.mandate.quorum) await tryRun(k, pr);
  return pr;
}

/** Execute an approved proposal; hard blocks (e.g. empty pool) still apply. */
async function tryRun(k: Kitty, pr: Proposal) {
  const fresh = evaluate(k, pr.action);
  const hard = fresh.checks.filter((c) => !c.pass && c.severity === "block");
  if (hard.length) {
    const fundsOnly = hard.every((c) => c.rule === "Pool has funds");
    if (fundsOnly) {
      if (!pr.awaitingFunds) {
        pr.awaitingFunds = true;
        log(k, { actor: "agent", kind: "info", title: `Approved — will pay automatically once the pool covers it`, detail: pr.title });
      }
      return;
    }
    pr.status = "failed";
    log(k, { actor: "policy", kind: "policy", title: `Approved but still blocked — ${pr.title}`, policy: fresh });
    return;
  }
  try {
    await execute(k, pr.action, pr.id);
    pr.status = "executed";
    pr.awaitingFunds = false;
  } catch {
    pr.status = "failed";
  }
}

/** Record a member's contribution and release any payouts waiting on funds. */
export async function recordContribution(
  k: Kitty,
  member: Member,
  local: { amount: number; currency: Member["currency"] },
  ref: string,
) {
  const base = await convert(local.amount, local.currency, k.baseCurrency);
  member.paid = round2(member.paid + base);
  // Currency conversion rounds both ways, so paying £834.12 for a €1,000 share can land at €999.99.
  // A gap under 50 cents is rounding, not debt.
  if (member.share - member.paid > 0 && member.share - member.paid < 0.5) member.paid = member.share;
  member.paidLocal = local;
  if (member.paid >= member.share) member.paidAt = new Date().toISOString();
  member.persona = personaOf(member, k.mandate.deadline);
  notify(k.members.filter((m) => m.id !== member.id).map((m) => m.id), { kittyId: k.id, kind: "payment", title: `${member.name} paid ${fmt(base, k.baseCurrency)}`, href: `/k/${k.id}` });
  log(k, {
    actor: "paypal",
    kind: "payment",
    title:
      local.currency === k.baseCurrency
        ? `${member.name} paid ${fmt(base, k.baseCurrency)}`
        : `${member.name} paid ${fmt(local.amount, local.currency)} → ${fmt(base, k.baseCurrency)}`,
    detail: local.currency === k.baseCurrency ? `PayPal capture ${ref}` : `Paid in ${local.currency}, settled to the pool in ${k.baseCurrency} · ${ref}`,
    amount: base,
    ref,
  });
  // Release queued payouts in order.
  for (const pr of [...k.proposals].reverse()) {
    if (pr.status === "pending" && pr.awaitingFunds && (pr.preApproved || pr.approvals.length >= k.mandate.quorum)) {
      const before = poolBalance(k);
      await tryRun(k, pr);
      if ((pr.status as Proposal["status"]) === "executed")
        log(k, { actor: "agent", kind: "info", title: `Pool reached ${fmt(before, k.baseCurrency)} — released “${pr.title}”` });
    }
  }
}
