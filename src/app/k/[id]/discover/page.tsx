"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Search, ShieldAlert } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Chip, FeatureTag, api } from "@/components/kit";
import { Empty, PageTitle, Stat, StatRow } from "@/components/fin";
import { fmt } from "@/lib/money";

type Suggestion = { id: string; title: string; brand?: string; merchant: string; price: number; originalPrice: number; originalCurrency: string; inStock: boolean; url: string; image?: string; withinCap: boolean };
type Result = { enabled: boolean; message?: string; suggestions: Suggestion[]; quarantined: { title: string; reason: string }[] };
const CATS = ["stay", "transport", "food", "activities", "other"] as const;

export default function DiscoverPage() {
  const { kitty: k, reload } = useKitty();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("other");
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr(null);
    try { setRes(await api<Result>(`/api/kitties/${k.id}/discover?q=${encodeURIComponent(q)}`)); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  async function addPayee(s: Suggestion) {
    setErr(null);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${k.id}/action`, {
        action: { type: "add_vendor", params: { name: s.brand || s.merchant, email, category: cat }, reasoning: `Found on ${s.merchant} via product discovery.` },
        label: `Add payee ${s.brand || s.merchant}`,
      });
      if (r.decision === "block") throw new Error("The injection guard blocked this payee.");
      setAdded((a) => new Set(a).add(s.id)); setAdding(null); setEmail(""); await reload();
    } catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><FeatureTag n="17" label="Product & merchant discovery" /><Chip tone="blue">Channel3 · free tier</Chip></div>
      <PageTitle title="Discover" sub="Research real stays, gear and gifts with live prices in your group's currency before proposing a payment. Every result is screened by the injection guard." />

      <StatRow>
        <Stat label="Results" value={res?.suggestions.length ?? "–"} chip={res ? "found" : "search below"} tone="blue" />
        <Stat label="Under the per-payment cap" value={res ? res.suggestions.filter((s) => s.withinCap).length : "–"} chip={fmt(k.mandate.perPaymentCap, k.baseCurrency)} tone="ok" delay={0.05} />
        <Stat label="Quarantined by the guard" value={res?.quarantined.length ?? "–"} chip="hostile text" tone={res?.quarantined.length ? "bad" : "mute"} delay={0.1} />
        <Stat label="Payees in this kitty" value={k.vendors.length} chip="approved list" tone="mute" delay={0.15} />
      </StatRow>

      <form onSubmit={search} className="panel p-3 flex items-center gap-2 rise max-w-3xl">
        <Search size={18} className="text-mute ml-3" />
        <input className="flex-1 bg-transparent outline-none py-2.5" placeholder="e.g. beach villa lisbon, snorkel gear, group dinner voucher" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} />
        <button className="btn btn-dark !py-2.5" disabled={busy || !q.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Search"}</button>
      </form>

      {err && <p className="rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{err}</p>}

      {res && !res.enabled && (
        <div className="panel p-6 max-w-3xl">
          <Empty icon={<Search size={18} />} title="Discovery is switched off" text={res.message ?? "Add a free Channel3 key to turn it on."} />
          <p className="text-xs text-mute text-center">Add <span className="font-mono">CHANNEL3_API_KEY</span> to <span className="font-mono">.env.local</span> and restart the server.</p>
        </div>
      )}

      {res?.enabled && res.suggestions.length === 0 && <div className="panel p-6 max-w-3xl"><Empty icon={<Search size={18} />} title="No results" text="Try a broader search." /></div>}

      {res?.enabled && res.suggestions.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {res.suggestions.map((s, i) => (
            <article key={s.id} className="panel overflow-hidden rise" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="aspect-[4/3] bg-soft grid place-items-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.image ? <img src={s.image} alt={s.title} className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <Search className="text-mute" />}
              </div>
              <div className="p-5">
                <p className="label">{s.merchant}</p>
                <h3 className="font-semibold mt-1 line-clamp-2">{s.title}</h3>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="num text-2xl font-semibold">{fmt(s.price, k.baseCurrency)}</p>
                    {s.originalCurrency !== k.baseCurrency && <p className="text-xs text-mute">{s.originalPrice} {s.originalCurrency}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Chip tone={s.withinCap ? "ok" : "warn"}>{s.withinCap ? "Under cap" : "Needs a vote"}</Chip>
                    {!s.inStock && <Chip tone="bad">Out of stock</Chip>}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-ghost !py-2 text-sm flex-1"><ExternalLink size={14} /> View</a>
                  {added.has(s.id) ? <span className="btn btn-ghost !py-2 text-sm flex-1 text-[#0e8f40]"><Check size={14} /> Added</span> : <button onClick={() => setAdding(adding === s.id ? null : s.id)} className="btn btn-dark !py-2 text-sm flex-1">Add as payee</button>}
                </div>
                {adding === s.id && (
                  <div className="mt-3 space-y-2 pop">
                    <input className="input !py-2 text-sm" placeholder="Their PayPal email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                    <div className="flex gap-2">
                      <select className="input !py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value as (typeof CATS)[number])}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                      <button className="btn btn-blue !py-2 text-sm" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => addPayee(s)}>Add</button>
                    </div>
                    <p className="text-[11px] text-mute">Not pre-approved: paying them still needs the group&apos;s vote.</p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {res?.enabled && res.quarantined.length > 0 && (
        <div className="panel p-5 max-w-3xl">
          <p className="font-semibold flex items-center gap-2"><ShieldAlert size={16} className="text-bad" /> Removed by the guard</p>
          <ul className="mt-2 text-sm text-ink-2 space-y-1">{res.quarantined.map((x) => <li key={x.title}>“{x.title}”: {x.reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
