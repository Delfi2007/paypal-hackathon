"use client";

import Link from "next/link";
import type { Member, Proposal } from "@/lib/types";

export async function api<T>(url: string, body?: unknown, form?: FormData): Promise<T> {
  const r = await fetch(url, {
    method: body !== undefined || form ? "POST" : "GET",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j as T;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-semibold text-[1.15rem] tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <span className="relative grid place-items-center size-8 rounded-xl bg-gradient-to-br from-blue to-[#7b5cff] text-white shadow-lg shadow-blue/30">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 19V5M5 12l8-7M9 9l8 10" />
        </svg>
      </span>
      kitty
    </Link>
  );
}

export function Avatar({ m, size = 36, ring }: { m: Pick<Member, "name" | "avatarHue">; size?: number; ring?: boolean }) {
  return (
    <span
      title={m.name}
      className={`inline-grid place-items-center rounded-full font-semibold text-white shrink-0 ${ring ? "ring-2 ring-white" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, hsl(${m.avatarHue} 85% 66%), hsl(${(m.avatarHue + 40) % 360} 70% 48%))`,
      }}
    >
      {m.name.slice(0, 1)}
    </span>
  );
}

type Tone = "ok" | "warn" | "bad" | "blue" | "mute" | "lilac";
export function Chip({ tone = "mute", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const map: Record<Tone, string> = {
    ok: "bg-ok-soft text-[#0e8f40]",
    warn: "bg-warn-soft text-[#a86d00]",
    bad: "bg-bad-soft text-bad",
    blue: "bg-sky-soft text-blue",
    mute: "bg-soft text-ink-2",
    lilac: "bg-[#efe9ff] text-[#6a4bd8]",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[tone]} ${className}`}>{children}</span>;
}

export function FeatureTag({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white border border-line pl-1 pr-3 py-1 text-xs font-semibold text-ink-2">
      <span className="grid place-items-center size-5 rounded-full bg-ink text-white text-[10px]">{n}</span>
      {label}
    </span>
  );
}

export function PayPalBadge({ what, dark }: { what?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${dark ? "bg-white/10 text-white/80" : "bg-sky-soft text-[#003087]"}`}>
      <span className="size-1.5 rounded-full bg-[#009cde]" /> PayPal sandbox{what ? ` · ${what}` : ""}
    </span>
  );
}

export function proposalTone(p: Proposal): { tone: Tone; label: string } {
  if (p.status === "executed") return { tone: "ok", label: "Paid" };
  if (p.status === "rejected") return { tone: "bad", label: "Rejected" };
  if (p.status === "failed") return { tone: "bad", label: "Failed" };
  if (p.awaitingFunds) return { tone: "warn", label: "Queued for funds" };
  return { tone: "lilac", label: "Needs votes" };
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Splits a formatted amount into whole + cents for the big-number look. */
export function BigMoney({ value, className = "", centsClass = "" }: { value: string; className?: string; centsClass?: string }) {
  const m = value.match(/^(.*?)([.,]\d{2})$/);
  return (
    <span className={`num ${className}`}>
      {m ? m[1] : value}
      {m && <span className={`opacity-45 text-[0.55em] ${centsClass}`}>{m[2]}</span>}
    </span>
  );
}

export function SectionHead({ eyebrow, title, right, feature }: { eyebrow?: string; title: string; right?: React.ReactNode; feature?: { n: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        {feature && <FeatureTag n={feature.n} label={feature.label} />}
        {eyebrow && <p className="label mt-3">{eyebrow}</p>}
        <h2 className="display text-3xl sm:text-[2.4rem] font-medium mt-1">{title}</h2>
      </div>
      {right}
    </div>
  );
}
