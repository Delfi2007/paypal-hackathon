"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronsRight, Clock, Delete, ShieldAlert, Vote, X } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { FeatureTag, PayPalBadge, api } from "@/components/kit";
import { evaluate, poolBalance } from "@/lib/policy";
import { fmt } from "@/lib/money";

type Op = "+" | "−" | "×" | "÷";
type Result = { decision: string; vendor: string; amount: number };

function calc(expr: string): number {
  // left-to-right evaluation of "12+3×2" style input (as on a phone keypad)
  const tokens = expr.match(/(\d+\.?\d*|[+−×÷])/g) ?? [];
  let acc = 0, op: Op = "+";
  for (const t of tokens) {
    if ("+−×÷".includes(t)) { op = t as Op; continue; }
    const n = Number(t);
    acc = op === "+" ? acc + n : op === "−" ? acc - n : op === "×" ? acc * n : n === 0 ? acc : acc / n;
  }
  return Math.round(acc * 100) / 100;
}

export default function SendPage() {
  const { kitty: k, actor, reload } = useKitty();
  const [vendorId, setVendorId] = useState(k.vendors[0]?.id ?? "");
  const [expr, setExpr] = useState("");
  const [memo, setMemo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = k.baseCurrency;
  const amount = calc(expr);
  const hasOp = /[+−×÷]/.test(expr);
  const vendor = k.vendors.find((v) => v.id === vendorId);

  const preview = useMemo(
    () => (amount > 0 ? evaluate(k, { type: "pay_vendor", params: { vendorId, amount }, reasoning: "" }) : null),
    [k, vendorId, amount],
  );

  const press = (key: string) => {
    setExpr((e) => {
      if (key === "⌫") return e.slice(0, -1);
      if ("+−×÷".includes(key)) return e === "" ? e : /[+−×÷]$/.test(e) ? e.slice(0, -1) + key : e + key;
      if (key === "." && /\.\d*$/.test(e)) return e;
      if (/\.\d{2}$/.test(e)) return e;
      return (e + key).slice(0, 18);
    });
  };

  async function confirm() {
    if (!vendor || amount <= 0) return;
    setBusy(true);
    try {
      const r = await api<{ decision: string }>(`/api/kitties/${k.id}/action`, {
        actorId: actor.id,
        label: `Pay ${vendor.name} ${fmt(amount, cur)} (keypad)`,
        action: { type: "pay_vendor", params: { vendorId, amount, memo: memo || `${k.name}: ${vendor.name}` }, reasoning: memo || `${actor.name} paid ${vendor.name} from the keypad.` },
      });
      setResult({ decision: r.decision, vendor: vendor.name, amount });
      reload();
    } catch (e) {
      setResult({ decision: "error:" + (e as Error).message, vendor: vendor.name, amount });
    } finally { setBusy(false); }
  }

  if (result) return <ResultScreen r={result} cur={cur} kittyId={k.id} onDone={() => { setResult(null); setExpr(""); setMemo(""); }} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <FeatureTag n="10" label="Swipe-to-pay keypad" />
        <FeatureTag n="05" label="Payouts when funded" />
        <FeatureTag n="03" label="Policy engine" />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px] items-start">
        {/* recipients */}
        <section className="rise">
          <p className="label">Recipients</p>
          <h1 className="display text-4xl sm:text-5xl font-medium mt-1">Pay a vendor</h1>
          <p className="text-ink-2 mt-2 max-w-lg">Choose who to pay, type the amount and swipe. The policy engine checks it against the mandate before PayPal Payouts sends anything.</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
            {k.vendors.map((v, i) => {
              const approved = k.mandate.approvedPayees.includes(v.id);
              const active = v.id === vendorId;
              return (
                <button key={v.id} onClick={() => setVendorId(v.id)}
                  className={`text-left rounded-[1.4rem] p-4 border transition-all ${active ? "bg-ink text-white border-ink shadow-xl shadow-ink/25 -translate-y-1" : "bg-white border-line hover:border-ink/30"}`}>
                  <span className="grid place-items-center size-12 rounded-full text-ink font-bold text-lg" style={{ background: ["#f4f15a", "#3cf0c6", "#9cc9ff", "#ffb8c6", "#d9ccff"][i % 5] }}>{v.name.slice(0, 1)}</span>
                  <p className="font-semibold mt-3 leading-tight">{v.name}</p>
                  <p className={`text-xs mt-1 capitalize ${active ? "text-white/60" : "text-mute"}`}>{v.category} · {approved ? "pre-approved" : "needs vote"}</p>
                </button>
              );
            })}
            <AddPayee kittyId={k.id} onAdded={async (id) => { await reload(); setVendorId(id); }} />
          </div>
          <div className="mt-6 panel p-5 grid sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Pool balance" value={fmt(poolBalance(k), cur)} />
            <Stat label="Per-payment cap" value={fmt(k.mandate.perPaymentCap, cur)} />
            <Stat label="Budget left" value={fmt(k.mandate.totalBudget - k.spent, cur)} />
          </div>
        </section>

        {/* phone keypad */}
        <section className="mx-auto w-full max-w-[440px] rounded-[2.6rem] bg-night p-3 shadow-[0_40px_80px_-30px_rgba(11,13,20,.6)] rise" style={{ animationDelay: ".1s" }}>
          <div className="rounded-[2.1rem] bg-white px-5 pt-5 pb-6">
            <div className="flex justify-center gap-6 text-sm font-semibold">
              <span>Send</span>
              <Link href={`/k/${k.id}`} className="text-mute">Request</Link>
            </div>
            <p className="text-center text-xs text-mute mt-1">{vendor?.name ?? "Choose a vendor"} · {cur}</p>

            <div className="h-36 flex flex-col items-center justify-center">
              <p className={`num font-semibold transition-colors ${expr.length > 9 ? "text-4xl" : "text-5xl"} ${preview?.decision === "allow" ? "text-ink" : preview ? "text-[#6a4bd8]" : "text-ink/25"}`}>
                {expr ? expr.replace(/([+−×÷])/g, " $1 ") : fmt(0, cur)}
              </p>
              {hasOp && amount > 0 && <p className="num mt-1 rounded-full bg-soft px-3 py-0.5 text-sm text-ink-2 pop">= {fmt(amount, cur)}</p>}
              {!hasOp && <p className="text-xs text-mute mt-1">Available {fmt(poolBalance(k), cur)}</p>}
            </div>

            {preview && (
              <div className={`rounded-2xl px-3 py-2 text-xs flex items-center gap-2 pop ${preview.decision === "allow" ? "bg-ok-soft text-[#0e8f40]" : preview.decision === "block" ? "bg-warn-soft text-[#a86d00]" : "bg-[#efe9ff] text-[#6a4bd8]"}`}>
                {preview.decision === "allow" ? <Check size={14} /> : preview.decision === "block" ? <Clock size={14} /> : <Vote size={14} />}
                <span className="truncate">{preview.decision === "allow" ? "Within mandate: pays instantly" : preview.decision === "block" && preview.checks.every((c) => c.pass || c.rule === "Pool has funds") ? "Pool is short: will queue until funded" : preview.summary}</span>
              </div>
            )}

            <div className="flex justify-around mt-4 text-xl text-ink-2">
              {(["+", "−", "×", "÷"] as const).map((o) => (
                <button key={o} onClick={() => press(o)} className="size-10 rounded-full hover:bg-soft">{o}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((d) => (
                <button key={d} onClick={() => press(d)} className="h-14 rounded-2xl bg-soft/70 text-2xl num font-medium hover:bg-soft active:scale-95 transition">
                  {d === "⌫" ? <Delete className="mx-auto" size={22} /> : d}
                </button>
              ))}
            </div>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Add a note (optional)" className="input mt-3 text-sm" />
            <SwipeConfirm disabled={amount <= 0 || !vendor || busy} busy={busy} onConfirm={confirm} />
          </div>
        </section>
      </div>
    </div>
  );
}

function AddPayee({ kittyId, onAdded }: { kittyId: string; onAdded: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", category: "other" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api(`/api/kitties/${kittyId}/action`, { label: `Add payee ${f.name}`, action: { type: "add_vendor", params: f, reasoning: `${f.name} is a new payee (${f.category}).` } });
      const fresh = await api<{ kitty: { vendors: { id: string; name: string }[] } }>(`/api/kitties/${kittyId}`);
      const v = fresh.kitty.vendors.find((x) => x.name === f.name);
      setOpen(false); setF({ name: "", email: "", category: "other" });
      if (v) await onAdded(v.id);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  }
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-[1.4rem] p-4 border-2 border-dashed border-line text-mute hover:text-ink hover:border-ink/30 grid place-items-center min-h-[120px] text-sm">
        + Add a payee
      </button>
    );
  return (
    <form onSubmit={add} className="col-span-2 sm:col-span-3 2xl:col-span-2 rounded-[1.4rem] p-4 border border-line bg-white space-y-2 pop">
      <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Who gets paid? e.g. Hotel Aurora" className="input !py-2" />
      <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Their PayPal email" className="input !py-2" />
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input !py-2">{["stay", "transport", "food", "activities", "other"].map((c) => <option key={c}>{c}</option>)}</select>
      {err && <p className="text-bad text-xs">{err}</p>}
      <div className="flex gap-2"><button disabled={busy} className="btn btn-dark !py-2 text-sm flex-1">Add payee</button><button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !py-2 text-sm">Cancel</button></div>
      <p className="text-[11px] text-mute">New payees are not pre-approved, so the first payment to them needs a group vote.</p>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (<div><p className="label">{label}</p><p className="num text-xl font-semibold mt-1">{value}</p></div>);
}

function SwipeConfirm({ onConfirm, disabled, busy }: { onConfirm: () => void; disabled: boolean; busy: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const drag = useRef<{ start: number; max: number } | null>(null);

  const down = (e: React.PointerEvent) => {
    if (disabled || !track.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { start: e.clientX - x, max: track.current.clientWidth - 56 };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setX(Math.max(0, Math.min(drag.current.max, e.clientX - drag.current.start)));
  };
  const up = () => {
    if (!drag.current) return;
    const done = x > drag.current.max * 0.85;
    drag.current = null;
    if (done) { setX(9999); onConfirm(); } else setX(0);
  };

  return (
    <div ref={track} className={`relative mt-3 h-14 rounded-full overflow-hidden select-none ${disabled ? "bg-soft" : "bg-ink"}`}>
      <div className="absolute inset-y-0 left-0 bg-ok/90 transition-[width] duration-75" style={{ width: Math.min(x + 56, 9999) }} />
      <p className={`absolute inset-0 grid place-items-center text-sm font-semibold ${disabled ? "text-mute" : "text-white/80"}`}>
        {busy ? "Checking policy…" : "Swipe right to confirm"}
      </p>
      <button
        aria-label="Swipe to confirm (or press Enter)"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === "Enter" && !disabled) onConfirm(); }}
        disabled={disabled}
        className="absolute top-1 left-1 size-12 rounded-full bg-white grid place-items-center shadow-lg touch-none cursor-grab active:cursor-grabbing"
        style={{ transform: `translateX(${Math.min(x, (track.current?.clientWidth ?? 300) - 56)}px)`, transition: drag.current ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)" }}
      >
        <ChevronsRight size={20} className="text-ink" />
      </button>
    </div>
  );
}

function ResultScreen({ r, cur, kittyId, onDone }: { r: Result; cur: string; kittyId: string; onDone: () => void }) {
  const err = r.decision.startsWith("error:");
  const conf = err
    ? { bg: "bg-bad", icon: <X size={56} />, title: "Something went wrong", sub: r.decision.slice(6) }
    : r.decision === "allow"
      ? { bg: "bg-[#22d35a]", icon: <svg viewBox="0 0 52 52" className="size-20"><path className="checkdraw" d="M14 27l8 8 16-18" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>, title: `${fmt(r.amount, cur as never)}`, sub: `Sent to ${r.vendor} with PayPal Payouts` }
      : r.decision === "queued"
        ? { bg: "bg-warn", icon: <Clock size={56} />, title: "Queued", sub: `${fmt(r.amount, cur as never)} to ${r.vendor} goes out as soon as the pool has the money` }
        : r.decision === "needs_quorum"
          ? { bg: "bg-[#7b5cff]", icon: <Vote size={56} />, title: "Vote opened", sub: `${fmt(r.amount, cur as never)} to ${r.vendor} is outside the mandate. The group needs to approve.` }
          : { bg: "bg-ink", icon: <ShieldAlert size={56} />, title: "Blocked by policy", sub: "This payment breaks a hard rule of the mandate." };
  return (
    <div className={`min-h-[70vh] rounded-[2rem] ${conf.bg} text-white grid place-items-center text-center p-8 pop`}>
      <div>
        <div className="mx-auto w-fit">{conf.icon}</div>
        <p className="num text-5xl sm:text-6xl font-semibold mt-4">{conf.title}</p>
        <p className="mt-3 text-white/85 max-w-md mx-auto">{conf.sub}</p>
        {!err && r.decision === "allow" && <div className="mt-4"><PayPalBadge what="Payouts" dark /></div>}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button onClick={onDone} className="btn bg-white text-ink">New payment</button>
          {r.decision === "needs_quorum" && <Link href={`/k/${kittyId}/approvals`} className="btn glass-dark text-white">Go to approvals <ArrowRight size={15} /></Link>}
          <Link href={`/k/${kittyId}/activity`} className="btn glass-dark text-white">See the audit trail</Link>
        </div>
      </div>
    </div>
  );
}
