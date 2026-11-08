"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import type { Kitty, ModeStatus } from "@/lib/types";
import { fmt } from "@/lib/money";
import { Avatar } from "./kit";

type PayPalButtons = (opts: {
  style?: Record<string, string>;
  createOrder: () => Promise<string>;
  onApprove: (d: { orderID: string }) => Promise<void>;
  onError: (e: unknown) => void;
}) => { render: (el: HTMLElement) => Promise<void> };
declare global {
  interface Window { paypal?: { Buttons: PayPalButtons } }
}

export function PayShare({ kittyId, memberId }: { kittyId: string; memberId: string }) {
  const [k, setK] = useState<Kitty | null>(null);
  const [mode, setMode] = useState<ModeStatus | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "authorising" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const btnRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch(`/api/kitties/${kittyId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => { setK(d.kitty); setMode(d.mode); });
  }, [kittyId]);

  const m = k?.members.find((x) => x.id === memberId);
  const owedBase = m ? Math.max(0, m.share - m.paid) : 0;

  useEffect(() => {
    if (!k || !m || owedBase <= 0) return;
    fetch(`/api/fx?from=${k.baseCurrency}&to=${m.currency}&amount=${owedBase}`).then((r) => r.json()).then((q) => setQuote(q.amount));
  }, [k, m, owedBase]);

  async function createOrder() {
    const r = await fetch("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kittyId, memberId }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j.id as string;
  }

  async function capture(orderId: string) {
    setState("authorising");
    const started = Date.now();
    const r = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kittyId, memberId }) });
    const j = await r.json();
    await new Promise((res) => setTimeout(res, Math.max(0, 1400 - (Date.now() - started)))); // let the animation breathe
    if (!r.ok) { setState("error"); setMsg(j.error); return; }
    setPaidAmount(fmt(j.amount, j.currency));
    setState("done");
    fetch(`/api/kitties/${kittyId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setK(d.kitty)).catch(() => {});
  }

  // Real PayPal Smart Buttons when sandbox credentials are configured
  useEffect(() => {
    if (!mode?.paypalClientId || !m || owedBase <= 0 || state !== "idle") return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.paypal || !btnRef.current) return;
      btnRef.current.innerHTML = "";
      window.paypal.Buttons({
        style: { layout: "vertical", shape: "pill", color: "blue", label: "pay" },
        createOrder,
        onApprove: async (d) => capture(d.orderID),
        onError: (e) => { setState("error"); setMsg(String((e as Error)?.message ?? e)); },
      }).render(btnRef.current);
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pp="${m.currency}"]`);
    if (existing) { if (window.paypal) render(); else existing.addEventListener("load", render); }
    else {
      document.querySelectorAll("script[data-pp]").forEach((s) => s.remove());
      delete window.paypal;
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${mode.paypalClientId}&currency=${m.currency}&intent=capture&components=buttons`;
      s.dataset.pp = m.currency; s.onload = render;
      document.body.appendChild(s);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode?.paypalClientId, m?.id, m?.currency, state, owedBase]);

  const onMove = (e: React.PointerEvent) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -14, y: ((e.clientX - r.left) / r.width - 0.5) * 18 });
  };

  if (!k || !m) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-blue" /></div>;
  const done = state === "done" || owedBase <= 0;
  const local = quote !== null ? fmt(quote, m.currency) : "…";
  const step = done ? 3 : state === "authorising" ? 3 : 2;

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* colour-block backdrop */}
      <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[52%_48%] grid-rows-[45%_55%] lg:grid-rows-[38%_62%]">
        <div className="bg-[#ffdb8a] row-span-2" />
        <div className="relative bg-[#ff9eb1] overflow-hidden hidden lg:block">
          <Image src="/images/leaves.webp" alt="" fill priority sizes="50vw" className="object-cover mix-blend-luminosity opacity-60" />
        </div>
        <div className="bg-blue hidden lg:block" />
      </div>
      <div className="absolute -bottom-40 left-[22%] size-[340px] rounded-full bg-night hidden lg:block" />
      <div className="absolute right-[8%] top-[32%] size-12 rounded-full bg-gradient-to-br from-[#ffd9a8] to-[#c47a3b] shadow-xl floaty hidden lg:block" />

      <div className="relative z-10 px-5 sm:px-10 lg:px-[8%] py-8">
        <Link href={`/k/${k.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><ArrowLeft size={16} /> {k.name}</Link>
        <h1 className="display text-5xl sm:text-7xl font-semibold text-ink mt-8 lg:mt-12 rise">Your share</h1>

        <div className="mt-8 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-w-[1040px] shadow-[0_40px_80px_-30px_rgba(20,26,77,.45)] rise" style={{ animationDelay: ".1s" }}>
          {/* left: summary */}
          <div className="bg-white p-7 sm:p-10">
            <div className="flex items-center gap-3"><Avatar m={m} size={40} /><h2 className="display text-3xl font-semibold">Payment</h2></div>
            <p className="text-sm text-blue mt-3">{k.destination} · {m.name}&apos;s share · due {new Date(k.mandate.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
            <dl className="mt-10 space-y-5 text-[0.95rem]">
              <div className="flex justify-between"><dt className="text-ink-2">Share</dt><dd className="num font-semibold">{fmt(m.share, k.baseCurrency)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Already paid</dt><dd className="num font-semibold">{fmt(m.paid, k.baseCurrency)}</dd></div>
              {m.currency !== k.baseCurrency && (
                <div className="flex justify-between"><dt className="text-ink-2">Rate (ECB, live)</dt><dd className="num font-semibold">{quote && owedBase ? `1 ${k.baseCurrency} = ${(quote / owedBase).toFixed(4)} ${m.currency}` : "-"}</dd></div>
              )}
              <div className="flex justify-between border-t border-line pt-5"><dt className="text-ink-2">Amount to pay</dt><dd className="num text-3xl font-semibold text-blue">{done ? fmt(0, m.currency) : local}</dd></div>
            </dl>
            <p className="mt-8 text-xs text-mute leading-relaxed">
              This goes into a shared pool that can only be spent inside the group&apos;s signed mandate: a {fmt(k.mandate.totalBudget, k.baseCurrency)} budget and a {fmt(k.mandate.perPaymentCap, k.baseCurrency)} cap per payment, unless {k.mandate.quorum} friends vote yes.
            </p>
          </div>

          {/* right: card + PayPal */}
          <div className="bg-[#eef0fd] p-7 sm:p-10 flex flex-col">
            <ol className="flex items-center gap-2 text-xs font-semibold">
              {["Share", "Currency", "Pay"].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className={`grid place-items-center size-5 rounded-full transition ${i < step ? "bg-ok text-white" : i === step ? "bg-blue text-white" : "bg-white text-mute"}`}>{i < step ? <Check size={11} /> : i + 1}</span>
                  <span className={i <= step ? "text-ink" : "text-mute"}>{s}</span>
                  {i < 2 && <span className="w-6 h-px bg-ink/20" />}
                </li>
              ))}
            </ol>

            {/* tilting glass card */}
            <div className="mt-7 [perspective:1000px]" onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
              <div ref={cardRef}
                className={`relative aspect-[1.6] w-full max-w-[360px] mx-auto rounded-[1.3rem] overflow-hidden text-white transition-[transform,box-shadow] duration-300 ${done ? "glow-ok" : "shadow-[0_30px_50px_-20px_rgba(47,91,255,.55)]"}`}
                style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: "preserve-3d" }}>
                <Image src="/images/card.webp" alt="" fill sizes="360px" className="object-cover scale-[1.9]" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#2f5bff]/70 via-[#5a3ec8]/50 to-[#b07bff]/40" />
                <div className="absolute inset-0 p-5 flex flex-col">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold tracking-tight">kitty</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">group pass</span>
                  </div>
                  <span className="mt-4 w-10 h-7 rounded-md bg-gradient-to-br from-[#f3e2b3] to-[#b9975b] opacity-90" />
                  <p className="num text-2xl sm:text-3xl font-semibold mt-auto tracking-wide">{done ? paidAmount || "Paid" : local}</p>
                  <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-white/80 mt-1">
                    <span>{m.name}</span><span>{m.currency} → {k.baseCurrency}</span>
                  </div>
                </div>
                {state === "authorising" && (
                  <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-[2px] pop">
                    <div className="text-center"><Loader2 className="mx-auto animate-spin" size={28} /><p className="text-sm mt-2">Authorising with PayPal…</p></div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex-1 flex flex-col justify-end">
              {done ? (
                <div className="text-center pop">
                  <span className="mx-auto grid place-items-center size-12 rounded-full bg-ok text-white"><Check /></span>
                  <p className="display text-3xl font-semibold mt-3">You&apos;re in.</p>
                  <p className="text-sm text-ink-2 mt-1">Paid {paidAmount || fmt(m.paid, k.baseCurrency)} into the pool. Any queued payouts may have just been released.</p>
                  <Link href={`/k/${k.id}`} className="btn btn-blue mt-5">See the kitty</Link>
                </div>
              ) : mode?.paypalClientId ? (
                <div ref={btnRef} className="min-h-[110px]" />
              ) : (
                <button onClick={async () => { try { const id = await createOrder(); await capture(id); } catch (e) { setState("error"); setMsg((e as Error).message); } }}
                  disabled={state === "authorising"} className="btn w-full !py-4 bg-blue text-white text-base hover:bg-blue-2 shadow-xl shadow-blue/30">
                  {state === "authorising" ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />} Pay {local} with PayPal
                </button>
              )}
              {state === "error" && <p className="text-sm text-bad mt-3">{msg}</p>}
              {!done && (
                <p className="mt-4 text-[11px] text-mute flex items-center gap-1.5 justify-center">
                  <ShieldCheck size={13} /> {mode?.paypalClientId ? "PayPal sandbox checkout. Log in with a sandbox personal account." : "Simulated PayPal checkout (no sandbox keys configured)."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[10%] bottom-[8%] size-28 rounded-full bg-[#1d39c9] text-white grid place-items-center font-semibold tracking-tight shadow-2xl hidden lg:grid floaty">kitty</div>
    </main>
  );
}
