"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Gavel, Loader2, PenLine, Plus, Users } from "lucide-react";
import { Chip, Logo, api, BigMoney } from "@/components/kit";
import { NotificationBell, SavedTick, UserMenu, useMe } from "@/components/session";
import { AgentAccess } from "@/components/AgentAccess";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";

type Row = { id: string; name: string; destination: string; tagline: string; baseCurrency: Currency; members: number; expectedMembers: number; status: "forming" | "active"; pool: number; pending: number; needsSign: boolean };
const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];

export default function AppHome() {
  const { user, mode, refresh } = useMe(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState({ name: "", currency: "USD", paypalEmail: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    api<Row[]>("/api/kitties").then(setRows).catch(() => setRows([]));
    setProfile({ name: user.name, currency: user.currency, paypalEmail: user.paypalEmail ?? "" });
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api("/api/auth/profile", profile); await refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000); } finally { setSaving(false); }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().split("/").pop();
    if (c) router.push(`/join/${c}`);
  }

  if (!user) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-blue" /></div>;

  return (
    <main className="min-h-screen w-full">
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-8 py-3 bg-bg/80 backdrop-blur border-b border-line/60">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={mode?.paypal === "live-sandbox" ? "blue" : "mute"} className="hidden sm:inline-flex">{mode?.paypal === "live-sandbox" ? "PayPal sandbox · live" : "PayPal · simulated"}</Chip>
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </header>

      <div className="px-4 sm:px-8 py-8 max-w-[1200px] mx-auto space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] p-7 sm:p-10 text-white rise">
          <Image src="/images/sky.webp" alt="" fill priority sizes="1200px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a3fd6]/70 to-transparent" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] items-end">
            <div>
              <p className="label !text-white/80">Welcome back</p>
              <h1 className="display text-5xl sm:text-6xl font-medium mt-2">Hi {user.name.split(" ")[0]}.</h1>
              <p className="text-white/90 mt-3 max-w-md">Start a kitty for your next trip, or join a friend&apos;s with their invite link.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/new" className="btn bg-white text-ink hover:bg-white/90"><Plus size={16} /> New kitty</Link>
              </div>
            </div>
            <form onSubmit={join} className="glass rounded-[1.4rem] p-4 !bg-white/25 !border-white/40">
              <p className="text-sm font-semibold">Have an invite?</p>
              <div className="mt-2 flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the invite link or code" className="input !bg-white/90 !py-2.5 text-ink" />
                <button className="btn btn-dark !px-4"><ArrowRight size={16} /></button>
              </div>
            </form>
          </div>
        </section>

        <section>
          <h2 className="display text-3xl font-medium">Your kitties</h2>
          {rows === null ? (
            <div className="mt-6"><Loader2 className="animate-spin text-blue" /></div>
          ) : rows.length === 0 ? (
            <div className="panel p-10 text-center mt-5">
              <Users className="mx-auto text-blue" size={30} />
              <p className="display text-2xl mt-3">No kitties yet</p>
              <p className="text-ink-2 mt-1">Start one in a sentence, then send the invite link to your friends.</p>
              <Link href="/new" className="btn btn-blue mt-5">Start your first kitty</Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => (
                <Link key={r.id} href={`/k/${r.id}`} className="panel p-6 hover:-translate-y-1 hover:shadow-xl transition-all rise" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-center justify-between">
                    <Chip tone={r.status === "active" ? "ok" : "warn"}>{r.status === "active" ? "Active" : "Forming"}</Chip>
                    {r.pending > 0 && <Chip tone="lilac"><Gavel size={11} /> {r.pending} to vote</Chip>}
                  </div>
                  <h3 className="display text-3xl font-medium mt-4">{r.name}</h3>
                  <p className="text-sm text-mute">{r.destination}</p>
                  <div className="mt-5 flex items-end justify-between">
                    <div><p className="label">Pool</p><BigMoney value={fmt(r.pool, r.baseCurrency)} className="text-3xl font-semibold" /></div>
                    <div className="text-right text-sm text-ink-2"><Users size={14} className="inline mr-1" />{r.members}/{r.expectedMembers} friends</div>
                  </div>
                  {r.needsSign && <p className="mt-4 text-sm font-semibold text-[#6a4bd8] flex items-center gap-1.5"><PenLine size={14} /> Sign the mandate</p>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="profile" className="scroll-mt-24">
          <h2 className="display text-3xl font-medium">Profile &amp; PayPal</h2>
          <form onSubmit={saveProfile} className="panel p-6 sm:p-8 mt-5 grid gap-5 md:grid-cols-3 items-end">
            <label className="block"><span className="text-sm font-semibold">Name</span><input className="input mt-1.5" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
            <label className="block"><span className="text-sm font-semibold">Currency you pay in</span>
              <select className="input mt-1.5" value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block"><span className="text-sm font-semibold">PayPal sandbox email</span><input type="email" className="input mt-1.5" placeholder="sb-xxxx@personal.example.com" value={profile.paypalEmail} onChange={(e) => setProfile({ ...profile, paypalEmail: e.target.value })} /></label>
            <div className="md:col-span-3 flex items-center gap-3">
              <button disabled={saving} className="btn btn-dark">{saving ? <Loader2 size={15} className="animate-spin" /> : null} Save</button>
              <SavedTick show={saved} />
              <p className="text-xs text-mute">PayPal invoices for your share are sent to this email. Changing currency affects kitties you join next.</p>
            </div>
          </form>
        </section>

        <AgentAccess />
      </div>
    </main>
  );
}
