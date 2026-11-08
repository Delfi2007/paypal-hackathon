"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Users } from "lucide-react";
import { Avatar, Logo, api } from "@/components/kit";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";

type Preview = {
  id: string; name: string; destination: string; tagline: string; baseCurrency: Currency; sharePerMember: number;
  expectedMembers: number; totalBudget: number; perPaymentCap: number; quorum: number; deadline: string;
  members: { name: string; hue: number; role?: string }[]; alreadyMember: boolean; loggedIn: boolean;
};

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [p, setP] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Preview>(`/api/join/${code}`).then(setP).catch((e) => setErr(e.message)); }, [code]);

  async function join() {
    setBusy(true);
    try { const r = await api<{ id: string }>(`/api/join/${code}`, {}); router.push(`/k/${r.id}`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const next = encodeURIComponent(`/join/${code}`);

  return (
    <main className="min-h-screen w-full grid lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden lg:block overflow-hidden">
        <Image src="/images/sky.webp" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue/40 to-[#141a4d]/50" />
        <div className="absolute top-8 left-8"><Logo light /></div>
      </div>
      <div className="flex flex-col px-6 sm:px-14 py-10 bg-white">
        <div className="lg:hidden"><Logo /></div>
        <div className="my-auto max-w-lg w-full mx-auto py-10">
          {err && !p && <div className="text-center"><p className="display text-4xl">Invite not found</p><p className="text-ink-2 mt-2">{err}</p><Link href="/app" className="btn btn-dark mt-6">Go to my kitties</Link></div>}
          {!p && !err && <Loader2 className="animate-spin text-blue" />}
          {p && (
            <div className="rise">
              <p className="label">You&apos;re invited to</p>
              <h1 className="display text-5xl sm:text-6xl font-semibold mt-2">{p.name}</h1>
              <p className="text-ink-2 mt-2">{p.destination} · {p.tagline}</p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <Stat label="Your share" value={fmt(p.sharePerMember, p.baseCurrency)} />
                <Stat label="Group budget" value={fmt(p.totalBudget, p.baseCurrency)} />
                <Stat label="Votes to override" value={`${p.quorum} of ${p.expectedMembers}`} />
                <Stat label="Pay by" value={new Date(p.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
              </div>

              <div className="mt-8">
                <p className="label flex items-center gap-1.5"><Users size={13} /> Already in ({p.members.length}/{p.expectedMembers})</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {p.members.map((m, i) => (
                    <span key={i} className="flex items-center gap-2 rounded-full bg-soft pl-1 pr-3 py-1"><Avatar m={{ name: m.name, avatarHue: m.hue }} size={28} /><span className="text-sm font-medium">{m.name}</span></span>
                  ))}
                </div>
              </div>

              <p className="text-sm text-ink-2 mt-8 leading-relaxed">The group&apos;s money is held in a shared pool and can only be spent inside the rules above, unless {p.quorum} friends vote yes. You&apos;ll see and sign the rules after you join.</p>

              {err && <p className="mt-4 rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{err}</p>}
              {p.alreadyMember ? (
                <Link href={`/k/${p.id}`} className="btn btn-blue w-full mt-6 !py-3.5"><Check size={16} /> You&apos;re in. Open the kitty</Link>
              ) : p.loggedIn ? (
                <button onClick={join} disabled={busy} className="btn btn-blue w-full mt-6 !py-3.5 text-base">{busy ? <Loader2 size={18} className="animate-spin" /> : null} Join {p.name} <ArrowRight size={16} /></button>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link href={`/signup?next=${next}`} className="btn btn-blue !py-3.5">Create an account to join</Link>
                  <Link href={`/login?next=${next}`} className="btn btn-ghost !py-3.5">I have an account</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-soft/70 p-4"><p className="label">{label}</p><p className="num text-2xl font-semibold mt-1">{value}</p></div>;
}
