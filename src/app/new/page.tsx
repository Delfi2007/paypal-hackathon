"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import type { KittyDraft } from "@/lib/ai";

const EXAMPLE =
  "Lisbon in March with Priya, Tom, Sofia and me. Around $4,000 total. We already agreed on the Alfama apartment and a surf lesson. Tom pays in GBP and Sofia in EUR. Nothing over $1,200 without asking, and 3 of us need to agree.";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"] as const;

export default function NewKitty() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<KittyDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function makeDraft() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/kitties/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt || EXAMPLE }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (!prompt) setPrompt(EXAMPLE);
      setDraft(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function create() {
    if (!draft) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/kitties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push(`/k/${j.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const set = <K extends keyof KittyDraft>(key: K, v: KittyDraft[K]) => setDraft((d) => (d ? { ...d, [key]: v } : d));

  return (
    <main className="min-h-screen w-full">
      <header className="w-full px-6 sm:px-10 lg:px-16 pt-6"><Nav /></header>
      <section className="w-full px-6 sm:px-10 lg:px-16 py-14 grid gap-12 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p className="eyebrow flex items-center gap-3"><span className="rule" /> New kitty</p>
          <h1 className="display text-6xl sm:text-7xl mt-4">Describe the trip.<br /><em className="text-aegean">We&apos;ll draft the rules.</em></h1>
          <p className="mt-6 text-ink-soft max-w-lg">
            Write it the way you&apos;d text the group. Kitty drafts a mandate from it: budget, a cap per payment, payees
            you&apos;ve agreed on, and how many votes it takes to go past them. Everyone signs before money moves.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXAMPLE}
            rows={6}
            className="mt-8 w-full rounded-3xl border border-ink/15 bg-paper p-6 text-lg outline-none focus:border-aegean resize-none"
          />
          <button onClick={makeDraft} disabled={busy} className="pill pill-dark mt-4">
            {busy && !draft ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Draft the mandate
          </button>
          {err && <p className="text-bloom mt-3">{err}</p>}
        </div>

        <div className={`rounded-[2rem] border border-ink/10 p-8 sm:p-10 ${draft ? "bg-paper" : "bg-sand/40"} min-h-[480px]`}>
          {!draft ? (
            <div className="h-full grid place-items-center text-center text-ink-soft">
              <div>
                <p className="display text-4xl">Your mandate appears here</p>
                <p className="mt-2 text-sm">Leave the box empty to try the Lisbon example.</p>
              </div>
            </div>
          ) : (
            <div className="rise">
              <p className="eyebrow text-center">Draft mandate · review before signing</p>
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} className="display text-5xl text-center w-full bg-transparent outline-none mt-3" />
              <input value={draft.destination} onChange={(e) => set("destination", e.target.value)} className="text-center w-full bg-transparent outline-none eyebrow mt-2" />
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <Field label="Base currency">
                  <select value={draft.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value as KittyDraft["baseCurrency"])} className="w-full bg-transparent outline-none">
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Total budget"><Num v={draft.totalBudget} on={(n) => set("totalBudget", n)} /></Field>
                <Field label="Per-payment cap"><Num v={draft.perPaymentCap} on={(n) => set("perPaymentCap", n)} /></Field>
                <Field label="Quorum (votes to override)"><Num v={draft.quorum} on={(n) => set("quorum", n)} /></Field>
              </div>

              <p className="eyebrow mt-8">Travellers</p>
              <div className="mt-3 space-y-2">
                {draft.members.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={m.name} onChange={(e) => set("members", draft.members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="flex-1 rounded-full border border-ink/15 px-4 py-2 bg-cream/40 outline-none" />
                    <select value={m.currency} onChange={(e) => set("members", draft.members.map((x, j) => (j === i ? { ...x, currency: e.target.value as typeof m.currency } : x)))} className="rounded-full border border-ink/15 px-3 bg-cream/40">
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button onClick={() => set("members", draft.members.filter((_, j) => j !== i))} className="pill pill-line !p-2.5"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => set("members", [...draft.members, { name: "New friend", currency: draft.baseCurrency }])} className="text-sm link-under flex items-center gap-1"><Plus size={13} /> Add traveller</button>
              </div>

              <p className="eyebrow mt-8">Payees</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.vendors.map((v, i) => (
                  <button key={i} onClick={() => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, approved: !x.approved } : x)))}
                    className={`text-sm rounded-full px-3 py-1.5 border ${v.approved ? "border-olive/40 text-olive bg-olive/5" : "border-ink/15 text-mute"}`}>
                    {v.name} · {v.category} {v.approved ? "✓ pre-approved" : "· needs vote"}
                  </button>
                ))}
              </div>

              <button onClick={create} disabled={busy} className="pill pill-dark mt-10 w-full justify-center">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} Everyone signs. Open the kitty <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl border border-ink/10 px-4 py-3 bg-cream/40">
      <span className="eyebrow block">{label}</span>
      <div className="mt-1 display text-2xl">{children}</div>
    </label>
  );
}

function Num({ v, on }: { v: number; on: (n: number) => void }) {
  return <input type="number" value={v} onChange={(e) => on(Number(e.target.value))} className="w-full bg-transparent outline-none" />;
}
