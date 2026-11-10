#!/usr/bin/env node
// Kitty MCP server: lets any AI agent (Claude Desktop, Claude Code, Cursor, ...) run a
// group's shared PayPal money. The agent is just another voice: every payment it proposes
// still goes through the group's signed mandate, and anything outside it needs friends' votes.
//
//   KITTY_URL=http://localhost:3000 KITTY_TOKEN=kty_... node mcp/kitty-mcp.mjs

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.KITTY_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.KITTY_TOKEN;
if (!TOKEN) {
  console.error("Set KITTY_TOKEN (create one in the app under Profile → Agent access).");
  process.exit(1);
}

async function api(path, body) {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

const text = (t) => ({ content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) }] });
const money = (n, c) => `${(Math.round(n * 100) / 100).toFixed(2)} ${c}`;

const DECISION = {
  allow: "EXECUTED: inside the mandate, paid through PayPal.",
  needs_quorum: "NEEDS A VOTE: outside the mandate. A proposal is open and the group must approve it.",
  queued: "QUEUED: allowed, but the pool cannot cover it yet. It will be paid automatically once funded.",
  block: "BLOCKED by policy: this breaks a hard rule of the mandate.",
  failed: "FAILED: PayPal rejected it.",
};

async function resolveVendor(kittyId, ref) {
  const { kitty } = await api(`/api/kitties/${kittyId}`);
  const q = ref.toLowerCase();
  const v = kitty.vendors.find((x) => x.id === ref) || kitty.vendors.find((x) => x.name.toLowerCase() === q) || kitty.vendors.find((x) => x.name.toLowerCase().includes(q));
  if (!v) throw new Error(`No payee matches "${ref}". Known payees: ${kitty.vendors.map((x) => x.name).join(", ") || "none"}`);
  return { v, kitty };
}

async function lastPolicy(kittyId) {
  const { kitty } = await api(`/api/kitties/${kittyId}`);
  const e = kitty.ledger.find((x) => x.policy);
  return e ? { summary: e.policy.summary, checks: e.policy.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.rule}: ${c.detail}`) } : undefined;
}

const server = new McpServer({ name: "kitty", version: "1.0.0" });

server.tool("kitty_list", "List the groups (kitties) the user belongs to.", {}, async () => text(await api("/api/kitties")));

server.tool(
  "kitty_status",
  "Full status of one kitty: pool balance, budget, who has paid, the signed mandate, payees (with ids) and open proposals.",
  { kittyId: z.string() },
  async ({ kittyId }) => {
    const { kitty: k, chain } = await api(`/api/kitties/${kittyId}`);
    const collected = k.members.reduce((s, m) => s + m.paid, 0);
    return text({
      name: k.name,
      status: k.status,
      currency: k.baseCurrency,
      pool: money(collected - k.spent, k.baseCurrency),
      spent: money(k.spent, k.baseCurrency),
      mandate: {
        totalBudget: k.mandate.totalBudget,
        perPaymentCap: k.mandate.perPaymentCap,
        quorum: k.mandate.quorum,
        deadline: k.mandate.deadline,
        signedBy: k.mandate.signedBy.length,
      },
      members: k.members.map((m) => ({ name: m.name, paid: m.paid, owes: m.share, currency: m.currency })),
      payees: k.vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, preApproved: k.mandate.approvedPayees.includes(v.id) })),
      openProposals: k.proposals.filter((p) => p.status === "pending").map((p) => ({ id: p.id, title: p.title, votes: `${p.approvals.length}/${k.mandate.quorum}`, queuedForFunds: !!p.awaitingFunds })),
      auditChainIntact: chain.ok,
    });
  },
);

server.tool(
  "kitty_pay_vendor",
  "Pay a payee from the group's pool via PayPal Payouts. The group's mandate is enforced by a deterministic policy engine: in-mandate payments execute, out-of-mandate ones open a group vote, and unfunded ones queue.",
  { kittyId: z.string(), payee: z.string().describe("Payee name or id"), amount: z.number().positive().describe("Amount in the kitty's base currency"), memo: z.string().optional() },
  async ({ kittyId, payee, amount, memo }) => {
    const { v } = await resolveVendor(kittyId, payee);
    const r = await api(`/api/kitties/${kittyId}/action`, { label: `AI agent: pay ${v.name} ${amount}`, action: { type: "pay_vendor", params: { vendorId: v.id, amount, memo: memo ?? "Paid by an AI agent" }, reasoning: memo ?? `An AI agent asked to pay ${v.name}.` } });
    return text({ result: DECISION[r.decision] ?? r.decision, policy: await lastPolicy(kittyId) });
  },
);

server.tool("kitty_request_shares", "Send each member who owes a PayPal invoice for their share, in their own currency.", { kittyId: z.string() }, async ({ kittyId }) => {
  const r = await api(`/api/kitties/${kittyId}/action`, { label: "AI agent: request shares", action: { type: "request_contributions", params: {}, reasoning: "An AI agent requested everyone's share." } });
  return text({ result: DECISION[r.decision] ?? r.decision });
});

server.tool("kitty_send_reminders", "Send each member who still owes a personalised reminder (tone adapts to how they have paid so far).", { kittyId: z.string() }, async ({ kittyId }) => {
  const { kitty } = await api(`/api/kitties/${kittyId}`);
  const ids = kitty.members.filter((m) => m.paid < m.share).map((m) => m.id);
  const r = await api(`/api/kitties/${kittyId}/action`, { label: "AI agent: send reminders", action: { type: "send_reminders", params: { memberIds: ids }, reasoning: "An AI agent sent reminders." } });
  return text({ result: DECISION[r.decision] ?? r.decision, reminded: ids.length });
});

server.tool("kitty_ask", "Give the kitty's own treasurer agent a plain-language instruction (e.g. 'pay the hotel 500 and remind Kenji').", { kittyId: z.string(), instruction: z.string() }, async ({ kittyId, instruction }) => text(await api(`/api/kitties/${kittyId}/command`, { text: instruction })));

server.tool("kitty_open_proposals", "List proposals waiting for votes.", { kittyId: z.string() }, async ({ kittyId }) => {
  const { kitty: k } = await api(`/api/kitties/${kittyId}`);
  return text(k.proposals.filter((p) => p.status === "pending").map((p) => ({ id: p.id, title: p.title, reasoning: p.action.reasoning, approvals: p.approvals.length, needed: k.mandate.quorum, failedChecks: p.policy.checks.filter((c) => !c.pass).map((c) => c.rule) })));
});

server.tool("kitty_vote", "Cast the user's own vote on a proposal. Only do this when the user explicitly asked you to.", { kittyId: z.string(), proposalId: z.string(), approve: z.boolean() }, async ({ kittyId, proposalId, approve }) => {
  const pr = await api(`/api/kitties/${kittyId}/vote`, { proposalId, approve });
  return text({ status: pr.status, approvals: pr.approvals.length, rejections: pr.rejections.length });
});

server.tool("kitty_audit", "Recent audit-trail events with the agent's reasoning, plus whether the tamper-evident hash chain verifies.", { kittyId: z.string(), limit: z.number().int().min(1).max(50).default(10) }, async ({ kittyId, limit }) => {
  const { kitty: k, chain } = await api(`/api/kitties/${kittyId}`);
  return text({ chain, events: k.ledger.slice(0, limit).map((e) => ({ time: e.ts, actor: e.actor, title: e.title, reasoning: e.reasoning, detail: e.detail })) });
});

server.tool("kitty_refund_member", "Propose refunding a member (money leaves the pool, so it always needs the group's votes). Refunds through PayPal when the member paid with PayPal.", { kittyId: z.string(), member: z.string().describe("Member name or id"), amount: z.number().positive().describe("Amount in the kitty's base currency") }, async ({ kittyId, member, amount }) => {
  const { kitty } = await api(`/api/kitties/${kittyId}`);
  const q = member.toLowerCase();
  const m = kitty.members.find((x) => x.id === member) || kitty.members.find((x) => x.name.toLowerCase().includes(q));
  if (!m) throw new Error(`No member matches "${member}"`);
  const r = await api(`/api/kitties/${kittyId}/action`, { label: `AI agent: refund ${m.name} ${amount}`, action: { type: "refund_member", params: { memberId: m.id, amount }, reasoning: `An AI agent asked to refund ${m.name}.` } });
  return text({ result: DECISION[r.decision] ?? r.decision, policy: await lastPolicy(kittyId) });
});

server.tool("kitty_void_payout", "Propose stopping a vendor payout that has not been claimed yet (PayPal can only cancel UNCLAIMED payouts). Needs the group's votes.", { kittyId: z.string(), payoutId: z.string() }, async ({ kittyId, payoutId }) => {
  const r = await api(`/api/kitties/${kittyId}/action`, { label: "AI agent: void payout", action: { type: "void_payout", params: { payoutId }, reasoning: "An AI agent asked to stop this payout." } });
  return text({ result: DECISION[r.decision] ?? r.decision, policy: await lastPolicy(kittyId) });
});

server.tool("kitty_start_hold", "Start an authorization hold for the user's own share: the money is reserved on their PayPal and only charged when the mandate is in force. Returns a PayPal approval link for the user to open.", { kittyId: z.string() }, async ({ kittyId }) => text(await api(`/api/kitties/${kittyId}/holds`, {})));

server.tool("kitty_hold_action", "Authorize (after the user approved on PayPal), capture (organiser) or void a hold.", { kittyId: z.string(), holdId: z.string(), action: z.enum(["authorize", "capture", "void"]) }, async ({ kittyId, holdId, action }) => text(await api(`/api/kitties/${kittyId}/holds/${holdId}`, { action })));

server.tool("kitty_guard_scan", "Screen untrusted text (a vendor name, a memo, a pasted listing) for hidden instructions aimed at an AI agent, before acting on it.", { text: z.string() }, async ({ text: t }) => text(await api("/api/guard/scan", { text: t })));

server.tool("kitty_verify", "Independently verify the group's Ed25519 mandate signatures and the hash-chained audit trail.", { kittyId: z.string() }, async ({ kittyId }) => text(await api(`/api/kitties/${kittyId}/verify`)));

server.tool("kitty_discover", "Find real products/merchants (Channel3, free tier) priced in the kitty's currency, each screened by the injection guard. Use it to research before proposing a payment.", { kittyId: z.string(), query: z.string() }, async ({ kittyId, query }) => text(await api(`/api/kitties/${kittyId}/discover?q=${encodeURIComponent(query)}`)));

await server.connect(new StdioServerTransport());
