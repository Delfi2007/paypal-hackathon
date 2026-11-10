"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, Check, Copy, Loader2, Plus, Search, SendHorizontal } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, BigMoney, Chip, FeatureTag, PayPalBadge, SectionHead, api, timeAgo } from "@/components/kit";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";

const CARD_COLORS = ["#f4f15a", "#3cf0c6", "#38a8ff", "#c9b8ff", "#ff9eb1"];

export default function WalletPage() {
  const { kitty: k, actor, reload, invite } = useKitty();
  const cur = k.baseCurrency;
  const collected = k.members.reduce((s, m) => s + m.paid, 0);
  const pool = collected - k.spent;
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);

  // Money held per currency the group pays in (multi-currency, one settlement)
  const byCurrency = useMemo(() => {
    const map = new Map<Currency, { local: number; base: number; members: number }>();
    for (const m of k.members) {
      const e = map.get(m.currency) ?? { local: 0, base: 0, members: 0 };
      e.members += 1;
      e.base += m.paid;
      e.local += m.paidLocal && m.paidLocal.currency === m.currency ? m.paidLocal.amount : m.currency === cur ? m.paid : 0;
      map.set(m.currency, e);
    }
    return [...map.entries()];
  }, [k.members, cur]);

  const tx = k.ledger.filter((e) => (e.kind === "payment" || e.kind === "payout") && e.amount);

  // Pool balance over time for the sparkline
  const series = useMemo(() => {
    const evs = [...tx].reverse();
    let bal = 0;
    const pts = [0];
    for (const e of evs) { bal += e.kind === "payment" ? e.amount! : -e.amount!; pts.push(bal); }
    return pts;
  }, [tx]);

  async function requestAll() {
    setRequesting(true);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${k.id}/action`, { actorId: actor.id, label: "Request everyone's share", action: { type: "request_contributions", params: {} } });
      setRequested(r.decision);
      reload();
    } finally { setRequesting(false); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 rise">
        <FeatureTag n="07" label="Multi-currency, one settlement" />
        <FeatureTag n="11" label="Member checkout" />
      </div>

      {/* ---------------- dark wallet hero (video 2) */}
      <section className="relative overflow-hidden rounded-[2rem] bg-night text-white p-6 sm:p-9 rise">
        <div className="absolute -top-32 -left-24 size-[420px] rounded-full bg-[#2f5bff]/25 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 size-[380px] rounded-full bg-[#7b5cff]/20 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Avatar m={actor} size={34} /> <span className="text-sm text-white/70">{k.name}</span></span>
              <Bell size={18} className="text-white/60 lg:hidden" />
            </div>
            <p className="text-white/55 mt-8 text-sm">Pool balance</p>
            <BigMoney value={fmt(pool, cur)} className="block text-6xl sm:text-7xl font-medium mt-1 tracking-tight" />
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/k/${k.id}/send`} className="btn bg-white text-ink hover:bg-white/90 !py-2.5"><SendHorizontal size={16} /> Pay vendor</Link>
              <button onClick={requestAll} disabled={requesting} className="btn glass-dark text-white !py-2.5">
                {requesting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />} Request shares
              </button>
            </div>
            {requested && <p className="mt-3 text-sm text-mint pop">PayPal invoices sent to everyone who owes. See Activity.</p>}

            <div className="mt-8 glass-dark rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-white/55 text-sm">Spent from pool</p>
                <p className="num text-2xl mt-0.5">{fmt(k.spent, cur)}</p>
                <p className="text-xs text-white/40 mt-0.5">of {fmt(k.mandate.totalBudget, cur)} budget</p>
              </div>
              <div className="flex -space-x-2">
                {k.payouts.slice(0, 4).map((p) => {
                  const v = k.vendors.find((x) => x.id === p.vendorId);
                  return <span key={p.id} title={v?.name} className="grid place-items-center size-9 rounded-full border-2 border-night bg-white text-ink text-xs font-bold">{v?.name.slice(0, 1)}</span>;
                })}
                {k.payouts.length === 0 && <span className="text-xs text-white/40">No payouts yet</span>}
              </div>
            </div>
          </div>

          {/* stacked currency cards */}
          <div className="relative h-[330px] sm:h-[360px]">
            {byCurrency.map(([c, e], i) => (
              <div key={c}
                className="absolute left-0 right-0 mx-auto w-[92%] sm:w-[86%] h-[150px] rounded-[1.4rem] p-5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.7)] stack-in transition-transform duration-500 hover:-translate-y-3"
                style={{ top: i * 58, background: CARD_COLORS[i % CARD_COLORS.length], animationDelay: `${i * 0.08}s`, zIndex: i }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{c} pocket</span>
                  <span className="text-sm font-semibold opacity-70">{e.members} payer{e.members > 1 ? "s" : ""}</span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <BigMoney value={fmt(e.local || 0, c)} className="text-3xl font-semibold" />
                  <span className="text-xs font-semibold opacity-70">→ {fmt(e.base, cur)}</span>
                </div>
              </div>
            ))}
            <p className="absolute bottom-0 left-0 right-0 text-center text-xs text-white/45">Everyone pays in their own currency. The pool settles in {cur}.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ---------------- transactions sheet */}
        <section className="panel p-6 rise" style={{ animationDelay: ".08s" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Transactions</h3>
            <div className="flex items-center gap-2"><PayPalBadge what="Orders · Payouts" /><Search size={16} className="text-mute" /></div>
          </div>
          <Sparkline points={series} />
          <ul className="mt-2 divide-y divide-line">
            {tx.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className={`grid place-items-center size-10 rounded-full ${e.kind === "payment" ? "bg-ok-soft text-ok" : "bg-soft text-ink"}`}>
                  {e.kind === "payment" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-mute truncate">{e.detail ?? e.ref} · {timeAgo(e.ts)}</p>
                </div>
                <span className={`num font-semibold ${e.kind === "payment" ? "text-ok" : "text-ink"}`}>
                  {e.kind === "payment" ? "+" : "−"}{fmt(e.amount!, cur)}
                </span>
              </li>
            ))}
            {tx.length === 0 && <li className="py-8 text-center text-mute">No money has moved yet.</li>}
          </ul>
          <Link href={`/k/${k.id}/activity`} className="mt-3 inline-block text-sm font-semibold text-blue">Full audit timeline →</Link>
        </section>

        {/* ---------------- recipients grid */}
        <section className="rise" style={{ animationDelay: ".14s" }}>
          <SectionHead eyebrow="Travellers" title="Who's in" right={<Link href={`/k/${k.id}/agent`} className="btn btn-ghost !py-2 text-sm"><Bell size={14} /> Remind</Link>} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {k.members.map((m) => <MemberTile key={m.id} kittyId={k.id} m={m} cur={cur} me={m.id === actor.id} />)}
            {k.members.length < k.expectedMembers && (
              <button onClick={invite} className="rounded-[1.4rem] border-2 border-dashed border-line grid place-items-center text-mute hover:text-ink hover:border-ink/30 min-h-[170px]">
                <span className="flex flex-col items-center gap-1 text-sm"><Plus /> Invite a friend<span className="text-xs">{k.members.length}/{k.expectedMembers} joined</span></span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MemberTile({ kittyId, m, cur, me }: { kittyId: string; m: ReturnType<typeof useKitty>["kitty"]["members"][0]; cur: Currency; me: boolean }) {
  const { actor, reload } = useKitty();
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const done = m.paid >= m.share;
  async function leave() {
    setBusy(true);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${kittyId}/action`, { label: me ? `${m.name} asks to leave the kitty` : `Remove ${m.name} from the kitty`, action: { type: "drop_member", params: { memberId: m.id }, reasoning: me ? `${m.name} can't make it any more.` : `${m.name} dropped out.` } });
      setNote(r.decision === "needs_quorum" ? "Vote opened: see Approvals" : r.decision);
      await reload();
    } catch (e) { setNote((e as Error).message); } finally { setBusy(false); setConfirmLeave(false); }
  }
  async function cash() {
    setBusy(true);
    try {
      await api(`/api/kitties/${kittyId}/action`, { label: `Record ${m.name}'s share as paid in cash`, action: { type: "record_cash", params: { memberId: m.id }, reasoning: `${m.name} handed over their share in cash.` } });
      await reload();
    } finally { setBusy(false); }
  }
  return (
    <div className={`panel !rounded-[1.4rem] p-4 flex flex-col items-center text-center hover:-translate-y-1 transition-transform ${me ? "ring-2 ring-blue/40" : ""}`}>
      <div className="relative">
        <Avatar m={m} size={54} />
        <span className={`absolute -right-0.5 -bottom-0.5 grid place-items-center size-5 rounded-full border-2 border-white ${done ? "bg-ok" : "bg-warn"}`}>
          {done ? <Check size={11} className="text-white" /> : <span className="size-1.5 rounded-full bg-white" />}
        </span>
      </div>
      <p className="font-semibold mt-2">{m.name}{me && <span className="text-mute font-normal"> (you)</span>}</p>
      <p className="text-[11px] text-mute">pays in {m.currency}{m.role === "organizer" ? " · organiser" : ""}</p>
      <p className="num text-lg font-semibold mt-2">{fmt(m.paid, cur)}<span className="text-mute text-xs font-normal"> / {fmt(m.share, cur)}</span></p>
      {done ? (
        <Chip tone="ok" className="mt-2"><Check size={11} /> Paid</Chip>
      ) : me ? (
        <Link href={`/pay/${kittyId}`} className="btn btn-blue !py-1.5 !px-3 text-xs mt-2">Pay my share</Link>
      ) : (
        <Chip tone="warn" className="mt-2">{m.remindersSent ? `${m.remindersSent} reminder${m.remindersSent > 1 ? "s" : ""}` : "Hasn't paid yet"}</Chip>
      )}
      {!done && actor.role === "organizer" && (
        <button onClick={cash} disabled={busy} className="mt-2 text-[11px] font-semibold text-blue hover:underline">{busy ? "Recording…" : "Mark paid in cash"}</button>
      )}
      {m.role !== "organizer" && (me || actor.role === "organizer") && (
        <button onClick={() => (confirmLeave ? leave() : setConfirmLeave(true))} onBlur={() => setTimeout(() => setConfirmLeave(false), 150)} disabled={busy}
          className={`mt-1 text-[11px] font-semibold hover:underline ${confirmLeave ? "text-bad" : "text-mute"}`}>
          {confirmLeave ? "Tap again to ask the group" : me ? "Leave this kitty" : "Friend dropped out?"}
        </button>
      )}
      {note && <p className="mt-1 text-[11px] text-ink-2">{note}</p>}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 600, h = 90;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / (max - min || 1)) * (h - 10) - 5]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 mt-4" preserveAspectRatio="none" aria-label="Pool balance over time">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f5bff" stopOpacity=".22" />
          <stop offset="1" stopColor="#2f5bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#spark)" />
      <path d={d} fill="none" stroke="#2f5bff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
