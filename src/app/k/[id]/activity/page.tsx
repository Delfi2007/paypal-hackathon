"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Bot, ChevronDown, FileText, Gavel, Info, Loader2, MessageSquare, Receipt, RefreshCw,
  Send, ShieldAlert, ShieldCheck, Sparkles, Vote, Webhook,
} from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, PayPalBadge, api, timeAgo } from "@/components/kit";
import { fmt } from "@/lib/money";
import type { LedgerEvent } from "@/lib/types";

const ICON: Record<LedgerEvent["kind"], React.ReactNode> = {
  command: <MessageSquare size={15} />, plan: <Sparkles size={15} />, invoice: <FileText size={15} />, payment: <ArrowDownLeft size={15} />,
  reminder: <Send size={15} />, payout: <ArrowUpRight size={15} />, policy: <ShieldCheck size={15} />, vote: <Vote size={15} />,
  mandate: <Gavel size={15} />, bill: <Receipt size={15} />, error: <ShieldAlert size={15} />, info: <Bot size={15} />,
};
const ACTOR: Record<LedgerEvent["actor"], { cls: string; label: string }> = {
  agent: { cls: "bg-gradient-to-br from-blue to-[#7b5cff] text-white", label: "Agent" },
  policy: { cls: "bg-ink text-white", label: "Policy" },
  paypal: { cls: "bg-[#e6f3ff] text-[#003087]", label: "PayPal" },
  member: { cls: "bg-sun text-ink", label: "Member" },
  system: { cls: "bg-ok-soft text-[#0e8f40]", label: "System" },
};

export default function ActivityPage() {
  const { kitty: k, reload } = useKitty();
  const [filter, setFilter] = useState<"all" | LedgerEvent["actor"]>("all");
  const [limit, setLimit] = useState(20);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);
  const items = useMemo(() => k.ledger.filter((e) => filter === "all" || e.actor === filter), [k.ledger, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: k.ledger.length };
    for (const e of k.ledger) c[e.actor] = (c[e.actor] ?? 0) + 1;
    return c;
  }, [k.ledger]);

  async function sync() {
    setSyncing(true);
    try { const r = await api<{ updates: number }>(`/api/kitties/${k.id}/sync`, {}); setSynced(r.updates); await reload(); }
    finally { setSyncing(false); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><FeatureTag n="04" label="Explainable audit timeline" /><FeatureTag n="02" label="Invoices & payment tracking" /></div>
      <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <section className="min-w-0 rise">
          <p className="label">Explainable by default</p>
          <h1 className="display text-4xl sm:text-5xl font-medium mt-1">Audit timeline</h1>
          <p className="text-ink-2 mt-2 max-w-xl">Every command, plan, policy decision, vote and PayPal call, with the reason behind it. Tap “Why?” on any entry.</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {(["all", "agent", "policy", "paypal", "member", "system"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition ${filter === f ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink/30"}`}>
                {f === "all" ? "All" : ACTOR[f].label} <span className="opacity-50 ml-1">{counts[f] ?? 0}</span>
              </button>
            ))}
          </div>
          <ol className="mt-6 relative">
            <span className="absolute left-[19px] top-2 bottom-2 w-px bg-line" />
            {items.slice(0, limit).map((e, i) => <Row key={e.id} e={e} i={i} />)}
          </ol>
          {items.length > limit && <button onClick={() => setLimit((l) => l + 25)} className="btn btn-ghost ml-12">Show more</button>}
        </section>

        <aside className="space-y-6 rise" style={{ animationDelay: ".1s" }}>
          <div className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="label">PayPal Invoicing v2</p><h2 className="display text-3xl font-medium mt-1">Invoices</h2></div>
              <button onClick={sync} disabled={syncing} className="btn btn-ghost !py-2 text-sm"><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync</button>
            </div>
            {synced !== null && <p className="text-xs text-mute mt-2 pop">{synced ? `${synced} payment(s) picked up from PayPal` : "No new payments found"}</p>}
            <ul className="mt-4 divide-y divide-line">
              {k.members.map((m) => {
                const done = m.paid >= m.share;
                return (
                  <li key={m.id} className="py-3 flex items-center gap-3">
                    <Avatar m={m} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.name} <span className="text-mute font-normal">· {m.currency}</span></p>
                      <p className="text-xs text-mute truncate font-mono">{m.invoiceId ?? m.orderId ?? "not invoiced yet"}</p>
                    </div>
                    {done ? <Chip tone="ok">Paid</Chip> : m.invoiceId ? <Chip tone="blue">Sent</Chip> : <Chip>Not sent</Chip>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel p-6 bg-gradient-to-br from-white to-[#f2f5ff]">
            <p className="label flex items-center gap-2"><Webhook size={14} /> Webhooks</p>
            <h3 className="font-semibold mt-2">Payments update the ledger on their own</h3>
            <p className="text-sm text-ink-2 mt-1">PayPal calls back when an invoice is paid or a payout settles. Signatures are verified before anything changes.</p>
            <code className="block mt-3 rounded-xl bg-night text-mint text-xs p-3 overflow-x-auto">POST /api/paypal/webhook</code>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["INVOICING.INVOICE.PAID", "PAYMENT.PAYOUTS-ITEM.SUCCEEDED"].map((t) => <span key={t} className="text-[11px] font-mono rounded-full bg-white border border-line px-2 py-1">{t}</span>)}
            </div>
            <p className="text-xs text-mute mt-3 flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> On localhost, use Sync. PayPal can&apos;t reach your laptop.</p>
          </div>

          <div className="panel p-6">
            <div className="flex items-center justify-between"><p className="label">Payouts</p><PayPalBadge what="Payouts v1" /></div>
            <ul className="mt-3 divide-y divide-line text-sm">
              {k.payouts.length === 0 && <li className="py-4 text-mute">No vendor payments yet.</li>}
              {k.payouts.map((p) => (
                <li key={p.id} className="py-3 flex justify-between gap-3">
                  <div className="min-w-0"><p className="font-medium truncate">{k.vendors.find((v) => v.id === p.vendorId)?.name}</p><p className="text-xs text-mute font-mono truncate">{p.paypalBatchId} · {p.status}</p></div>
                  <span className="num font-semibold">{fmt(p.amount, k.baseCurrency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ e, i }: { e: LedgerEvent; i: number }) {
  const [open, setOpen] = useState(false);
  const a = ACTOR[e.actor];
  const more = !!(e.reasoning || e.policy?.checks.length || e.messages?.length);
  return (
    <li className="relative pl-14 pb-5 rise" style={{ animationDelay: `${Math.min(i, 10) * .03}s` }}>
      <span className={`absolute left-0 top-0 grid place-items-center size-10 rounded-full ${a.cls}`}>{ICON[e.kind]}</span>
      <div className="panel !rounded-2xl p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">{e.title}</p>
          <span className="text-xs text-mute">{e.actorName ?? a.label} · {timeAgo(e.ts)}</span>
        </div>
        {e.detail && <p className="text-sm text-ink-2 mt-1">{e.detail}</p>}
        {more && (
          <button onClick={() => setOpen(!open)} className="mt-2 text-xs font-semibold text-blue flex items-center gap-1">
            {open ? "Hide" : "Why?"} <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {open && (
          <div className="mt-3 space-y-3 text-sm pop">
            {e.reasoning && <p className="rounded-xl bg-soft px-3 py-2 italic text-ink-2">“{e.reasoning}”</p>}
            {e.policy && (
              <div>
                <p className="font-semibold">{e.policy.summary}</p>
                <ul className="mt-1.5 space-y-1">
                  {e.policy.checks.map((c) => (
                    <li key={c.rule} className="flex gap-2"><span className={c.pass ? "text-ok" : "text-bad"}>{c.pass ? "✓" : "✕"}</span> {c.rule} <span className="text-mute">· {c.detail}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {e.messages?.map((m, j) => (
              <div key={j} className="rounded-xl bg-[#e9f0ff] px-3 py-2"><span className="label">To {m.to}</span><p className="mt-0.5">{m.text}</p></div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
