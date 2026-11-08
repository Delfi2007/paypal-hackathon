"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Bot, Check, CircleDollarSign, Copy, Gavel, History, Loader2, Mail, Menu, PenLine, ReceiptText, SendHorizontal, Share2, Sparkles, UserPlus, Wallet, X,
} from "lucide-react";
import type { AppUser, Kitty, Member, ModeStatus } from "@/lib/types";
import { Avatar, Chip, Logo, api } from "./kit";
import { NotificationBell, UserMenu } from "./session";

type Chain = { ok: boolean; checked: number; brokenAt?: string };
type Ctx = {
  kitty: Kitty;
  mode: ModeStatus;
  actor: Member; // the signed-in user's own membership
  user: AppUser;
  chain: Chain;
  reload: () => Promise<void>;
  invite: () => void;
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

type Payload = { kitty: Kitty; mode: ModeStatus; me: string; user: AppUser; chain: Chain };

export function KittyShell({ id, children }: { id: string; children: React.ReactNode }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<{ status?: number; message: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const path = usePathname();
  const router = useRouter();

  const reload = useCallback(async () => {
    try {
      setData(await api<Payload>(`/api/kitties/${id}`));
      setErr(null);
    } catch (e) {
      const message = (e as Error).message;
      if (message === "Please log in") router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
      else setErr({ message });
    }
  }, [id, router]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => setOpen(false), [path]);

  if (err && !data)
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <p className="display text-4xl">Can&apos;t open this kitty</p>
          <p className="text-ink-2 mt-2 max-w-sm mx-auto">{err.message}</p>
          <Link href="/app" className="btn btn-dark mt-5">My kitties</Link>
        </div>
      </div>
    );
  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-blue" /></div>;

  const k = data.kitty;
  const actor = k.members.find((m) => m.id === data.me)!;
  const pending = k.proposals.filter((p) => p.status === "pending").length;
  const base = `/k/${k.id}`;
  const signed = k.mandate.signedBy.includes(actor.id);

  async function sign() {
    setSigning(true);
    try { await api(`/api/kitties/${k.id}/sign`, {}); await reload(); } finally { setSigning(false); }
  }

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Logo />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <Link href="/app" className="mx-4 rounded-2xl bg-soft p-3 hover:bg-line/60 transition block">
        <p className="label flex items-center justify-between">Kitty <Chip tone={k.status === "active" ? "ok" : "warn"} className="!py-0.5">{k.status === "active" ? "Active" : "Forming"}</Chip></p>
        <p className="font-semibold truncate mt-1">{k.name}</p>
        <p className="text-xs text-mute truncate">{k.destination} · {k.baseCurrency} · {k.members.length}/{k.expectedMembers} friends</p>
      </Link>
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
        <p className="label mb-2">Friends</p>
        <div className="flex flex-wrap gap-1.5">
          {k.members.map((m) => (
            <span key={m.id} title={`${m.name}${m.id === actor.id ? " (you)" : ""}`} className={m.id === actor.id ? "rounded-full ring-2 ring-blue ring-offset-2" : ""}><Avatar m={m} size={30} /></span>
          ))}
          {k.members.length < k.expectedMembers && (
            <button onClick={() => setInviteOpen(true)} className="grid place-items-center size-[30px] rounded-full border-2 border-dashed border-line text-mute hover:text-ink hover:border-ink/40" aria-label="Invite a friend"><UserPlus size={14} /></button>
          )}
        </div>
      </div>
      <div className="mt-auto p-4 space-y-2">
        <button onClick={() => setInviteOpen(true)} className="btn btn-blue w-full text-sm"><UserPlus size={15} /> Invite friends</button>
        <Link href="/app" className="btn btn-ghost w-full text-sm">All my kitties</Link>
      </div>
    </nav>
  );

  return (
    <KittyCtx.Provider value={{ kitty: k, mode: data.mode, actor, user: data.user, chain: data.chain, reload, invite: () => setInviteOpen(true) }}>
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
              <Chip tone={data.mode.paypal === "live-sandbox" ? "blue" : "mute"} className="hidden md:inline-flex">
                <CircleDollarSign size={12} /> {data.mode.paypal === "live-sandbox" ? "PayPal sandbox · live" : "PayPal · simulated"}
              </Chip>
              <Chip tone={data.mode.ai === "gemini" ? "lilac" : "mute"} className="hidden md:inline-flex">
                <Sparkles size={12} /> {data.mode.ai === "gemini" ? "AI agent · live" : "AI agent · offline"}
              </Chip>
              <NotificationBell />
              <UserMenu user={data.user} />
            </div>
          </header>

          {!signed && (
            <div className="px-4 sm:px-8 pt-5">
              <div className="rounded-2xl bg-gradient-to-r from-[#efe9ff] to-sky-soft border border-[#d9ccff] p-4 sm:p-5 flex flex-wrap items-center gap-4">
                <span className="grid place-items-center size-10 rounded-full bg-white text-[#6a4bd8]"><PenLine size={18} /></span>
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold">Sign the mandate to start</p>
                  <p className="text-sm text-ink-2">Budget {k.mandate.totalBudget} {k.baseCurrency}, {k.mandate.perPaymentCap} cap per payment, {k.mandate.quorum} votes to override. {k.mandate.signedBy.length}/{k.mandate.quorum} signed.</p>
                </div>
                <Link href={`${base}/approvals`} className="btn btn-ghost !py-2 text-sm">Read the rules</Link>
                <button onClick={sign} disabled={signing} className="btn btn-blue !py-2 text-sm">{signing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} I agree, sign</button>
              </div>
            </div>
          )}
          <main className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px]">{children}</main>
        </div>
      </div>
      {inviteOpen && <InviteDialog k={k} onClose={() => setInviteOpen(false)} />}
    </KittyCtx.Provider>
  );
}

function InviteDialog({ k, onClose }: { k: Kitty; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = typeof location !== "undefined" ? `${location.origin}/join/${k.inviteCode}` : "";
  const text = `Join our "${k.name}" kitty on Kitty. Your share is ${k.sharePerMember} ${k.baseCurrency}: ${link}`;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative panel w-full max-w-md p-7 pop">
        <button onClick={onClose} className="absolute top-4 right-4 text-mute hover:text-ink" aria-label="Close"><X size={18} /></button>
        <span className="grid place-items-center size-12 rounded-2xl bg-gradient-to-br from-blue to-[#7b5cff] text-white"><UserPlus size={22} /></span>
        <h3 className="display text-3xl font-semibold mt-4">Invite your friends</h3>
        <p className="text-ink-2 text-sm mt-1">{k.members.length} of {k.expectedMembers} have joined. Anyone with this link can create an account and join.</p>
        <div className="mt-5 flex gap-2">
          <input readOnly value={link} className="input !py-2.5 text-sm" onFocus={(e) => e.target.select()} />
          <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn btn-dark !px-4">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm"><Share2 size={15} /> WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(`Join ${k.name} on Kitty`)}&body=${encodeURIComponent(text)}`} className="btn btn-ghost text-sm"><Mail size={15} /> Email</a>
        </div>
      </div>
    </div>
  );
}
