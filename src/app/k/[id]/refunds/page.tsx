"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Loader2, Undo2 } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, PayPalBadge, api, timeAgo } from "@/components/kit";
import { Empty, PageTitle, Stat, StatRow } from "@/components/fin";
import { fmt } from "@/lib/money";

const FINAL = /^(RETURNED|CANCELED|REFUNDED|REVERSED|SUCCESS)$/i;
const DECISION: Record<string, { tone: "ok" | "warn" | "bad" | "lilac"; text: string }> = {
  allow: { tone: "ok", text: "Done." },
  needs_quorum: { tone: "lilac", text: "Sent to the group for a vote." },
  queued: { tone: "warn", text: "Queued until the pool can cover it." },
  block: { tone: "bad", text: "Blocked by policy." },
  failed: { tone: "bad", text: "PayPal rejected it." },
};

export default function RefundsPage() {
  const { kitty: k, actor, reload } = useKitty();
  const payers = k.members.filter((m) => m.paid > 0);
  const [who, setWho] = useState<string | null>(payers[0]?.id ?? null);
  const member = k.members.find((m) => m.id === who);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "bad" | "lilac"; text: string } | null>(null);

  const refunded = k.ledger.filter((e) => /^Refunded /.test(e.title)).reduce((s, e) => s + (e.amount ?? 0), 0);
  const voided = k.payouts.filter((p) => /^(RETURNED|CANCELED)$/i.test(p.status)).length;
  const pendingVotes = k.proposals.filter((p) => p.status === "pending" && (p.action.type === "refund_member" || p.action.type === "void_payout")).length;
  const pool = Math.round((k.members.reduce((s, m) => s + m.paid, 0) - k.spent) * 100) / 100;

  async function submit(action: { type: string; params: Record<string, unknown> }, label: string, key: string) {
    setBusy(key); setNote(null);
    try {
      const r = await api<{ decision: string; error?: string }>(`/api/kitties/${k.id}/action`, { action, label });
      setNote(DECISION[r.decision] ? { ...DECISION[r.decision], text: r.error ? `${DECISION[r.decision].text} ${r.error}` : DECISION[r.decision].text } : { tone: "warn", text: r.decision });
      await reload();
    } catch (e) { setNote({ tone: "bad", text: (e as Error).message }); } finally { setBusy(null); }
  }

  const amt = Number(amount);
  const valid = !!member && amt > 0 && amt <= member.paid + 0.001;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><FeatureTag n="14" label="Refunds & payout voids" /><PayPalBadge what="Refunds · Payouts cancel" /></div>
      <PageTitle title="Refunds & voids" sub="Give money back to a friend, or stop a vendor payout before they claim it. Money leaving the pool always needs the group's votes." />

      <StatRow>
        <Stat label="Refunded so far" value={fmt(refunded, k.baseCurrency)} chip="to friends" tone="ok" />
        <Stat label="Payouts voided" value={voided} chip="returned" tone="mute" delay={0.05} />
        <Stat label="Waiting on votes" value={pendingVotes} chip={pendingVotes ? "needs you" : "clear"} tone={pendingVotes ? "lilac" : "ok"} delay={0.1} />
        <Stat label="Pool balance" value={fmt(pool, k.baseCurrency)} chip={k.baseCurrency} tone="blue" delay={0.15} />
      </StatRow>

      {note && (
        <p className={`rounded-xl text-sm px-4 py-3 flex items-center justify-between gap-3 ${note.tone === "bad" ? "bg-bad-soft text-bad" : note.tone === "ok" ? "bg-ok-soft text-[#0e8f40]" : note.tone === "lilac" ? "bg-[#efe9ff] text-[#6a4bd8]" : "bg-warn-soft text-[#a86d00]"}`}>
          <span>{note.text}</span>
          {note.tone === "lilac" && <Link href={`/k/${k.id}/approvals`} className="font-semibold underline">Open approvals</Link>}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
        <section className="panel p-6 rise">
          <h2 className="display text-2xl font-semibold">Quick refund</h2>
          {payers.length === 0 ? (
            <Empty icon={<Undo2 size={18} />} title="Nobody has paid yet" text="Once friends have paid their share you can refund them from here." />
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-4">
                {payers.map((m) => (
                  <button key={m.id} onClick={() => setWho(m.id)} className="text-center group" aria-pressed={who === m.id}>
                    <span className={`inline-block rounded-full p-0.5 transition ${who === m.id ? "ring-2 ring-ink ring-offset-2" : "opacity-70 group-hover:opacity-100"}`}><Avatar m={m} size={52} /></span>
                    <span className="block text-xs mt-1.5 text-ink-2">{m.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Amount ({k.baseCurrency})</span>
                  <input className="input mt-1.5 num !text-lg" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                </label>
                <div>
                  <span className="label">They have paid</span>
                  <p className="num text-lg font-semibold mt-3">{member ? fmt(member.paid, k.baseCurrency) : "—"}</p>
                </div>
              </div>
              <button
                disabled={!valid || busy !== null}
                onClick={() => member && submit({ type: "refund_member", params: { memberId: member.id, amount: amt } }, `Refund ${member.name} ${amt}`, "refund")}
                className="btn btn-dark w-full mt-5"
              >
                {busy === "refund" ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />} Propose refund
              </button>
              <p className="text-xs text-mute mt-3">Refunds go back through PayPal when {member?.name.split(" ")[0] ?? "they"} paid with PayPal. Needs {k.mandate.quorum} votes; you count as the first.</p>
            </>
          )}
        </section>

        <section className="panel p-6 rise" style={{ animationDelay: ".08s" }}>
          <h2 className="display text-2xl font-semibold">Vendor payouts</h2>
          {k.payouts.length === 0 ? (
            <Empty icon={<Ban size={18} />} title="No payouts yet" text="Payments to vendors appear here, with a way to stop one that hasn't been claimed." />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {k.payouts.map((p) => {
                const v = k.vendors.find((x) => x.id === p.vendorId);
                const done = FINAL.test(p.status);
                return (
                  <li key={p.id} className="py-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{v?.name ?? "Vendor"}</p>
                      <p className="text-xs text-mute truncate">{p.memo || "Payment"} · {timeAgo(p.ts)}</p>
                    </div>
                    <p className="num font-semibold">-{fmt(p.amount, k.baseCurrency)}</p>
                    <Chip tone={/^(RETURNED|CANCELED)$/i.test(p.status) ? "mute" : /SUCCESS/i.test(p.status) ? "ok" : "warn"}>{p.status.toLowerCase()}</Chip>
                    <button
                      disabled={done || busy !== null}
                      onClick={() => submit({ type: "void_payout", params: { payoutId: p.id } }, `Void payout to ${v?.name}`, p.id)}
                      className="btn btn-ghost !py-1.5 !px-3 text-xs"
                      title={done ? "Already claimed or returned" : "Propose stopping this payout"}
                    >
                      {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : "Void"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-mute mt-4">PayPal can only cancel a payout the vendor hasn&apos;t claimed. Anything already paid out has to be refunded by the vendor.</p>
          {actor.role !== "organizer" && <p className="text-xs text-mute mt-1">Any member can propose; the group decides.</p>}
        </section>
      </div>
    </div>
  );
}
