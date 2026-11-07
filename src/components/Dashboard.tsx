"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bot, Check, ChevronDown, CircleDollarSign, Clock, Copy, FileText, Gavel, Loader2,
  Receipt, RefreshCw, RotateCcw, Send, ShieldAlert, ShieldCheck, Sparkles, Upload, Users, Vote, X,
} from "lucide-react";
import type { Bill, Kitty, LedgerEvent, Member, ModeStatus, PolicyResult, Proposal } from "@/lib/types";
import { fmt } from "@/lib/money";
import { Nav } from "./Nav";
import { Avatar, Badge, timeAgo } from "./ui";
import Image from "next/image";

type Data = { kitty: Kitty; mode: ModeStatus };

async function api<T>(url: string, body?: unknown, form?: FormData): Promise<T> {
  const r = await fetch(url, {
    method: body !== undefined || form ? "POST" : "GET",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j as T;
}

export function Dashboard({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actorId, setActorId] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const d = await api<Data>(`/api/kitties/${id}`);
      setData(d);
      setErr(null);
      setActorId((a) => a || d.kitty.members.find((m) => m.isOrganizer)?.id || d.kitty.members[0]?.id);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (err && !data)
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <p className="display text-4xl">Kitty not found</p>
          <Link href="/" className="link-under mt-4 inline-block">Back home</Link>
        </div>
      </div>
    );
  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-aegean" /></div>;

  const { kitty: k, mode } = data;
  const actor = k.members.find((m) => m.id === actorId) ?? k.members[0];

  return (
    <main className="min-h-screen w-full">
      <header className="w-full px-6 sm:px-10 lg:px-16 pt-6">
        <Nav right={<ModeBadges mode={mode} />} />
      </header>
      <Hero k={k} />
      <ActingAs k={k} actor={actor} onPick={setActorId} />
      <CommandBar k={k} actor={actor} onDone={load} />

      <section className="w-full px-6 sm:px-10 lg:px-16 pb-20 grid gap-8 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="space-y-8 min-w-0">
          <Proposals k={k} actor={actor} onDone={load} />
          <Members k={k} onDone={load} />
          <Ledger k={k} />
        </div>
        <aside className="space-y-8 min-w-0">
          <MandateCard k={k} />
          <BillSplitter k={k} actor={actor} onDone={load} />
          <Payouts k={k} />
          {k.id === "santorini" && (
            <button
              onClick={async () => { await api(`/api/kitties/${k.id}/reset`, {}); load(); }}
              className="pill pill-line w-full justify-center text-sm"
            >
              <RotateCcw size={14} /> Reset demo
            </button>
          )}
        </aside>
      </section>
    </main>
  );
}

// ------------------------------------------------------------------ pieces

function ModeBadges({ mode }: { mode: ModeStatus }) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={mode.paypal === "live-sandbox" ? "aegean" : "mute"}>
        <CircleDollarSign size={12} /> {mode.paypal === "live-sandbox" ? "PayPal sandbox · live" : "PayPal · simulated"}
      </Badge>
      <Badge tone={mode.ai === "gemini" ? "bloom" : "mute"}>
        <Sparkles size={12} /> {mode.ai === "gemini" ? "AI agent · live" : "AI agent · offline"}
      </Badge>
    </div>
  );
}

function Hero({ k }: { k: Kitty }) {
  const collected = k.members.reduce((s, m) => s + m.paid, 0);
  const target = k.members.reduce((s, m) => s + m.share, 0);
  const pool = collected - k.spent;
  const cur = k.baseCurrency;
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, k.mandate.totalBudget)) * 100)}%`;
  const paidCount = k.members.filter((m) => m.paid >= m.share).length;
  const daysLeft = Math.ceil((new Date(k.mandate.deadline).getTime() - Date.now()) / 86400000);

  return (
    <section className="w-full grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-0 mt-8">
      <div className="px-6 sm:px-10 lg:px-16 py-8">
        <p className="eyebrow flex items-center gap-3"><span className="rule" /> {k.destination}</p>
        <h1 className="display text-6xl sm:text-7xl xl:text-8xl mt-4">{k.name}</h1>
        <p className="mt-4 text-ink-soft text-lg max-w-xl">{k.tagline}</p>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_0.8fr] gap-x-8 gap-y-6">
          <Stat label="In the pool" value={fmt(pool, cur)} big />
          <Stat label="Collected" value={fmt(collected, cur)} sub={`of ${fmt(target, cur)}`} />
          <Stat label="Spent" value={fmt(k.spent, cur)} sub={`of ${fmt(k.mandate.totalBudget, cur)} budget`} />
          <Stat label="Paid up" value={`${paidCount}/${k.members.length}`} sub={daysLeft >= 0 ? `${daysLeft} days to deadline` : "deadline passed"} />
        </div>

        <div className="mt-8">
          <div className="relative h-3 rounded-full bg-sand overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-aegean/35 transition-all duration-700" style={{ width: pct(collected) }} />
            <div className="absolute inset-y-0 left-0 bg-bloom transition-all duration-700" style={{ width: pct(k.spent) }} />
          </div>
          <div className="mt-2 flex gap-5 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-bloom" /> Spent</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-aegean/40" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sand border border-ink/10" /> Budget</span>
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block min-h-[380px] overflow-hidden rounded-l-[2.5rem]">
        <Image src={k.id === "santorini" ? "/images/terrace.webp" : "/images/hero.webp"} alt={k.destination} fill sizes="45vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
          <p className="script text-5xl text-paper drop-shadow-[0_2px_8px_rgba(15,26,43,.5)] -rotate-3">Slower days, settled.</p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`display mt-2 whitespace-nowrap ${big ? "text-4xl xl:text-5xl text-aegean" : "text-2xl xl:text-3xl"}`}>{value}</p>
      {sub && <p className="text-xs text-mute mt-1">{sub}</p>}
    </div>
  );
}

function ActingAs({ k, actor, onPick }: { k: Kitty; actor: Member; onPick: (id: string) => void }) {
  return (
    <section className="w-full px-6 sm:px-10 lg:px-16 mt-4 flex flex-wrap items-center gap-4">
      <span className="eyebrow">Acting as</span>
      <div className="flex flex-wrap gap-2">
        {k.members.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border transition ${m.id === actor.id ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-ink/40"}`}
          >
            <Avatar m={m} size={26} />
            <span className="text-sm">{m.name}</span>
          </button>
        ))}
      </div>
      <span className="text-xs text-mute">Demo only: switch person to vote as each friend.</span>
    </section>
  );
}

function CommandBar({ k, actor, onDone }: { k: Kitty; actor: Member; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ reply: string; results: { title: string; decision: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hotel = k.vendors.find((v) => v.category === "stay");
  const sail = k.vendors.find((v) => v.category === "activities");
  const cur = k.baseCurrency === "EUR" ? "€" : k.baseCurrency === "GBP" ? "£" : "$";
  const chips = [
    hotel && `Pay ${hotel.name} the ${cur}1,800 deposit`,
    sail && `Book the sunset sail with ${sail.name} for ${cur}420`,
    "Remind whoever hasn't paid",
    "Send everyone their PayPal request",
    `Raise the per-payment cap to ${cur}2,000`,
    `Pay a new beach club, Kamari Sands, ${cur}300 for loungers`,
  ].filter(Boolean) as string[];

  async function send(t = text) {
    if (!t.trim() || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const r = await api<{ reply: string; results: { title: string; decision: string }[] }>(`/api/kitties/${k.id}/command`, { text: t, actorId: actor.id });
      setReply(r);
      setText("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full px-6 sm:px-10 lg:px-16 my-10">
      <div className="rounded-[2rem] bg-ink text-cream p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-aegean/50 blur-2xl" />
        <div className="absolute right-40 -bottom-32 size-72 rounded-full bg-bloom/30 blur-3xl" />
        <div className="relative">
          <p className="eyebrow !text-sky flex items-center gap-2"><Bot size={14} /> Tell your treasurer</p>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="mt-4 flex items-center gap-3 rounded-full bg-cream/10 border border-cream/15 pl-6 pr-2 py-2 focus-within:border-cream/50"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`e.g. “Pay the hotel deposit and nudge Kenji”, speaking as ${actor.name}`}
              className="flex-1 bg-transparent outline-none text-lg placeholder:text-cream/45 min-w-0"
            />
            <button disabled={busy} className="pill bg-cream text-ink hover:bg-white disabled:opacity-60 shrink-0">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {busy ? "Thinking" : "Send"}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)} disabled={busy}
                className="rounded-full border border-cream/20 px-3.5 py-1.5 text-sm text-cream/85 hover:bg-cream/10 disabled:opacity-50">
                {c}
              </button>
            ))}
          </div>

          {(reply || error || busy) && (
            <div className="mt-6 rounded-2xl bg-cream text-ink p-5 rise">
              {busy && <div className="h-5 w-2/3 rounded thinking" />}
              {error && <p className="text-bloom">{error}</p>}
              {reply && (
                <>
                  <p className="flex gap-2 items-start"><Sparkles size={18} className="text-bloom mt-0.5 shrink-0" /> {reply.reply}</p>
                  {reply.results.length > 0 && (
                    <ul className="mt-4 grid sm:grid-cols-2 gap-2">
                      {reply.results.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-paper border border-ink/10 px-4 py-3 text-sm">
                          <span>{r.title}</span>
                          <DecisionBadge d={r.decision} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DecisionBadge({ d }: { d: string }) {
  if (d === "allow") return <Badge tone="olive"><Check size={12} /> Executed</Badge>;
  if (d === "needs_quorum") return <Badge tone="bloom"><Vote size={12} /> Vote opened</Badge>;
  if (d === "queued") return <Badge tone="gold"><Clock size={12} /> Waiting for funds</Badge>;
  return <Badge tone="mute"><X size={12} /> Blocked</Badge>;
}

function SectionTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display text-4xl mt-2">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Proposals({ k, actor, onDone }: { k: Kitty; actor: Member; onDone: () => void }) {
  const open = k.proposals.filter((p) => p.status === "pending");
  const closed = k.proposals.filter((p) => p.status !== "pending").slice(0, 4);
  const [busy, setBusy] = useState<string | null>(null);

  async function cast(p: Proposal, approve: boolean) {
    setBusy(p.id + approve);
    try {
      await api(`/api/kitties/${k.id}/vote`, { proposalId: p.id, memberId: actor.id, approve });
      onDone();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <SectionTitle eyebrow="Quorum consent" title="Waiting on the group" right={<Badge tone={open.length ? "bloom" : "mute"}><Gavel size={12} /> {open.length} open</Badge>} />
      {open.length === 0 && (
        <div className="card p-8 text-center text-ink-soft">
          <ShieldCheck className="mx-auto text-olive" />
          <p className="mt-3">Nothing needs a vote. Everything so far stayed inside the mandate.</p>
          <p className="text-sm text-mute mt-1">Try “Pay Caldera Cliff Suites the €1,800 deposit”. It&apos;s over the cap, so it will need votes.</p>
        </div>
      )}
      <div className="grid gap-4 2xl:grid-cols-2">
        {open.map((p) => {
          const voted = p.approvals.includes(actor.id) ? "yes" : p.rejections.includes(actor.id) ? "no" : null;
          return (
            <div key={p.id} className="card p-6 rise">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{p.awaitingFunds ? "Approved · waiting for funds" : "Outside the mandate"}</p>
                  <h3 className="display text-2xl mt-2">{p.title}</h3>
                </div>
                {p.awaitingFunds ? <Badge tone="gold"><Clock size={12} /> Queued</Badge> : <Badge tone="bloom">{p.approvals.length}/{k.mandate.quorum}</Badge>}
              </div>
              <p className="mt-3 text-sm text-ink-soft italic">“{p.action.reasoning}”</p>
              <PolicyList policy={p.policy} />
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {k.members.map((m) => (
                    <span key={m.id} className={`rounded-full ${p.approvals.includes(m.id) ? "" : p.rejections.includes(m.id) ? "opacity-30 grayscale" : "opacity-25"}`}>
                      <Avatar m={m} size={28} />
                    </span>
                  ))}
                </div>
                {!p.awaitingFunds && (
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => cast(p, false)} disabled={!!busy}
                      className={`pill pill-line !py-2 !px-4 text-sm ${voted === "no" ? "bg-ink/10" : ""}`}>
                      <X size={14} /> Reject
                    </button>
                    <button onClick={() => cast(p, true)} disabled={!!busy}
                      className={`pill pill-dark !py-2 !px-4 text-sm ${voted === "yes" ? "!bg-olive" : ""}`}>
                      {busy === p.id + "true" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {voted === "yes" ? "Approved" : `Approve as ${actor.name}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {closed.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {closed.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 text-sm rounded-full bg-paper border border-ink/10 px-3 py-1.5">
              {p.status === "executed" ? <Check size={13} className="text-olive" /> : <X size={13} className="text-bloom" />} {p.title}
              <span className="text-mute text-xs">{p.status}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyList({ policy, compact }: { policy: PolicyResult; compact?: boolean }) {
  if (!policy.checks.length) return null;
  return (
    <ul className={`mt-4 grid ${compact ? "gap-1" : "gap-1.5 sm:grid-cols-2"} text-sm`}>
      {policy.checks.map((c) => (
        <li key={c.rule} className="flex gap-2 items-start">
          {c.pass ? <Check size={15} className="text-olive mt-0.5 shrink-0" /> : c.severity === "block" ? <ShieldAlert size={15} className="text-bloom mt-0.5 shrink-0" /> : <X size={15} className="text-bloom mt-0.5 shrink-0" />}
          <span>
            <span className={c.pass ? "" : "text-bloom font-medium"}>{c.rule}</span>
            <span className="text-mute"> · {c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Members({ k, onDone }: { k: Kitty; onDone: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div>
      <SectionTitle
        eyebrow="Many currencies, one pool"
        title="The travellers"
        right={
          <button
            onClick={async () => { setSyncing(true); try { await api(`/api/kitties/${k.id}/sync`, {}); onDone(); } finally { setSyncing(false); } }}
            className="pill pill-line !py-2 !px-4 text-sm"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync PayPal
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5 lg:grid-cols-3">
        {k.members.map((m) => {
          const done = m.paid >= m.share;
          const payUrl = `/pay/${k.id}/${m.id}`;
          return (
            <div key={m.id} className={`rounded-[1.25rem] p-5 border flex flex-col ${done ? "bg-paper border-ink/10" : "bg-bloom-soft/30 border-bloom/20"}`}>
              <div className="flex items-center gap-3">
                <Avatar m={m} size={40} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name} {m.isOrganizer && <span className="text-xs text-mute">· organiser</span>}</p>
                  <p className="text-xs text-mute">pays in {m.currency} · {m.persona}</p>
                </div>
              </div>
              <p className="display text-3xl mt-4">{fmt(m.paid, k.baseCurrency)}</p>
              <p className="text-xs text-mute">of {fmt(m.share, k.baseCurrency)}{m.paidLocal && m.paidLocal.currency !== k.baseCurrency ? ` · paid ${fmt(m.paidLocal.amount, m.paidLocal.currency)}` : ""}</p>
              <div className="mt-3 h-1.5 rounded-full bg-sand overflow-hidden">
                <div className={`h-full ${done ? "bg-olive" : "bg-bloom"}`} style={{ width: `${Math.min(100, (m.paid / Math.max(1, m.share)) * 100)}%` }} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                {done ? <Badge tone="olive"><Check size={12} /> Paid</Badge> : <Badge tone="bloom">{m.remindersSent} reminder{m.remindersSent === 1 ? "" : "s"}</Badge>}
                {m.invoiceId && <Badge tone="aegean"><FileText size={11} /> Invoiced</Badge>}
              </div>
              {!done && (
                <div className="mt-auto pt-4 flex gap-2">
                  <Link href={payUrl} className="pill pill-dark !py-1.5 !px-3 text-xs flex-1 justify-center">
                    Pay share <ArrowRight size={12} />
                  </Link>
                  <button
                    title="Copy pay link"
                    onClick={() => { navigator.clipboard?.writeText(location.origin + payUrl); setCopied(m.id); setTimeout(() => setCopied(null), 1200); }}
                    className="pill pill-line !p-2"
                  >
                    {copied === m.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_ICON: Record<LedgerEvent["kind"], React.ReactNode> = {
  command: <Users size={14} />, plan: <Sparkles size={14} />, invoice: <FileText size={14} />, payment: <CircleDollarSign size={14} />,
  reminder: <Send size={14} />, payout: <ArrowRight size={14} />, policy: <ShieldCheck size={14} />, vote: <Vote size={14} />,
  mandate: <Gavel size={14} />, bill: <Receipt size={14} />, error: <ShieldAlert size={14} />, info: <Bot size={14} />,
};

const ACTOR_STYLE: Record<LedgerEvent["actor"], string> = {
  agent: "bg-bloom-soft text-bloom",
  policy: "bg-ink text-cream",
  paypal: "bg-sky text-aegean-deep",
  member: "bg-sand text-ink",
  system: "bg-olive/15 text-olive",
};

function Ledger({ k }: { k: Kitty }) {
  const [filter, setFilter] = useState<"all" | LedgerEvent["actor"]>("all");
  const [limit, setLimit] = useState(14);
  const items = useMemo(() => k.ledger.filter((e) => filter === "all" || e.actor === filter), [k.ledger, filter]);
  return (
    <div>
      <SectionTitle
        eyebrow="Explainable by default"
        title="The ledger"
        right={
          <div className="flex flex-wrap gap-1.5 justify-end">
            {(["all", "agent", "policy", "paypal", "member"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs capitalize border ${filter === f ? "bg-ink text-cream border-ink" : "border-ink/15"}`}>
                {f}
              </button>
            ))}
          </div>
        }
      />
      <ol className="relative border-l border-ink/15 ml-3">
        {items.slice(0, limit).map((e) => (
          <LedgerRow key={e.id} e={e} cur={k.baseCurrency} />
        ))}
      </ol>
      {items.length > limit && (
        <button onClick={() => setLimit((l) => l + 20)} className="mt-4 ml-8 link-under text-sm">Show more</button>
      )}
    </div>
  );
}

function LedgerRow({ e }: { e: LedgerEvent; cur: string }) {
  const [open, setOpen] = useState(false);
  const expandable = !!(e.policy?.checks.length || e.messages?.length || e.reasoning);
  return (
    <li className="relative ml-6 pb-6 rise">
      <span className={`absolute -left-[37px] top-0 grid place-items-center size-[26px] rounded-full ${ACTOR_STYLE[e.actor]}`}>{KIND_ICON[e.kind]}</span>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <p className="font-medium">{e.title}</p>
        <span className="text-xs text-mute capitalize">{e.actorName ?? e.actor} · {timeAgo(e.ts)}</span>
      </div>
      {e.detail && <p className="text-sm text-ink-soft mt-0.5">{e.detail}</p>}
      {e.reasoning && !open && <p className="text-sm text-ink-soft italic mt-1 line-clamp-1">“{e.reasoning}”</p>}
      {expandable && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-xs text-aegean flex items-center gap-1">
          {open ? "Hide" : "Why?"} <ChevronDown size={12} className={open ? "rotate-180" : ""} />
        </button>
      )}
      {open && (
        <div className="mt-2 card p-4 text-sm">
          {e.reasoning && <p className="italic text-ink-soft">“{e.reasoning}”</p>}
          {e.policy && (
            <>
              <p className="mt-2 font-medium">{e.policy.summary}</p>
              <PolicyList policy={e.policy} compact />
            </>
          )}
          {e.messages?.map((m, i) => (
            <div key={i} className="mt-3 rounded-xl bg-sky/40 px-3 py-2">
              <span className="eyebrow">To {m.to}</span>
              <p className="mt-1">{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function MandateCard({ k }: { k: Kitty }) {
  const m = k.mandate;
  const cur = k.baseCurrency;
  return (
    <div className="rounded-[1.5rem] bg-paper border border-ink/10 p-7 relative overflow-hidden">
      <div className="absolute inset-3 rounded-[1.1rem] border border-gold/30 pointer-events-none" />
      <p className="eyebrow text-center">Signed mandate · v{m.version}</p>
      <h3 className="display text-4xl text-center mt-3">The Rules</h3>
      <p className="text-center text-xs text-mute mt-1">The agent cannot act outside these</p>
      <dl className="mt-6 divide-y divide-ink/10 text-sm">
        <Row k="Total budget" v={fmt(m.totalBudget, cur)} />
        <Row k="Per-payment cap" v={fmt(m.perPaymentCap, cur)} />
        <Row k="Quorum to override" v={`${m.quorum} of ${k.members.length}`} />
        <Row k="Collection deadline" v={new Date(m.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
        <Row k="Categories" v={m.allowedCategories.join(", ")} />
      </dl>
      <p className="eyebrow mt-5">Pre-approved payees</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {k.vendors.map((v) => (
          <span key={v.id} className={`text-xs rounded-full px-2.5 py-1 border ${m.approvedPayees.includes(v.id) ? "border-olive/40 text-olive bg-olive/5" : "border-ink/15 text-mute line-through decoration-ink/30"}`}>
            {v.name}
          </span>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex -space-x-2">
          {k.members.filter((x) => m.signedBy.includes(x.id)).map((x) => <Avatar key={x.id} m={x} size={26} />)}
        </div>
        <p className="script text-3xl text-aegean">signed</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5 gap-4">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  );
}

function BillSplitter({ k, actor, onDone }: { k: Kitty; actor: Member; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ bill: Bill; vendorId: string; totalBase: number; note?: string } | null>(null);
  const [paid, setPaid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function read() {
    setBusy(true); setErr(null); setPaid(null);
    try {
      const f = new FormData();
      if (file) f.append("image", file);
      f.append("hint", hint);
      const r = await api<typeof res>(`/api/kitties/${k.id}/bill`, undefined, f);
      setRes(r);
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function payFromKitty() {
    if (!res) return;
    setBusy(true);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${k.id}/action`, {
        actorId: actor.id,
        label: `Pay the ${res.bill.merchant} bill from the kitty`,
        action: { type: "pay_vendor", params: { vendorId: res.vendorId, amount: res.totalBase, memo: `${res.bill.merchant} receipt` }, reasoning: `Itemised receipt read by Kitty; total ${fmt(res.totalBase, k.baseCurrency)} split across ${k.members.length}.` },
      });
      setPaid(r.decision);
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="card p-6">
      <p className="eyebrow flex items-center gap-2"><Receipt size={13} /> Vision split</p>
      <h3 className="display text-3xl mt-2">Snap the bill</h3>
      <p className="text-sm text-ink-soft mt-1">Kitty reads the receipt and splits it by who had what.</p>

      <button onClick={() => input.current?.click()} className="mt-4 w-full rounded-2xl border border-dashed border-ink/25 hover:border-aegean p-4 text-sm text-ink-soft flex items-center gap-3">
        {preview ? <img src={preview} alt="receipt preview" className="size-14 rounded-lg object-cover" /> : <Upload size={18} />}
        <span className="text-left">{file ? file.name : "Upload a receipt photo (or leave empty to use a sample)"}</span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null);
      }} />
      <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Who had what? e.g. Delfi skipped the wine"
        className="mt-3 w-full rounded-full border border-ink/15 bg-cream/50 px-4 py-2.5 text-sm outline-none focus:border-aegean" />
      <button onClick={read} disabled={busy} className="pill pill-dark w-full justify-center mt-3 text-sm">
        {busy && !res ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Read &amp; split
      </button>
      {err && <p className="text-sm text-bloom mt-3">{err}</p>}

      {res && (
        <div className="mt-5 rise">
          <p className="font-medium">{res.bill.merchant}</p>
          {res.note && <p className="text-xs text-mute">{res.note}</p>}
          <ul className="mt-2 text-sm divide-y divide-ink/5">
            {res.bill.items.map((it, i) => (
              <li key={i} className="py-1.5 flex justify-between gap-3">
                <span className="truncate">{it.name} <span className="text-mute text-xs">· {it.assignedTo.length && it.assignedTo.length < k.members.length ? it.assignedTo.map((id) => k.members.find((m) => m.id === id)?.name).join(", ") : "everyone"}</span></span>
                <span>{fmt(it.price, res.bill.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {k.members.map((m) => (
              <div key={m.id} className="text-center rounded-xl bg-sky/40 py-2">
                <Avatar m={m} size={22} />
                <p className="text-[11px] mt-1 font-medium">{fmt(res.bill.splits[m.id] ?? 0, k.baseCurrency)}</p>
              </div>
            ))}
          </div>
          <button onClick={payFromKitty} disabled={busy || !!paid} className="pill pill-line w-full justify-center mt-3 text-sm">
            {paid ? <DecisionBadge d={paid} /> : <>Pay {fmt(res.totalBase, k.baseCurrency)} from the kitty <ArrowRight size={14} /></>}
          </button>
        </div>
      )}
    </div>
  );
}

function Payouts({ k }: { k: Kitty }) {
  return (
    <div className="card p-6">
      <p className="eyebrow">PayPal Payouts</p>
      <h3 className="display text-3xl mt-2">Paid out</h3>
      {k.payouts.length === 0 ? (
        <p className="text-sm text-mute mt-3">No vendor payments yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10 text-sm">
          {k.payouts.map((p) => (
            <li key={p.id} className="py-2.5 flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{k.vendors.find((v) => v.id === p.vendorId)?.name}</p>
                <p className="text-xs text-mute truncate">{p.paypalBatchId} · {p.status}</p>
              </div>
              <span className="display text-xl">{fmt(p.amount, k.baseCurrency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
