"use client";

import type { Member } from "@/lib/types";

export function Avatar({ m, size = 36, ring = false }: { m: Pick<Member, "name" | "avatarHue">; size?: number; ring?: boolean }) {
  return (
    <span
      title={m.name}
      className={`inline-grid place-items-center rounded-full font-medium text-white shrink-0 ${ring ? "ring-2 ring-offset-2 ring-offset-paper ring-ink" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${m.avatarHue} 60% 58%), hsl(${(m.avatarHue + 30) % 360} 55% 42%))`,
      }}
    >
      {m.name.slice(0, 1)}
    </span>
  );
}

export function Badge({ tone, children }: { tone: "olive" | "bloom" | "aegean" | "gold" | "mute"; children: React.ReactNode }) {
  const map = {
    olive: "bg-olive/10 text-olive",
    bloom: "bg-bloom-soft text-bloom",
    aegean: "bg-sky text-aegean-deep",
    gold: "bg-gold/15 text-gold",
    mute: "bg-ink/5 text-ink-soft",
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${map[tone]}`}>{children}</span>;
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
