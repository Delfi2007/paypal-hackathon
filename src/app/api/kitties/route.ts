import { fail, ok } from "@/lib/api";
import { listKitties, log, putKitty, uid } from "@/lib/store";
import type { KittyDraft } from "@/lib/ai";
import type { Kitty } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  return ok(listKitties().map((k) => ({ id: k.id, name: k.name, destination: k.destination })));
}

// Create a kitty from a reviewed draft.
export async function POST(req: Request) {
  try {
    const { draft, organizer } = (await req.json()) as { draft: KittyDraft; organizer?: string };
    const members = draft.members.map((m, i) => ({
      id: uid("m_"),
      name: m.name,
      email: m.email || `${m.name.toLowerCase().replace(/[^a-z]/g, "")}@personal.example.com`,
      currency: m.currency || draft.baseCurrency,
      share: Math.round((draft.totalBudget / draft.members.length) * 100) / 100,
      paid: 0,
      persona: "new" as const,
      remindersSent: 0,
      avatarHue: (i * 67 + 200) % 360,
      isOrganizer: organizer ? m.name === organizer : i === 0,
    }));
    const vendors = draft.vendors.map((v) => ({
      id: uid("v_"),
      name: v.name,
      email: v.email || `${v.name.toLowerCase().replace(/[^a-z]/g, "")}@business.example.com`,
      category: v.category,
      approved: v.approved,
    }));
    const k: Kitty = {
      id: uid("k_"),
      name: draft.name,
      destination: draft.destination,
      tagline: draft.tagline,
      baseCurrency: draft.baseCurrency,
      createdAt: new Date().toISOString(),
      members,
      vendors: vendors.map(({ approved: _a, ...v }) => v),
      mandate: {
        totalBudget: draft.totalBudget,
        perPaymentCap: draft.perPaymentCap,
        allowedCategories: ["stay", "transport", "food", "activities"],
        approvedPayees: vendors.filter((v) => v.approved).map((v) => v.id),
        quorum: Math.max(1, Math.min(members.length, draft.quorum)),
        deadline: new Date(Date.now() + (draft.deadlineDays || 7) * 86400_000).toISOString().slice(0, 10),
        signedBy: members.map((m) => m.id),
        version: 1,
      },
      proposals: [],
      ledger: [],
      payouts: [],
      bills: [],
      spent: 0,
    };
    log(k, { actor: "agent", kind: "plan", title: `Drafted the ${k.destination} mandate`, detail: `Budget ${draft.totalBudget} ${draft.baseCurrency} · cap ${draft.perPaymentCap} · quorum ${k.mandate.quorum}` });
    log(k, { actor: "member", actorName: members.map((m) => m.name).join(", "), kind: "mandate", title: `Mandate v1 signed by all ${members.length}` });
    putKitty(k);
    return ok({ id: k.id });
  } catch (e) {
    return fail(e);
  }
}
