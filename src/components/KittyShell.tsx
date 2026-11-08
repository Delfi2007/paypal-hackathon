"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Bot, CircleDollarSign, Gavel, History, Loader2, Menu, ReceiptText, RotateCcw, SendHorizontal, Sparkles, Wallet, X,
} from "lucide-react";
import type { Kitty, Member, ModeStatus } from "@/lib/types";
import { Avatar, Chip, Logo, api } from "./kit";

type Ctx = {
  kitty: Kitty;
  mode: ModeStatus;
  actor: Member;
  setActorId: (id: string) => void;
  reload: () => Promise<void>;
};
const KittyCtx = createContext<Ctx | null>(null);
export const useKitty = () => {
  const c = useContext(KittyCtx);
  if (!c) throw new Error("useKitty outside KittyShell");
  return c;
};

const NAV = [
  { href: "", label: "Wallet", icon: Wallet, features: "07 · 11" },
  { href: "agent", label: "Agent", icon: Bot, features: "01 · 08" },
  { href: "send", label: "Pay vendor", icon: SendHorizontal, features: "05 · 10" },
  { href: "approvals", label: "Approvals", icon: Gavel, features: "03" },
  { href: "activity", label: "Activity", icon: History, features: "02 · 04" },
  { href: "split", label: "Split bill", icon: ReceiptText, features: "06" },
];

export function KittyShell({ id, children }: { id: string; children: React.ReactNode }) {
  const [data, setData] = useState<{ kitty: Kitty; mode: ModeStatus } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actorId, setActorIdState] = useState("");
  const [open, setOpen] = useState(false);
  const path = usePathname();

  const reload = useCallback(async () => {
    try {
      const d = await api<{ kitty: Kitty; mode: ModeStatus }>(`/api/kitties/${id}`);
      setData(d);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    try { const saved = localStorage.getItem(`kitty-actor-${id}`); if (saved) setActorIdState(saved); } catch {}
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [id, reload]);

  useEffect(() => setOpen(false), [path]);

  const setActorId = (a: string) => {
    setActorIdState(a);
    try { localStorage.setItem(`kitty-actor-${id}`, a); } catch {}
  };

  if (err && !data)
    return (
      <div className="min-h-screen grid place-items-center text-center">
        <div>
          <p className="display text-4xl">Kitty not found</p>
          <Link href="/" className="btn btn-ghost mt-5">Back home</Link>
        </div>
      </div>
    );
  if (!data)
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-blue" /></div>;

  const k = data.kitty;
  const actor = k.members.find((m) => m.id === actorId) ?? k.members.find((m) => m.isOrganizer) ?? k.members[0];
  const pending = k.proposals.filter((p) => p.status === "pending").length;
  const base = `/k/${k.id}`;

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Logo />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <div className="mx-4 rounded-2xl bg-soft p-3">
        <p className="label">Kitty</p>
        <p className="font-semibold truncate mt-0.5">{k.name}</p>
        <p className="text-xs text-mute truncate">{k.destination} · {k.baseCurrency}</p>
      </div>
      <ul className="mt-4 px-3 space-y-1">
        {NAV.map((n) => {
          const href = n.href ? `${base}/${n.href}` : base;
          const active = path === href;
          const Icon = n.icon;
          return (
            <li key={n.label}>
              <Link href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] font-medium transition ${active ? "bg-ink text-white shadow-lg shadow-ink/20" : "text-ink-2 hover:bg-soft"}`}>
                <Icon size={18} className={active ? "text-white" : "text-mute group-hover:text-ink"} />
                <span className="flex-1">{n.label}</span>
                {n.href === "approvals" && pending > 0 ? (
                  <span className="grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-[#7b5cff] text-white text-[11px]">{pending}</span>
                ) : (
                  <span className={`text-[10px] font-semibold ${active ? "text-white/60" : "text-mute/70"}`}>{n.features}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 px-5">
        <p className="label mb-2">Acting as</p>
        <div className="flex flex-wrap gap-1.5">
          {k.members.map((m) => (
            <button key={m.id} onClick={() => setActorId(m.id)} title={`Act as ${m.name}`}
              className={`rounded-full transition ${m.id === actor.id ? "ring-2 ring-blue ring-offset-2" : "opacity-60 hover:opacity-100"}`}>
              <Avatar m={m} size={30} />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-mute mt-2 leading-snug">Demo only: switch person to vote as each friend.</p>
      </div>
      <div className="mt-auto p-4 space-y-2">
        <Link href="/new" className="btn btn-ghost w-full text-sm">+ New kitty</Link>
        {k.id === "santorini" && (
          <button onClick={async () => { await api(`/api/kitties/${k.id}/reset`, {}); reload(); }} className="w-full text-xs text-mute hover:text-ink flex items-center justify-center gap-1.5 py-1">
            <RotateCcw size={12} /> Reset demo data
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <KittyCtx.Provider value={{ kitty: k, mode: data.mode, actor, setActorId, reload }}>
      <div className="min-h-screen w-full lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block sticky top-0 h-screen border-r border-line bg-white/70 backdrop-blur">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-white pop">{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-8 py-3 bg-bg/80 backdrop-blur border-b border-line/60">
            <button className="lg:hidden btn btn-ghost !p-2.5" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            <div className="lg:hidden"><Logo /></div>
            <div className="ml-auto flex items-center gap-2">
              <Chip tone={data.mode.paypal === "live-sandbox" ? "blue" : "mute"}>
                <CircleDollarSign size={12} /> {data.mode.paypal === "live-sandbox" ? "PayPal sandbox · live" : "PayPal · simulated"}
              </Chip>
              <Chip tone={data.mode.ai === "gemini" ? "lilac" : "mute"} className="hidden sm:inline-flex">
                <Sparkles size={12} /> {data.mode.ai === "gemini" ? "AI agent · live" : "AI agent · offline"}
              </Chip>
              <span className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-line">
                <Avatar m={actor} size={30} />
                <span className="text-sm font-medium">{actor.name}</span>
              </span>
            </div>
          </header>
          <main className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px]">{children}</main>
        </div>
      </div>
    </KittyCtx.Provider>
  );
}
