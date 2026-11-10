// Deterministic policy engine. The LLM proposes; this decides.
// Nothing the model says can bypass these checks — every action that moves
// money or changes the rules passes through `evaluate` before execution.

import type {
  AgentAction,
  Kitty,
  PolicyCheck,
  PolicyResult,
  VendorCategory,
} from "./types";
import { fmt } from "./money";
import { rebalancePreview } from "./rebalance";
import { scan, scanFields, reason } from "./guard";

export function poolBalance(k: Kitty): number {
  const collected = k.members.reduce((s, m) => s + m.paid, 0);
  return round2(collected - k.spent);
}

export function collected(k: Kitty): number {
  return round2(k.members.reduce((s, m) => s + m.paid, 0));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function decide(checks: PolicyCheck[], okSummary: string): PolicyResult {
  const blocked = checks.filter((c) => !c.pass && c.severity === "block");
  const quorum = checks.filter((c) => !c.pass && c.severity === "quorum");
  if (blocked.length)
    return {
      decision: "block",
      checks,
      summary: `Blocked: ${blocked.map((c) => c.rule).join(", ")}`,
    };
  if (quorum.length)
    return {
      decision: "needs_quorum",
      checks,
      summary: `Outside mandate (${quorum
        .map((c) => c.rule)
        .join(", ")}) — needs group approval`,
    };
  return { decision: "allow", checks, summary: okSummary };
}

export function evaluate(k: Kitty, action: AgentAction): PolicyResult {
  const m = k.mandate;
  const cur = k.baseCurrency;

  switch (action.type) {
    case "pay_vendor": {
      const amount = Number(action.params.amount ?? 0);
      const vendorId = String(action.params.vendorId ?? "");
      const vendor = k.vendors.find((v) => v.id === vendorId);
      const balance = poolBalance(k);
      const checks: PolicyCheck[] = [
        {
          rule: "Valid amount",
          pass: amount > 0 && Number.isFinite(amount),
          detail: `Requested ${fmt(amount, cur)}`,
          severity: "block",
        },
        {
          rule: "Known payee",
          pass: !!vendor,
          detail: vendor ? `${vendor.name} <${vendor.email}>` : "Payee not in the kitty's vendor list",
          severity: "block",
        },
        {
          rule: "Payee and memo passed the injection guard",
          pass: !vendor?.quarantined && !scan(String(action.params.memo ?? "")).blocked,
          detail: vendor?.quarantined
            ? `Payee quarantined: ${vendor.quarantined.reason}`
            : scan(String(action.params.memo ?? "")).blocked
              ? `Memo rejected: ${reason(scan(String(action.params.memo ?? "")))}`
              : "No hidden instructions found",
          severity: "block",
        },
        {
          rule: "Payee has a PayPal email",
          pass: !!vendor && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vendor.email || ""),
          detail: vendor?.email ? "Payouts go to " + vendor.email : "Add their PayPal email first",
          severity: "block",
        },
        {
          rule: "Pool has funds",
          pass: amount <= balance,
          detail: `Pool balance ${fmt(balance, cur)}`,
          severity: "block",
        },
        {
          rule: "Within total budget",
          pass: k.spent + amount <= m.totalBudget,
          detail: `${fmt(k.spent + amount, cur)} of ${fmt(m.totalBudget, cur)} budget after this`,
          severity: "quorum",
        },
        {
          rule: "Under per-payment cap",
          pass: amount <= m.perPaymentCap,
          detail: `Cap is ${fmt(m.perPaymentCap, cur)}`,
          severity: "quorum",
        },
        {
          rule: "Pre-approved payee",
          pass: !!vendor && m.approvedPayees.includes(vendor.id),
          detail: vendor && m.approvedPayees.includes(vendor.id)
            ? "Signed into the mandate"
            : "Not on the signed payee list",
          severity: "quorum",
        },
        {
          rule: "Allowed category",
          pass: !!vendor && m.allowedCategories.includes(vendor.category),
          detail: vendor ? `Category: ${vendor.category}` : "Unknown category",
          severity: "quorum",
        },
        {
          rule: "Mandate signed",
          pass: m.signedBy.length >= m.quorum,
          detail: `${m.signedBy.length} of ${m.quorum} signatures needed`,
          severity: "quorum",
        },
      ];
      return decide(checks, `Within mandate — ${fmt(amount, cur)} to ${vendor?.name}`);
    }

    case "request_contributions": {
      const total = k.members.reduce((s, x) => s + x.share, 0);
      const checks: PolicyCheck[] = [
        {
          rule: "Shares fit the budget",
          pass: total <= m.totalBudget * 1.25,
          detail: `Asking ${fmt(total, cur)} against ${fmt(m.totalBudget, cur)} budget`,
          severity: "quorum",
        },
        {
          rule: "Mandate signed by quorum",
          pass: m.signedBy.length >= m.quorum,
          detail: `${m.signedBy.length}/${m.quorum} signatures`,
          severity: "quorum",
        },
      ];
      return decide(checks, "Collection matches the signed mandate");
    }

    case "send_reminders": {
      const overReminded = k.members.filter((x) => x.remindersSent >= 3 && x.paid < x.share);
      const checks: PolicyCheck[] = [
        {
          rule: "No reminder spam",
          pass: overReminded.length === 0,
          detail: overReminded.length
            ? `${overReminded.map((x) => x.name).join(", ")} already reminded 3×`
            : "Everyone under 3 reminders",
          severity: "quorum",
        },
      ];
      return decide(checks, "Reminders are within etiquette limits");
    }

    case "add_vendor": {
      const category = String(action.params.category ?? "other") as VendorCategory;
      const hit = scanFields({ name: action.params.name, email: action.params.email, category: action.params.category });
      const checks: PolicyCheck[] = [
        {
          rule: "Payee details passed the injection guard",
          pass: !hit,
          detail: hit ? `${hit.field}: ${reason(hit.verdict)}` : "No hidden instructions found",
          severity: "block",
        },
        {
          rule: "Allowed category",
          pass: m.allowedCategories.includes(category),
          detail: `Category: ${category}`,
          severity: "quorum",
        },
      ];
      return decide(checks, "Vendor can be added (payments still checked separately)");
    }

    case "refund_member": {
      const member = k.members.find((x) => x.id === String(action.params.memberId ?? ""));
      const amount = Number(action.params.amount ?? 0);
      const balance = poolBalance(k);
      const checks: PolicyCheck[] = [
        { rule: "Valid amount", pass: amount > 0 && Number.isFinite(amount), detail: `Requested ${fmt(amount, cur)}`, severity: "block" },
        { rule: "Known member", pass: !!member, detail: member ? member.name : "Not a member of this kitty", severity: "block" },
        {
          rule: "Refund within what they paid",
          pass: !!member && amount <= member.paid + 0.001,
          detail: member ? `${member.name} has paid ${fmt(member.paid, cur)}` : "—",
          severity: "block",
        },
        { rule: "Pool has funds", pass: amount <= balance, detail: `Pool balance ${fmt(balance, cur)}`, severity: "block" },
        {
          rule: "Refunds need the group",
          pass: false,
          detail: `Taking money out of the pool needs ${m.quorum} votes`,
          severity: "quorum",
        },
      ];
      return decide(checks, `Refund of ${fmt(amount, cur)}`);
    }

    case "drop_member": {
      const pv = rebalancePreview(k, String(action.params.memberId ?? ""));
      const checks: PolicyCheck[] = [
        { rule: "Can leave", pass: pv.ok, detail: pv.ok ? `${pv.leaverName} leaves; ${pv.remaining} friends remain` : pv.reason ?? "Not allowed", severity: "block" },
        {
          rule: "Pool can refund them",
          pass: !pv.ok || pv.refund <= poolBalance(k) + 0.001,
          detail: pv.ok ? `Refund ${fmt(pv.refund, cur)} · pool holds ${fmt(poolBalance(k), cur)}` : "—",
          severity: "block",
        },
        {
          rule: "Shares change for everyone",
          pass: false,
          detail: pv.ok ? `${fmt(pv.oldShare, cur)} → ${fmt(pv.newShare, cur)} each (+${fmt(pv.increase, cur)}); ${fmt(pv.totalTopUp, cur)} of top-ups` : "—",
          severity: "quorum",
        },
      ];
      return decide(checks, `${pv.leaverName} leaves the kitty`);
    }

    case "void_payout": {
      const po = k.payouts.find((x) => x.id === String(action.params.payoutId ?? ""));
      const done = !!po && /^(RETURNED|CANCELED|REFUNDED|REVERSED|SUCCESS)$/i.test(po.status);
      const checks: PolicyCheck[] = [
        { rule: "Known payout", pass: !!po, detail: po ? `${fmt(po.amount, cur)} · ${po.status}` : "No such payout", severity: "block" },
        {
          rule: "Payout can still be stopped",
          pass: !!po && !done,
          detail: done ? `Already ${po!.status}; the vendor has it or it was returned` : "Not yet claimed by the vendor",
          severity: "block",
        },
        {
          rule: "Voiding a sent payment needs the group",
          pass: false,
          detail: `Reversing a payment needs ${m.quorum} votes`,
          severity: "quorum",
        },
      ];
      return decide(checks, "Payout can be voided");
    }

    case "amend_mandate":
      return {
        decision: "needs_quorum",
        checks: [
          {
            rule: "Rule changes need the group",
            pass: false,
            detail: `Any change to the mandate needs ${m.quorum} votes`,
            severity: "quorum",
          },
        ],
        summary: "Changing the mandate always needs group approval",
      };

    case "split_bill":
    case "note":
    default:
      return { decision: "allow", checks: [], summary: "No money moves" };
  }
}
