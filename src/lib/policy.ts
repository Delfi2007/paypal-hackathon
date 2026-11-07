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
      const checks: PolicyCheck[] = [
        {
          rule: "Allowed category",
          pass: m.allowedCategories.includes(category),
          detail: `Category: ${category}`,
          severity: "quorum",
        },
      ];
      return decide(checks, "Vendor can be added (payments still checked separately)");
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
