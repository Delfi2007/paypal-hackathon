"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowRight, Camera, Check, Clock, Loader2, Sparkles, Vote, X } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, FeatureTag, api } from "@/components/kit";
import { fmt } from "@/lib/money";
import type { Bill } from "@/lib/types";

type Res = { bill: Bill; vendorId: string; totalBase: number; note?: string };

export default function SplitPage() {
  const { kitty: k, actor, reload } = useKitty();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(k.bills[0] ? { bill: k.bills[0], vendorId: "", totalBase: Object.values(k.bills[0].splits).reduce((a, b) => a + b, 0) } : null);
  const [paid, setPaid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cur = k.baseCurrency;

  async function read() {
    setBusy(true); setErr(null); setPaid(null);
    try {
      const f = new FormData();
      if (file) f.append("image", file);
      f.append("hint", hint);
      setRes(await api<Res>(`/api/kitties/${k.id}/bill`, undefined, f));
      reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function payFromKitty() {
    if (!res?.vendorId) return;
    setBusy(true);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${k.id}/action`, {
        actorId: actor.id,
        label: `Pay the ${res.bill.merchant} bill from the kitty`,
        action: { type: "pay_vendor", params: { vendorId: res.vendorId, amount: res.totalBase, memo: `${res.bill.merchant} receipt` }, reasoning: `Itemised receipt read by Kitty; ${fmt(res.totalBase, cur)} split across ${k.members.length}.` },
      });
      setPaid(r.decision);
      reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const maxSplit = res ? Math.max(...Object.values(res.bill.splits), 1) : 1;

  return (
    <div className="space-y-8">
      <FeatureTag n="06" label="Bill photo → itemised split" />

      {/* Prime-style glass hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-[#f1efee] min-h-[380px] rise">
        <Image src="/images/coins.webp" alt="" fill priority sizes="100vw" className="object-cover object-right opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f1efee] via-[#f1efee]/80 to-transparent" />
        <div className="relative p-7 sm:p-10 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 items-end min-h-[380px]">
          <div>
            <p className="label">Vision split</p>
            <h1 className="display text-5xl sm:text-7xl font-light mt-2 leading-[0.92]">Snap it.<br />Split it.</h1>
            <p className="text-ink-2 mt-4 max-w-sm">Kitty reads every line of the receipt and splits it by who had what. Tax and tip are shared in proportion.</p>
          </div>
          <div className="glass rounded-[1.6rem] p-5">
            <button onClick={() => input.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-ink/15 hover:border-blue bg-white/50 p-4 flex items-center gap-3 text-sm text-ink-2 transition">
              {preview ? <img src={preview} alt="Receipt preview" className="size-14 rounded-xl object-cover" /> : <span className="grid place-items-center size-14 rounded-xl bg-white"><Camera size={20} /></span>}
              <span className="text-left">{file ? file.name : <>Upload a receipt photo<br /><span className="text-mute">or leave empty to try a sample</span></>}</span>
            </button>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} />
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Who had what? e.g. Delfi skipped the wine" className="input mt-3 text-sm !bg-white/80" />
            <button onClick={read} disabled={busy} className="btn btn-black w-full mt-3">
              {busy && !paid ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Read &amp; split <ArrowRight size={15} />
            </button>
            {err && <p className="text-bad text-sm mt-2">{err}</p>}
          </div>
        </div>
      </section>

      {res && (
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
          <div className="panel p-6 sm:p-8 rise">
            <div className="flex items-start justify-between gap-3">
              <div><p className="label">Receipt</p><h2 className="display text-3xl font-medium mt-1">{res.bill.merchant}</h2></div>
              <span className="num text-2xl font-semibold">{fmt(res.bill.total, res.bill.currency)}</span>
            </div>
            {res.note && <p className="text-xs text-mute mt-1">{res.note}</p>}
            <ul className="mt-5 divide-y divide-dashed divide-line text-sm">
              {res.bill.items.map((it, i) => {
                const who = it.assignedTo.length && it.assignedTo.length < k.members.length ? it.assignedTo.map((id) => k.members.find((m) => m.id === id)).filter(Boolean) : null;
                return (
                  <li key={i} className="py-3 flex items-center gap-3 rise" style={{ animationDelay: `${i * .05}s` }}>
                    <span className="flex-1">{it.name}</span>
                    <span className="flex -space-x-1.5">{who ? who.map((m) => <Avatar key={m!.id} m={m!} size={22} ring />) : <span className="text-xs text-mute">everyone</span>}</span>
                    <span className="num w-20 text-right font-medium">{fmt(it.price, res.bill.currency)}</span>
                  </li>
                );
              })}
              {(res.bill.tax > 0 || res.bill.tip > 0) && (
                <li className="py-3 flex justify-between text-mute"><span>Tax & tip (shared in proportion)</span><span className="num">{fmt(res.bill.tax + res.bill.tip, res.bill.currency)}</span></li>
              )}
            </ul>
          </div>

          <div className="panel p-6 sm:p-8 rise" style={{ animationDelay: ".08s" }}>
            <p className="label">Who owes what</p>
            <ul className="mt-4 space-y-3">
              {k.members.map((m, i) => {
                const v = res.bill.splits[m.id] ?? 0;
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar m={m} size={34} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm"><span className="font-medium">{m.name}</span><span className="num font-semibold">{fmt(v, cur)}</span></div>
                      <div className="mt-1.5 h-2 rounded-full bg-soft overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#b07bff] to-blue transition-all duration-700" style={{ width: `${(v / maxSplit) * 100}%`, transitionDelay: `${i * 80}ms` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {res.vendorId ? (
              <button onClick={payFromKitty} disabled={busy || !!paid} className="btn btn-blue w-full mt-6">
                {paid === "allow" ? <><Check size={16} /> Paid from the kitty</> : paid === "needs_quorum" ? <><Vote size={16} /> Vote opened: see Approvals</> : paid === "queued" ? <><Clock size={16} /> Queued until funded</> : paid ? <><X size={16} /> Blocked by policy</> : <>Pay {fmt(res.totalBase, cur)} from the kitty <ArrowRight size={15} /></>}
              </button>
            ) : <p className="text-xs text-mute mt-6">Read a receipt to pay it from the kitty.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
