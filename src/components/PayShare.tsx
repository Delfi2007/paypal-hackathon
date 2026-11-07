"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import type { Kitty, ModeStatus } from "@/lib/types";
import { fmt } from "@/lib/money";
import Image from "next/image";
import { Avatar } from "./ui";

type PayPalButtons = (opts: {
  style?: Record<string, string>;
  createOrder: () => Promise<string>;
  onApprove: (d: { orderID: string }) => Promise<void>;
  onError: (e: unknown) => void;
}) => { render: (el: HTMLElement) => Promise<void> };
declare global {
  interface Window {
    paypal?: { Buttons: PayPalButtons };
  }
}

export function PayShare({ kittyId, memberId }: { kittyId: string; memberId: string }) {
  const [k, setK] = useState<Kitty | null>(null);
  const [mode, setMode] = useState<ModeStatus | null>(null);
  const [quote, setQuote] = useState<{ amount: number; currency: string } | null>(null);
  const [state, setState] = useState<"idle" | "paying" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const btnRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/kitties/${kittyId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setK(d.kitty); setMode(d.mode); });
  }, [kittyId]);

  const m = k?.members.find((x) => x.id === memberId);

  // Quote in the member's currency (server converts with live FX)
  useEffect(() => {
    if (!k || !m || m.paid >= m.share) return;
    fetch(`/api/fx?from=${k.baseCurrency}&to=${m.currency}&amount=${m.share - m.paid}`)
      .then((r) => r.json())
      .then((q) => setQuote({ amount: q.amount, currency: m.currency }));
  }, [k, m]);

  async function createOrder() {
    const r = await fetch("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kittyId, memberId }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    orderRef.current = j.id;
    return j.id as string;
  }

  async function capture(orderId: string) {
    setState("paying");
    const r = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kittyId, memberId }) });
    const j = await r.json();
    if (!r.ok) { setState("error"); setMsg(j.error); return; }
    setState("done");
  }

  // Real PayPal Smart Buttons when sandbox credentials are configured
  useEffect(() => {
    if (!mode?.paypalClientId || !m || m.paid >= m.share || state !== "idle") return;
    const src = `https://www.paypal.com/sdk/js?client-id=${mode.paypalClientId}&currency=${m.currency}&intent=capture&components=buttons`;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.paypal || !btnRef.current) return;
      btnRef.current.innerHTML = "";
      window.paypal
        .Buttons({
          style: { layout: "vertical", shape: "pill", color: "blue", label: "pay" },
          createOrder,
          onApprove: async (d) => capture(d.orderID),
          onError: (e) => { setState("error"); setMsg(String((e as Error)?.message ?? e)); },
        })
        .render(btnRef.current);
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pp="${m.currency}"]`);
    if (existing) { if (window.paypal) render(); else existing.addEventListener("load", render); }
    else {
      document.querySelectorAll("script[data-pp]").forEach((s) => s.remove());
      delete window.paypal;
      const s = document.createElement("script");
      s.src = src; s.dataset.pp = m.currency; s.onload = render;
      document.body.appendChild(s);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode?.paypalClientId, m?.id, m?.currency, state]);

  if (!k || !m) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-aegean" /></div>;
  const paid = m.paid >= m.share || state === "done";

  return (
    <main className="min-h-screen w-full grid lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image src="/images/alley.webp" alt="Whitewashed alley in Santorini" fill sizes="50vw" className="object-cover" priority />
        <p className="absolute bottom-10 left-10 script text-6xl text-paper drop-shadow-[0_2px_10px_rgba(15,26,43,.6)] -rotate-3">One tap, you&apos;re in.</p>
      </div>
      <div className="px-6 sm:px-12 lg:px-20 py-10 flex flex-col">
        <Link href={`/k/${k.id}`} className="eyebrow flex items-center gap-2"><ArrowLeft size={14} /> {k.name}</Link>
        <div className="my-auto py-12 max-w-md">
          <div className="flex items-center gap-3">
            <Avatar m={m} size={44} />
            <p className="eyebrow">Hi {m.name}, your share for</p>
          </div>
          <h1 className="display text-6xl mt-5">{k.destination}</h1>
          <span className="rule my-6" />
          {paid ? (
            <div className="rise">
              <p className="display text-5xl text-olive flex items-center gap-3"><Check size={40} /> You&apos;re in.</p>
              <p className="mt-4 text-ink-soft">Your payment went into the group pool. Any payouts that were waiting on it may have just been released.</p>
              <Link href={`/k/${k.id}`} className="pill pill-dark mt-8">See the kitty</Link>
            </div>
          ) : (
            <>
              <p className="eyebrow">Amount due</p>
              <p className="display text-7xl mt-2">{quote ? fmt(quote.amount, m.currency) : "…"}</p>
              {m.currency !== k.baseCurrency && (
                <p className="text-sm text-mute mt-2">= {fmt(m.share - m.paid, k.baseCurrency)} at today&apos;s rate, settled into the pool in {k.baseCurrency}.</p>
              )}
              <p className="mt-6 text-ink-soft">
                The money goes into a shared pool. It can only be spent inside the group&apos;s signed mandate: a{" "}
                {fmt(k.mandate.totalBudget, k.baseCurrency)} budget and a {fmt(k.mandate.perPaymentCap, k.baseCurrency)} cap per payment, unless {k.mandate.quorum} friends vote yes.
              </p>
              <div className="mt-8">
                {mode?.paypalClientId ? (
                  <div ref={btnRef} className="max-w-sm min-h-[120px]" />
                ) : (
                  <button
                    onClick={async () => { const id = await createOrder(); await capture(id); }}
                    disabled={state === "paying"}
                    className="pill w-full max-w-sm justify-center bg-[#ffc439] text-[#111] font-semibold hover:brightness-95"
                  >
                    {state === "paying" ? <Loader2 size={16} className="animate-spin" /> : null} Pay with PayPal (simulated)
                  </button>
                )}
                {state === "paying" && <p className="text-sm text-mute mt-3">Capturing payment…</p>}
                {state === "error" && <p className="text-sm text-bloom mt-3">{msg}</p>}
              </div>
              <p className="mt-6 text-xs text-mute flex items-center gap-2"><ShieldCheck size={14} /> {mode?.paypalClientId ? "PayPal sandbox. Use a sandbox personal account to log in." : "Simulated mode. Add PayPal sandbox keys for real checkout."}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
