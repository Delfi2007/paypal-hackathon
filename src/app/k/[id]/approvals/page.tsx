"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Clock, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, api, proposalTone, timeAgo } from "@/components/kit";
import { fmt } from "@/lib/money";
import { poolBalance } from "@/lib/policy";
import { refundShares } from "@/lib/closeout";
import type { PolicyResult, Proposal } from "@/lib/types";

export default function ApprovalsPage() {
  const { kitty: k, actor, reload } = useKitty();
  const open = k.proposals.filter((p) => p.status === "pending");
  const closed = k.proposals.filter((p) => p.status !== "pending");
  const [busy, setBusy] = useState<string | null>(null);

  async function cast(p: Proposal, approve: boolean) {
    setBusy(p.id + approve);
    try { await api(`/api/kitties/${k.id}/vote`, { proposalId: p.id, memberId: actor.id, approve }); await reload(); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><FeatureTag n="03" label="Policy engine & approvals" /><FeatureTag n="05" label="Payout once funded" /></div>

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <section className="space-y-6 min-w-0">
          <div className="rise">
            <p className="label">Quorum consent</p>
            <h1 className="display text-4xl sm:text-5xl font-medium mt-1">Waiting on the group</h1>
            <p className="text-ink-2 mt-2 max-w-xl">Anything outside the signed mandate lands here. Once {k.mandate.quorum} friends approve, Kitty pays automatically, or queues it until the pool has the money.</p>
          </div>

          {open.length === 0 && (
            <div className="panel p-10 text-center rise">
              <ShieldCheck className="mx-auto text-ok" size={32} />
              <p className="display text-2xl mt-3">All clear</p>
              <p className="text-ink-2 mt-1">Nothing needs a vote. Try paying the hotel €1,800, which is over the cap.</p>
              <Link href={`/k/${k.id}/send`} className="btn btn-blue mt-5">Open the keypad</Link>
            </div>
          )}

          {open.map((p, i) => {
            const amount = Number(p.action.params.amount ?? 0);
            const vendor = k.vendors.find((v) => v.id === p.action.params.vendorId);
            const voted = p.approvals.includes(actor.id) ? "yes" : p.rejections.includes(actor.id) ? "no" : null;
            const st = proposalTone(p);
            const need = p.preApproved ? 0 : Math.max(0, k.mandate.quorum - p.approvals.length);
            return (
              <article key={p.id} className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] overflow-hidden rounded-[1.6rem] shadow-[0_30px_60px_-30px_rgba(20,26,77,.35)] rise" style={{ animationDelay: `${i * .06}s` }}>
                <div className="bg-white p-7">
                  <div className="flex items-center justify-between gap-3">
                    <Chip tone={st.tone}>{st.label}</Chip>
                    <span className="text-xs text-mute">{timeAgo(p.createdAt)} · by {k.members.find((m) => m.id === p.requestedBy)?.name ?? "agent"}</span>
                  </div>
                  <h3 className="display text-3xl font-semibold mt-4">{p.title}</h3>
                  <p className="text-sm text-blue mt-1">{vendor ? `${vendor.name} · ${vendor.email}` : p.action.type.replace("_", " ")}</p>
                  {amount > 0 && (
                    <dl className="mt-6 text-sm space-y-3">
                      <div className="flex justify-between"><dt className="text-ink-2">Amount</dt><dd className="num font-semibold">{fmt(amount, k.baseCurrency)}</dd></div>
                      <div className="flex justify-between"><dt className="text-ink-2">Pool after</dt><dd className="num font-semibold">{fmt(poolBalance(k) - amount, k.baseCurrency)}</dd></div>
                      <div className="flex justify-between border-t border-line pt-3"><dt className="text-ink-2">Amount to pay</dt><dd className="num text-2xl font-semibold text-blue">{fmt(amount, k.baseCurrency)}</dd></div>
                    </dl>
                  )}
                  {p.action.type === "close_out" && (
                    <dl className="mt-6 text-sm space-y-2">
                      <div className="flex justify-between"><dt className="text-ink-2">Returned to friends</dt><dd className="num font-semibold">{fmt(poolBalance(k), k.baseCurrency)}</dd></div>
                      {refundShares(k).map((r) => (
                        <div key={r.memberId} className="flex justify-between"><dt className="text-ink-2">{k.members.find((m) => m.id === r.memberId)?.name}</dt><dd className="num">{fmt(r.base, k.baseCurrency)}</dd></div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-5 text-sm text-ink-2 italic">“{p.action.reasoning}”</p>
                </div>

                <div className="bg-[#eef0fd] p-7 flex flex-col">
                  <p className="font-semibold">Policy check</p>
                  <Checks policy={p.policy} />
                  <div className="mt-auto pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {k.members.map((m) => (
                          <span key={m.id} className={`rounded-full transition ${p.approvals.includes(m.id) ? "" : "opacity-25 grayscale"}`}><Avatar m={m} size={30} ring /></span>
                        ))}
                      </div>
                      <span className="text-sm font-semibold">{p.preApproved ? "Pre-approved" : `${p.approvals.length}/${k.mandate.quorum} votes`}</span>
                    </div>
                    {p.awaitingFunds ? (
                      <div className="mt-4 rounded-full bg-warn-soft text-[#a86d00] text-sm font-semibold py-3 text-center flex items-center justify-center gap-2"><Clock size={15} /> Pays automatically when funded</div>
                    ) : (
                      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                        <button onClick={() => cast(p, false)} disabled={!!busy} className={`btn btn-ghost ${voted === "no" ? "!bg-bad-soft !text-bad" : ""}`}><X size={15} /></button>
                        <button onClick={() => cast(p, true)} disabled={!!busy || voted === "yes"} className="btn btn-blue">
                          {busy === p.id + "true" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          {voted === "yes" ? `Approved · ${need} more needed` : "Approve"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {closed.length > 0 && (
            <div className="panel p-6">
              <p className="label">Decided</p>
              <ul className="mt-3 divide-y divide-line">
                {closed.map((p) => {
                  const st = proposalTone(p);
                  return (
                    <li key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">{p.status === "executed" ? <Check size={15} className="text-ok" /> : <X size={15} className="text-bad" />} {p.title}</span>
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* mandate */}
        <aside className="relative overflow-hidden rounded-[1.6rem] text-white p-7 rise" style={{ animationDelay: ".1s" }}>
          <Image src="/images/card.webp" alt="" fill sizes="400px" className="object-cover scale-150 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1f6b]/85 to-[#2c1b6e]/95" />
          <div className="relative">
            <p className="label !text-white/60">Signed mandate · v{k.mandate.version}</p>
            <h2 className="display text-4xl font-medium mt-2">The rules</h2>
            <p className="text-white/60 text-sm mt-1">The agent can&apos;t act outside these. Changing them needs a vote too.</p>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ["Total budget", fmt(k.mandate.totalBudget, k.baseCurrency)],
                ["Per-payment cap", fmt(k.mandate.perPaymentCap, k.baseCurrency)],
                ["Quorum", `${k.mandate.quorum} of ${k.members.length}`],
                ["Deadline", new Date(k.mandate.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })],
                ["Categories", k.mandate.allowedCategories.join(", ")],
              ].map(([a, b]) => (
                <div key={a} className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="text-white/60">{a}</dt><dd className="font-semibold text-right">{b}</dd></div>
              ))}
            </dl>
            <p className="label !text-white/60 mt-6">Pre-approved payees</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {k.vendors.map((v) => (
                <span key={v.id} className={`text-xs rounded-full px-2.5 py-1 ${k.mandate.approvedPayees.includes(v.id) ? "bg-mint/20 text-mint" : "bg-white/10 text-white/45 line-through"}`}>{v.name}</span>
              ))}
            </div>
            <SignBox />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SignBox() {
  const { kitty: k, actor, reload } = useKitty();
  const [busy, setBusy] = useState(false);
  const signed = k.mandate.signedBy.includes(actor.id);
  async function sign() {
    setBusy(true);
    try { await api(`/api/kitties/${k.id}/sign`, {}); await reload(); } finally { setBusy(false); }
  }
  return (
    <div className="mt-6">
      <p className="label !text-white/60">Signatures · {k.mandate.signedBy.length} of {k.mandate.quorum} needed{k.status === "active" ? " · in force" : ""}</p>
      <ul className="mt-3 space-y-2">
        {k.members.map((m) => {
          const s = k.mandate.signedBy.includes(m.id);
          return (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <Avatar m={m} size={26} />
              <span className="flex-1">{m.name}{m.id === actor.id ? " (you)" : ""}</span>
              {s ? <span className="text-mint flex items-center gap-1 text-xs font-semibold"><Check size={13} /> signed</span> : <span className="text-white/40 text-xs">not yet</span>}
            </li>
          );
        })}
      </ul>
      {!signed && (
        <button onClick={sign} disabled={busy} className="btn w-full mt-4 bg-white text-ink hover:bg-white/90">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} I agree, sign the mandate
        </button>
      )}
    </div>
  );
}

function Checks({ policy }: { policy: PolicyResult }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {policy.checks.map((c) => (
        <li key={c.rule} className="flex gap-2 items-start">
          {c.pass ? <Check size={15} className="text-ok mt-0.5 shrink-0" /> : c.severity === "block" ? <ShieldAlert size={15} className="text-warn mt-0.5 shrink-0" /> : <X size={15} className="text-[#7b5cff] mt-0.5 shrink-0" />}
          <span><span className={c.pass ? "text-ink" : "font-semibold text-[#5a3ec8]"}>{c.rule}</span> <span className="text-mute">· {c.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}
