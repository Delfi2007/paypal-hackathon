"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, Loader2, Plus, Share2, Sparkles, Trash2, UserPlus } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { FeatureTag, api } from "@/components/kit";
import { useMe } from "@/components/session";
import { fmt } from "@/lib/money";
import type { KittyDraft } from "@/lib/ai";

const EXAMPLE =
  "Lisbon in March with 4 friends. Around $4,000 total. We already agreed on the Alfama apartment and a surf lesson. Nothing over $1,200 without asking, and 3 of us need to agree.";
const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"] as const;
const CATS = ["stay", "transport", "food", "activities", "other"] as const;

export default function NewKitty() {
  const { user } = useMe(true);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<KittyDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function makeDraft() {
    setBusy(true); setErr(null);
    try {
      const d = await api<KittyDraft>("/api/kitties/draft", { prompt: prompt || EXAMPLE });
      if (!prompt) setPrompt(EXAMPLE);
      setDraft(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function create() {
    if (!draft) return;
    setBusy(true); setErr(null);
    try { setCreated(await api<{ id: string; inviteCode: string }>("/api/kitties", { draft })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const set = <K extends keyof KittyDraft>(key: K, v: KittyDraft[K]) => setDraft((d) => (d ? { ...d, [key]: v } : d));
  const link = created && typeof location !== "undefined" ? `${location.origin}/join/${created.inviteCode}` : "";
  const friends = draft ? Math.max(2, draft.members.length) : 0;

  return (
    <main className="min-h-screen w-full p-3 sm:p-5 bg-[#d6d6d8]">
      <div className="relative min-h-[calc(100vh-2.5rem)] rounded-[1.8rem] bg-[#f1efee] overflow-hidden">
        <Image src="/images/coins.webp" alt="" fill priority sizes="100vw" className="object-cover object-[80%_center] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f1efee] via-[#f1efee]/85 to-[#f1efee]/30" />
        <div className="relative px-5 sm:px-12 pt-6 pb-12">
          <SiteNav />
          {created ? (
            <div className="mt-16 max-w-xl mx-auto glass rounded-[2rem] p-8 sm:p-10 pop text-center">
              <span className="mx-auto grid place-items-center size-14 rounded-2xl bg-gradient-to-br from-ok to-[#2fd69a] text-white"><Check size={26} /></span>
              <h1 className="display text-4xl sm:text-5xl font-semibold mt-5">Your kitty is live</h1>
              <p className="text-ink-2 mt-2">You signed the mandate. Now send this link to your friends. They create an account, join and sign too.</p>
              <div className="mt-6 flex gap-2">
                <input readOnly value={link} onFocus={(e) => e.target.select()} className="input !py-3 text-sm" />
                <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn btn-dark !px-4">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(`Join our "${draft?.name}" kitty: ${link}`)}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm"><Share2 size={15} /> WhatsApp</a>
                <a href={`mailto:?subject=${encodeURIComponent(`Join ${draft?.name} on Kitty`)}&body=${encodeURIComponent(link)}`} className="btn btn-ghost text-sm"><UserPlus size={15} /> Email</a>
              </div>
              <Link href={`/k/${created.id}`} className="btn btn-blue w-full mt-6 !py-3.5">Open the kitty <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="mt-12 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
              <div className="rise">
                <FeatureTag n="09" label="Mandate from one sentence" />
                <h1 className="display text-6xl sm:text-8xl font-light mt-6 leading-[0.9]">Describe<br />the trip.</h1>
                <p className="text-lg text-ink-2 mt-5 max-w-md">Write it the way you&apos;d text the group. Kitty drafts the rules. Then you invite your real friends with a link and everyone signs.</p>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={EXAMPLE} rows={5}
                  className="glass mt-8 w-full max-w-xl rounded-[1.5rem] p-5 text-base outline-none resize-none focus:ring-4 focus:ring-blue/15" />
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={makeDraft} disabled={busy || !user} className="btn btn-black !pl-6 !pr-2 !py-2">
                    {busy && !draft ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Draft the mandate
                    <span className="grid place-items-center size-9 rounded-full bg-white text-ink ml-1"><ArrowRight size={16} /></span>
                  </button>
                  <span className="text-sm text-mute">Leave it empty to try the Lisbon example</span>
                </div>
                {err && !draft && <p className="text-bad mt-3">{err}</p>}
              </div>

              <div className={`glass rounded-[1.8rem] p-6 sm:p-8 min-h-[460px] ${draft ? "pop" : ""}`}>
                {!draft ? (
                  <div className="h-full min-h-[400px] grid place-items-center text-center">
                    <div><p className="display text-3xl font-light">Your mandate appears here</p><p className="text-sm text-mute mt-2">Review it, tweak it, then invite your friends.</p></div>
                  </div>
                ) : (
                  <div>
                    <p className="label">Draft mandate · review before creating</p>
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
                      <Field label="Votes to override"><Num v={draft.quorum} on={(n) => set("quorum", n)} /></Field>
                    </div>

                    <p className="label mt-6">Friends you&apos;ll invite</p>
                    <div className="mt-2 rounded-2xl bg-white/70 border border-white px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button onClick={() => set("members", draft.members.slice(0, Math.max(2, draft.members.length - 1)))} className="btn btn-ghost !p-2" aria-label="Fewer friends"><Trash2 size={13} /></button>
                        <span className="num text-2xl font-semibold">{friends}</span>
                        <button onClick={() => set("members", [...draft.members, { name: "Friend", currency: draft.baseCurrency }])} className="btn btn-ghost !p-2" aria-label="More friends"><Plus size={13} /></button>
                        <span className="text-sm text-ink-2">friends incl. you</span>
                      </div>
                      <p className="text-sm text-ink-2">Each pays <b className="num">{fmt(draft.totalBudget / friends, draft.baseCurrency)}</b></p>
                    </div>

                    <p className="label mt-6">Payees (who the pool can pay)</p>
                    <div className="mt-2 space-y-2">
                      {draft.vendors.map((v, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.1fr_1.3fr_auto_auto] gap-2 items-center">
                          <input value={v.name} onChange={(e) => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input !py-2 !bg-white/80" aria-label="Payee name" />
                          <input value={v.email ?? ""} onChange={(e) => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} placeholder="Their PayPal email" className="input !py-2 !bg-white/80 col-span-2 sm:col-span-1 order-last sm:order-none" aria-label="Payee PayPal email" />
                          <select value={v.category} onChange={(e) => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, category: e.target.value as typeof v.category } : x)))} className="input !w-auto !py-2 !bg-white/80">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                          <button onClick={() => set("vendors", draft.vendors.map((x, j) => (j === i ? { ...x, approved: !x.approved } : x)))} className={`rounded-full px-3 py-2 text-xs font-semibold border transition ${v.approved ? "bg-ok-soft border-ok/30 text-[#0e8f40]" : "bg-white/70 border-line text-mute"}`}>{v.approved ? "✓ pre-approved" : "needs vote"}</button>
                        </div>
                      ))}
                      <button onClick={() => set("vendors", [...draft.vendors, { name: "New payee", email: "", category: "other", approved: false }])} className="text-sm font-semibold text-blue flex items-center gap-1"><Plus size={14} /> Add payee</button>
                    </div>

                    {err && <p className="mt-4 rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{err}</p>}
                    <button onClick={create} disabled={busy} className="btn btn-blue w-full mt-7 !py-3.5">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : null} Create the kitty and sign <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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
