import { fail, ok } from "@/lib/api";
import { currentUser, requireUser } from "@/lib/auth";
import { makeMember } from "@/lib/groups";
import { getKittyByInvite, log, mutate, notify } from "@/lib/store";

export const dynamic = "force-dynamic";

// Public preview of a kitty behind an invite link (no login needed to look).
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const k = await getKittyByInvite(code);
    if (!k) return fail("This invite link is not valid", 404);
    const u = await currentUser();
    return ok({
      id: k.id,
      name: k.name,
      destination: k.destination,
      tagline: k.tagline,
      baseCurrency: k.baseCurrency,
      sharePerMember: k.sharePerMember,
      expectedMembers: k.expectedMembers,
      totalBudget: k.mandate.totalBudget,
      perPaymentCap: k.mandate.perPaymentCap,
      quorum: k.mandate.quorum,
      deadline: k.mandate.deadline,
      members: k.members.map((m) => ({ name: m.name, hue: m.avatarHue, role: m.role })),
      alreadyMember: !!u && k.members.some((m) => m.id === u.id),
      loggedIn: !!u,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireUser();
    const { code } = await params;
    const found = await getKittyByInvite(code);
    if (!found) return fail("This invite link is not valid", 404);
    await mutate(found.id, (k) => {
      if (k.members.some((m) => m.id === user.id)) return;
      if (k.members.length >= 30) throw new Error("This kitty is full");
      const m = makeMember(user, k, "member");
      k.members.push(m);
      log(k, { actor: "member", actorName: m.name, kind: "info", title: `${m.name} joined the kitty`, detail: `Pays in ${m.currency} · share ${k.sharePerMember} ${k.baseCurrency}` });
      notify(k.members.filter((x) => x.id !== m.id).map((x) => x.id), { kittyId: k.id, kind: "join", title: `${m.name} joined ${k.name}`, href: `/k/${k.id}` });
      notify([m.id], { kittyId: k.id, kind: "mandate", title: `Sign the mandate for ${k.name}`, body: "Read the rules and sign so the kitty can start.", href: `/k/${k.id}/approvals` });
    });
    return ok({ id: found.id });
  } catch (e) {
    return fail(e);
  }
}
