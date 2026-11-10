"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, Unlock } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, PayPalBadge, api, timeAgo } from "@/components/kit";
import { Empty, PageTitle, Stat, StatRow, SwipeToConfirm } from "@/components/fin";
import { fmt } from "@/lib/money";
import type { Hold } from "@/lib/types";

const TONE: Record<Hold["status"], "ok" | "warn" | "bad" | "blue" | "mute" | "lilac"> = { created: "warn", authorized: "blue", captured: "ok", voided: "mute", expired: "mute" };
const LABEL: Record<Hold["status"], string> = { created: "Waiting for PayPal", authorized: "On hold", captured: "Captured", voided: "Released", expired: "Expired" };

export default function HoldsPage() {
  const { kitty: k, actor, reload } = useKitty();
  const router = useRouter();
  const holds = [...(k.holds ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mine = holds.find((h) => h.memberId === actor.id && (h.status === "created" || h.status === "authorized"));
  const owed = Math.max(0, actor.share - actor.paid);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isOrganizer = actor.role === "organizer";

  const reserved = holds.filter((h) => h.status === "authorized").reduce((s, h) => s + h.baseAmount, 0);
  const captured = holds.filter((h) => h.status === "captured").reduce((s, h) => s + h.baseAmount, 0);
  const open = holds.filter((h) => h.status === "created" || h.status === "authorized").length;
  const released = holds.filter((h) => h.status === "voided" || h.status === "expired").length;

  // Returning from PayPal's approval page: finish the authorization.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const id = q.get("hold");
    if (!id || !q.get("token")) return;
    (async () => {
      try { await api(`/api/kitties/${k.id}/holds/${id}`, { action: "authorize" }); await reload(); }
      catch (e) { setErr((e as Error).message); }
      router.replace(`/k/${k.id}/holds`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setErr(null);
    try { await fn(); await reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  const reserve = () => run("reserve", async () => {
    const r = await api<{ hold: Hold; approveUrl?: string }>(`/api/kitties/${k.id}/holds`, {});
    if (r.approveUrl) { location.href = r.approveUrl; return; } // real PayPal sandbox: buyer approves, then returns here
    await api(`/api/kitties/${k.id}/holds/${r.hold.id}`, { action: "authorize" }); // simulated mode: approve instantly
  });
  const act = (h: Hold, action: "capture" | "void") => run(h.id + action, () => api(`/api/kitties/${k.id}/holds/${h.id}`, { action }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><FeatureTag n="13" label="Authorize, then capture or void" /><PayPalBadge what="Orders v2 · AUTHORIZE" /></div>
      <PageTitle
        title="Holds"
        sub="Reserve your share without paying yet. PayPal holds the money on your account; it is only charged once the mandate is in force, and you can release it any time before."
        right={<Chip tone={k.status === "active" ? "ok" : "warn"}>{k.status === "active" ? "Mandate in force: holds can be captured" : "Mandate forming: nothing can be captured yet"}</Chip>}
      />

      <StatRow>
        <Stat label="Reserved right now" value={fmt(reserved, k.baseCurrency)} chip={`${open} open`} tone="blue" />
        <Stat label="Captured into the pool" value={fmt(captured, k.baseCurrency)} chip="charged" tone="ok" delay={0.05} />
        <Stat label="Released, never charged" value={released} chip="safe" tone="mute" delay={0.1} />
        <Stat label="Your share still owed" value={fmt(owed, k.baseCurrency)} chip={owed <= 0 ? "paid" : "due"} tone={owed <= 0 ? "ok" : "warn"} delay={0.15} />
      </StatRow>

      {err && <p className="rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{err}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start">
        <section className="panel p-6 rise">
          <h2 className="display text-2xl font-semibold">Reserve my share</h2>
          <div className="hold-scene mt-5">
            <div className={`hold-card ${mine?.status === "authorized" ? "flipped" : ""} ${mine?.status === "authorized" ? "hold-glow" : ""}`} style={{ borderRadius: "1.4rem" }}>
              <div className="hold-face flex flex-col justify-between">
                <div className="flex items-center justify-between text-sm font-semibold"><span>{k.name}</span><Lock size={16} /></div>
                <div>
                  <p className="text-xs opacity-80">{mine ? "Hold amount" : "Your share"}</p>
                  <p className="num text-3xl font-semibold">{mine ? fmt(mine.amount, mine.currency) : fmt(owed, k.baseCurrency)}</p>
                </div>
                <div className="flex items-center justify-between text-xs opacity-90"><span>{actor.name}</span><span>PayPal · AUTHORIZE</span></div>
              </div>
              <div className="hold-face hold-back">
                <div>
                  <CheckCircle2 className="mx-auto" size={34} />
                  <p className="num text-3xl font-semibold mt-2">{mine ? fmt(mine.amount, mine.currency) : ""}</p>
                  <p className="text-sm font-medium">On hold, not charged</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {owed <= 0 ? (
              <p className="text-center text-sm text-ink-2">You have already paid your share.</p>
            ) : mine?.status === "authorized" ? (
              <button onClick={() => act(mine, "void")} disabled={busy !== null} className="btn btn-ghost w-full">{busy ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />} Release my hold</button>
            ) : mine?.status === "created" ? (
              <button onClick={() => act(mine, "void")} disabled={busy !== null} className="btn btn-ghost w-full">Cancel this hold request</button>
            ) : (
              <SwipeToConfirm label={busy === "reserve" ? "Opening PayPal…" : "Swipe to reserve with PayPal"} onConfirm={reserve} disabled={busy !== null} />
            )}
          </div>
          <p className="text-xs text-mute mt-4">
            Captured at the deadline ({k.mandate.deadline}) if the mandate is in force. If it never is, the hold is released automatically and you are not charged.
          </p>
        </section>

        <section className="panel p-6 rise" style={{ animationDelay: ".08s" }}>
          <div className="flex items-center justify-between">
            <h2 className="display text-2xl font-semibold">Everyone&apos;s holds</h2>
            {isOrganizer && <Chip tone="lilac">You can capture</Chip>}
          </div>
          {holds.length === 0 ? (
            <Empty icon={<Lock size={18} />} title="No holds yet" text="When someone reserves their share it shows up here with its status." />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {holds.map((h) => {
                const m = k.members.find((x) => x.id === h.memberId);
                const canVoid = (h.status === "created" || h.status === "authorized") && (h.memberId === actor.id || isOrganizer);
                const canCapture = isOrganizer && h.status === "authorized";
                return (
                  <li key={h.id} className="py-3.5 flex items-center gap-3">
                    {m && <Avatar m={m} size={38} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{m?.name ?? "Member"}</p>
                      <p className="text-xs text-mute">{timeAgo(h.createdAt)}{h.note ? ` · ${h.note}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="num font-semibold">{fmt(h.amount, h.currency)}</p>
                      {h.currency !== k.baseCurrency && <p className="text-xs text-mute">≈ {fmt(h.baseAmount, k.baseCurrency)}</p>}
                    </div>
                    <Chip tone={TONE[h.status]}>{LABEL[h.status]}</Chip>
                    <div className="flex gap-1.5">
                      {canCapture && <button onClick={() => act(h, "capture")} disabled={busy !== null} className="btn btn-dark !py-1.5 !px-3 text-xs">{busy === h.id + "capture" ? <Loader2 size={13} className="animate-spin" /> : "Capture"}</button>}
                      {canVoid && <button onClick={() => act(h, "void")} disabled={busy !== null} className="btn btn-ghost !py-1.5 !px-3 text-xs">Release</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
