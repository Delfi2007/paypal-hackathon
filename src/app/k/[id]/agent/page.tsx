"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Check, Clock, Loader2, Send, Sparkles, Vote, X } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, api, timeAgo } from "@/components/kit";
import { fmt } from "@/lib/money";

type Msg =
  | { role: "user"; text: string; who: string }
  | { role: "agent"; text: string; results: { title: string; decision: string }[] }
  | { role: "thinking" };

const PERSONA: Record<string, { tone: "ok" | "warn" | "bad" | "blue"; label: string; style: string }> = {
  prompt: { tone: "ok", label: "Prompt payer", style: "Light and thankful" },
  forgetful: { tone: "blue", label: "Forgetful", style: "Playful, one-tap" },
  late: { tone: "warn", label: "Often late", style: "Warm but specific" },
  new: { tone: "blue", label: "New to the group", style: "Welcoming, explains" },
};

export default function AgentPage() {
  const { kitty: k, actor, reload } = useKitty();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const cur = k.baseCurrency;
  const sym = cur === "EUR" ? "€" : cur === "GBP" ? "£" : "$";
  const hotel = k.vendors.find((v) => v.category === "stay");
  const sail = k.vendors.find((v) => v.category === "activities");

  const chips = [
    hotel && `Pay ${hotel.name} the ${sym}1,800 deposit`,
    sail && `Book the sunset sail with ${sail.name} for ${sym}420`,
    "Remind whoever hasn't paid",
    "Send everyone their PayPal request",
    `Raise the per-payment cap to ${sym}2,000`,
    "How much is left in the pool?",
    "The trip is over, close it out and refund everyone",
  ].filter(Boolean) as string[];

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);

  async function send(t = text) {
    if (!t.trim() || busy) return;
    setBusy(true);
    setText("");
    setMsgs((m) => [...m, { role: "user", text: t, who: actor.name }, { role: "thinking" }]);
    try {
      const r = await api<{ reply: string; results: { title: string; decision: string }[] }>(`/api/kitties/${k.id}/command`, { text: t, actorId: actor.id });
      setMsgs((m) => [...m.filter((x) => x.role !== "thinking"), { role: "agent", text: r.reply, results: r.results }]);
      reload();
    } catch (e) {
      setMsgs((m) => [...m.filter((x) => x.role !== "thinking"), { role: "agent", text: (e as Error).message, results: [] }]);
    } finally { setBusy(false); }
  }

  const owing = k.members.filter((m) => m.paid < m.share);
  const lastReminder = k.ledger.find((e) => e.kind === "reminder");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2"><FeatureTag n="01" label="Natural-language agent" /><FeatureTag n="08" label="Adaptive reminder tone" /></div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
        {/* chat */}
        <section className="panel overflow-hidden flex flex-col min-h-[640px] rise">
          <div className="relative px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-br from-[#eef2ff] via-white to-[#f6efff] border-b border-line">
            <div className="absolute right-6 top-6 size-24 rounded-full bg-gradient-to-br from-blue to-[#b07bff] opacity-20 blur-2xl" />
            <p className="label flex items-center gap-2"><Bot size={14} /> Your treasurer</p>
            <h1 className="display text-4xl sm:text-5xl font-medium mt-2">What should the<br />kitty do?</h1>
            <p className="text-ink-2 mt-3 max-w-lg text-sm">Plain language in, a plan of actions out. Every action is checked by the policy engine: some run at once, some open a vote, some wait for funds.</p>
          </div>

          <div className="flex-1 px-5 sm:px-8 py-6 space-y-4 overflow-y-auto max-h-[520px]">
            {msgs.length === 0 && (
              <div className="grid sm:grid-cols-2 gap-2">
                {chips.map((c) => (
                  <button key={c} onClick={() => send(c)} className="text-left rounded-2xl border border-line bg-white px-4 py-3 text-sm hover:border-blue hover:-translate-y-0.5 transition">
                    <Sparkles size={14} className="text-blue mb-1" />{c}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end gap-2 rise">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink text-white px-4 py-3">{m.text}</div>
                  <Avatar m={actor} size={30} />
                </div>
              ) : m.role === "thinking" ? (
                <div key={i} className="flex gap-2 items-center rise">
                  <span className="grid place-items-center size-8 rounded-full bg-gradient-to-br from-blue to-[#7b5cff] text-white"><Bot size={15} /></span>
                  <div className="rounded-2xl bg-soft px-4 py-3 text-sm text-mute flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Planning, then checking the mandate…</div>
                </div>
              ) : (
                <div key={i} className="flex gap-2 rise">
                  <span className="grid place-items-center size-8 shrink-0 rounded-full bg-gradient-to-br from-blue to-[#7b5cff] text-white"><Bot size={15} /></span>
                  <div className="max-w-[85%] space-y-2">
                    <div className="rounded-2xl rounded-tl-md bg-soft px-4 py-3">{m.text}</div>
                    {m.results.map((r, j) => (
                      <div key={j} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-sm pop" style={{ animationDelay: `${j * .08}s` }}>
                        <span>{r.title}</span>
                        <Decision d={r.decision} kittyId={k.id} />
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-4 sm:p-5 border-t border-line flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message as ${actor.name}, e.g. “pay the taxi 120 and nudge Kenji”`} className="input !rounded-full !py-3.5" />
            <button disabled={busy || !text.trim()} className="btn btn-blue !p-3.5" aria-label="Send"><ArrowUp size={18} /></button>
          </form>
          {msgs.length > 0 && (
            <div className="px-5 pb-4 -mt-2 flex gap-2 overflow-x-auto">
              {chips.slice(0, 4).map((c) => <button key={c} onClick={() => send(c)} disabled={busy} className="shrink-0 rounded-full bg-soft px-3 py-1.5 text-xs hover:bg-line">{c}</button>)}
            </div>
          )}
        </section>

        {/* adaptive reminders */}
        <section className="space-y-5 rise" style={{ animationDelay: ".1s" }}>
          <div className="panel p-6">
            <p className="label">Adaptive reminders</p>
            <h2 className="display text-3xl font-medium mt-1">Tone that fits each friend</h2>
            <p className="text-sm text-ink-2 mt-2">Kitty writes each reminder for the person reading it, based on how they&apos;ve paid before and how many nudges they&apos;ve had.</p>
            <ul className="mt-5 space-y-3">
              {owing.length === 0 && <li className="text-sm text-mute">Everyone has paid. Nobody to nudge 🎉</li>}
              {owing.map((m) => {
                const p = PERSONA[m.persona] ?? PERSONA.new;
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-soft/60 p-3">
                    <Avatar m={m} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{m.name} <span className="text-mute text-xs font-normal">owes {fmt(m.share - m.paid, k.baseCurrency)}</span></p>
                      <p className="text-xs text-mute">{p.style} · {m.remindersSent} sent</p>
                    </div>
                    <Chip tone={p.tone}>{p.label}</Chip>
                  </li>
                );
              })}
            </ul>
            <button onClick={() => send("Remind whoever hasn't paid")} disabled={busy || owing.length === 0} className="btn btn-dark w-full mt-5">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Draft &amp; send reminders
            </button>
          </div>

          {lastReminder?.messages?.length ? (
            <div className="panel p-6">
              <div className="flex items-center justify-between"><p className="label">Last sent</p><span className="text-xs text-mute">{timeAgo(lastReminder.ts)}</span></div>
              <div className="mt-3 space-y-3">
                {lastReminder.messages.map((m, i) => {
                  const mem = k.members.find((x) => x.name === m.to);
                  return (
                    <div key={i} className="flex gap-2">
                      {mem && <Avatar m={mem} size={28} />}
                      <div className="rounded-2xl rounded-tl-md bg-[#e9f0ff] px-4 py-2.5 text-sm">{m.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Decision({ d, kittyId }: { d: string; kittyId: string }) {
  if (d === "allow") return <Chip tone="ok"><Check size={11} /> Done</Chip>;
  if (d === "needs_quorum") return <Link href={`/k/${kittyId}/approvals`}><Chip tone="lilac"><Vote size={11} /> Vote opened →</Chip></Link>;
  if (d === "queued") return <Chip tone="warn"><Clock size={11} /> Waiting for funds</Chip>;
  return <Chip tone="bad"><X size={11} /> Blocked</Chip>;
}
