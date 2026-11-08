"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Logo, api } from "./kit";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") && sp.get("next")!.startsWith("/") ? sp.get("next")! : "/app";
  const [f, setF] = useState({ name: "", email: "", password: "", currency: "USD", paypalEmail: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api(`/api/auth/${mode}`, mode === "signup" ? f : { email: f.email, password: f.password });
      router.replace(next);
      router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const other = mode === "login" ? `/signup?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`;

  return (
    <main className="min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden lg:block overflow-hidden">
        <Image src="/images/sky.webp" alt="" fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue/40 via-transparent to-[#141a4d]/50" />
        <div className="absolute top-8 left-8"><Logo light /></div>
        <div className="absolute bottom-12 left-10 right-10 text-white">
          <h2 className="display text-5xl xl:text-6xl font-medium drop-shadow-[0_4px_30px_rgba(0,40,140,.4)]">Real friends.<br />Real money.<br />One pool.</h2>
          <p className="mt-4 text-white/90 max-w-md">Create a group, invite your friends with a link, sign the rules together, and let the AI treasurer do the chasing, with PayPal moving the money.</p>
        </div>
      </div>

      <div className="flex flex-col px-6 sm:px-14 py-8 bg-white">
        <div className="lg:hidden"><Logo /></div>
        <form onSubmit={submit} className="my-auto w-full max-w-md mx-auto py-10 rise">
          <h1 className="display text-4xl sm:text-5xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-ink-2 mt-2">{mode === "login" ? "Log in to your kitties." : "Free. Takes 30 seconds. Then start a kitty or join a friend's."}</p>

          <div className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field label="Your name"><input required value={f.name} onChange={set("name")} autoComplete="name" className="input" placeholder="Delfi" /></Field>
            )}
            <Field label="Email"><input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className="input" placeholder="you@email.com" /></Field>
            <Field label="Password"><input required type="password" minLength={mode === "signup" ? 8 : 1} value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} /></Field>
            {mode === "signup" && (
              <>
                <Field label="The currency you pay in">
                  <select value={f.currency} onChange={set("currency")} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
                <Field label="Your PayPal sandbox email" hint="Optional. Used for PayPal invoices and refunds. Create a free sandbox buyer at developer.paypal.com.">
                  <input type="email" value={f.paypalEmail} onChange={set("paypalEmail")} className="input" placeholder="sb-buyer@personal.example.com" />
                </Field>
              </>
            )}
          </div>

          {err && <p className="mt-4 rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{err}</p>}
          <button disabled={busy} className="btn btn-blue w-full mt-6 !py-3.5 text-base">
            {busy ? <Loader2 size={18} className="animate-spin" /> : null} {mode === "login" ? "Log in" : "Create account"} <ArrowRight size={16} />
          </button>
          <p className="text-sm text-ink-2 mt-5 text-center">
            {mode === "login" ? "New to Kitty?" : "Already have an account?"}{" "}
            <Link href={other} className="font-semibold text-blue">{mode === "login" ? "Create an account" : "Log in"}</Link>
          </p>
          <p className="mt-8 text-[11px] text-mute flex items-center gap-1.5 justify-center"><ShieldCheck size={13} /> Passwords are hashed with scrypt. Payments run on the PayPal sandbox, no real money.</p>
        </form>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block text-xs text-mute mt-1.5 leading-snug">{hint}</span>}
    </label>
  );
}
