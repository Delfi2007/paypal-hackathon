import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { makeMember } from "@/lib/groups";
import * as guard from "@/lib/guard";
import { mandateMessage, signAsServer } from "@/lib/signing";
import { inviteCode, listKittiesForUser, log, putKitty, uid } from "@/lib/store";
import type { KittyDraft } from "@/lib/ai";
import type { Kitty } from "@/lib/types";
import { poolBalance } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await requireUser();
    const ks = await listKittiesForUser(u.id);
    return ok(
      ks.map((k) => ({
        id: k.id,
        name: k.name,
        destination: k.destination,
        tagline: k.tagline,
        baseCurrency: k.baseCurrency,
        members: k.members.length,
        expectedMembers: k.expectedMembers,
        status: k.status,
        pool: poolBalance(k),
        pending: k.proposals.filter((p) => p.status === "pending").length,
        needsSign: !k.mandate.signedBy.includes(u.id),
      })),
    );
  } catch (e) {
    return fail(e);
  }
}

// Create a real group from a reviewed draft. The creator is the first member and signs the mandate.
export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const { draft } = (await req.json()) as { draft: KittyDraft };
    const expected = Math.max(2, Math.min(30, draft.members?.length || 2));
    const total = Math.max(1, Number(draft.totalBudget) || 0);
    const k: Kitty = {
      id: uid("k_"),
      createdBy: u.id,
      inviteCode: inviteCode(),
      status: "forming",
      sharePerMember: Math.round((total / expected) * 100) / 100,
      expectedMembers: expected,
      name: String(draft.name || "New kitty").slice(0, 80),
      destination: String(draft.destination || "").slice(0, 80),
      tagline: String(draft.tagline || "Good friends, clear money.").slice(0, 120),
      baseCurrency: draft.baseCurrency,
      createdAt: new Date().toISOString(),
      members: [],
      vendors: [],
      mandate: {
        totalBudget: total,
        perPaymentCap: Math.max(1, Number(draft.perPaymentCap) || Math.round(total / 3)),
        allowedCategories: ["stay", "transport", "food", "activities"],
        approvedPayees: [],
        quorum: Math.max(1, Math.min(expected, Number(draft.quorum) || Math.floor(expected / 2) + 1)),
        deadline: new Date(Date.now() + (Number(draft.deadlineDays) || 7) * 86400_000).toISOString().slice(0, 10),
        signedBy: [u.id],
        version: 1,
      },
      proposals: [],
      ledger: [],
      payouts: [],
      bills: [],
      spent: 0,
    };
    k.members.push(makeMember(u, k, "organizer"));
    for (const v of draft.vendors ?? []) {
      const id = uid("v_");
      const bad = guard.scanFields({ name: v.name, email: v.email, category: v.category });
      k.vendors.push({
        id,
        name: bad?.field === "name" ? "[removed by guard]" : guard.sanitize(String(v.name), 60),
        email: v.email || "",
        category: v.category,
        addedBy: u.id,
        quarantined: bad ? { reason: `${bad.field}: ${guard.reason(bad.verdict)}`, at: new Date().toISOString() } : undefined,
      });
      if (bad) log(k, { actor: "policy", kind: "policy", title: "Guard quarantined a payee in the draft", detail: guard.reason(bad.verdict) });
      else if (v.approved) k.mandate.approvedPayees.push(id);
    }
    log(k, { actor: "agent", kind: "plan", title: `Drafted the ${k.name} mandate`, detail: `Budget ${total} ${k.baseCurrency} · cap ${k.mandate.perPaymentCap} · quorum ${k.mandate.quorum} · ${expected} friends` });
    log(k, { actor: "member", actorName: u.name, kind: "mandate", title: `${u.name} created the kitty and signed mandate v1`, detail: `Share per friend ${k.sharePerMember} ${k.baseCurrency}. Waiting for ${k.mandate.quorum - 1} more signature(s).` });
    // The creator's signature is a real Ed25519 signature over this exact mandate version.
    const sig = await signAsServer(u.id, mandateMessage(k, k.mandate, u.id));
    k.mandate.signatures = [{ memberId: u.id, ...sig, version: k.mandate.version, signedAt: new Date().toISOString(), custody: "server" }];
    await putKitty(k);
    return ok({ id: k.id, inviteCode: k.inviteCode });
  } catch (e) {
    return fail(e);
  }
}
