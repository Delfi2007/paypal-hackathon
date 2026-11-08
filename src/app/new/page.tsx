"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { FeatureTag } from "@/components/kit";
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
    <main className="min-h-screen w-full p-3 sm:p-5 bg-[#d6d6d8]">
      <div className="relative min-h-[calc(100vh-2.5rem)] rounded-[1.8rem] bg-[#f1efee] overflow-hidden">
        <Image src="/images/coins.webp" alt="" fill priority sizes="100vw" className="object-cover object-[80%_center] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f1efee] via-[#f1efee]/85 to-[#f1efee]/30" />
        <div className="relative px-5 sm:px-12 pt-6 pb-12">
          <SiteNav />
          <div className="mt-12 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
            <div className="rise">
              <FeatureTag n="09" label="Mandate from one sentence" />
              <h1 className="display text-6xl sm:text-8xl font-light mt-6 leading-[0.9]">Describe<br />the trip.</h1>
              <p className="text-lg text-ink-2 mt-5 max-w-md">Write it the way you&apos;d text the group. Kitty drafts the mandate: budget, a cap per payment, the payees you&apos;ve agreed on, and how many votes it takes to go past them.</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={EXAMPLE} rows={5}
                className="glass mt-8 w-full max-w-xl rounded-[1.5rem] p-5 text-base outline-none resize-none focus:ring-4 focus:ring-blue/15" />
              <div className="mt-4 flex items-center gap-3">
                <button onClick={makeDraft} disabled={busy} className="btn btn-black !pl-6 !pr-2 !py-2">
                  {busy && !draft ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Draft the mandate
                  <span className="grid place-items-center size-9 rounded-full bg-white text-ink ml-1"><ArrowRight size={16} /></span>
                </button>
                <span className="text-sm text-mute">Leave it empty to try the Lisbon example</span>
              </div>
              {err && <p className="text-bad mt-3">{err}</p>}
            </div>

            <div className={`glass rounded-[1.8rem] p-6 sm:p-8 min-h-[460px] ${draft ? "pop" : ""}`}>
              {!draft ? (
                <div className="h-full min-h-[400px] grid place-items-center text-center">
                  <div><p className="display text-3xl font-light">Your mandate appears here</p><p className="text-sm text-mute mt-2">Review it, tweak it, everyone signs.</p></div>
                </div>
              ) : (
                <div>
                  <p className="label">Draft mandate · review before signing</p>
                  <input value={draft.name} onChange={(e) => set("name", e.target.value)} className="display text-4xl font-medium w-full bg-transparent outline-none mt-2" />
                  <input value={draft.destination} onChange={(e) => set("destination", e.target.value)} className="text-sm text-mute w-full bg-transparent outline-none" />
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Field label="Base currency">
                      <select value={draft.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value as KittyDraft["baseCurrency"])} className="w-full bg-transparent outline-none">
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Total budget"><Num v={draft.totalBudget} on={(n) => set("totalBudget", n)} /></Field>
                    <Field label="Per-payment cap"><Num v={draft.perPaymentCap} on={(n) => set("perPaymentCap", n)} /></Field>
                    <Field label="Quorum"><Num v={draft.quorum} on={(n) => set("quorum", n)} /></Field>
                  </div>
                  <p className="label mt-6">Travellers</p>
                  <div className="mt-2 space-y-2">
                    {draft.members.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={m.name} onChange={(e) => set("members", draft.members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input !py-2 !bg-white/80" />
                        <select value={m.currency} onChange={(e) => set("members", draft.members.map((x, j) => (j === i ? { ...x, currency: e.target.value as typeof m.currency } : x)))} className="input !w-24 !py-2 !bg-white/80">
                          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <button aria-label="Remove traveller" onClick={() => set("members", draft.members.filter((_, j) => j !== i))} className="btn btn-ghost !p-2.5"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => set("members", [...draft.members, { name: "New friend", currency: draft.baseCurrency }])} className="text-sm font-semibold text-blue flex items-center gap-1"><Plus size={14} /> Add traveller</button>
                  </div>
                  <p className="label mt-6">Payees (tap to toggle pre-approval)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.vendors.map((v, i) => (
                      <button key={i} onClick={() => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, approved: !x.approved } : x)))}
                        className={`text-sm rounded-full px-3 py-1.5 border transition ${v.approved ? "bg-ok-soft border-ok/30 text-[#0e8f40]" : "bg-white/70 border-line text-mute"}`}>
                        {v.name} · {v.category} {v.approved ? "✓" : "· needs vote"}
                      </button>
                    ))}
                  </div>
                  <button onClick={create} disabled={busy} className="btn btn-blue w-full mt-8 !py-3.5">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null} Everyone signs, open the kitty <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl bg-white/70 border border-white px-4 py-3">
      <span className="label block">{label}</span>
      <div className="mt-1 num text-2xl font-semibold">{children}</div>
    </label>
  );
}
function Num({ v, on }: { v: number; on: (n: number) => void }) {
  return <input type="number" value={v} onChange={(e) => on(Number(e.target.value))} className="w-full bg-transparent outline-none" />;
}
