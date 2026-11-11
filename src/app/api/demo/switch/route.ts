import { fail, ok } from "@/lib/api";
import { requireUser, startSession } from "@/lib/auth";
import { demoEnabled, isDemoEmail } from "@/lib/demo";
import { getUserById, HttpError, listKittiesForUser } from "@/lib/store";

export const dynamic = "force-dynamic";

// Demo only: become another friend of the same demo group, to sign, pay or vote as them.
// Works only between demo accounts that share a group; a real account can never be switched into.
export async function POST(req: Request) {
  try {
    if (!demoEnabled()) throw new HttpError(404, "The demo is switched off");
    const me = await requireUser();
    if (!isDemoEmail(me.email)) throw new HttpError(403, "Switching is only for demo accounts");
    const { memberId } = (await req.json()) as { memberId?: string };
    const target = memberId ? await getUserById(memberId) : undefined;
    if (!target || !isDemoEmail(target.email)) throw new HttpError(403, "That is not a demo account");
    const shared = (await listKittiesForUser(me.id)).some((k) => k.members.some((m) => m.id === target.id));
    if (!shared) throw new HttpError(403, "That friend is not in your group");
    await startSession(target.id);
    return ok({ ok: true, name: target.name });
  } catch (e) {
    return fail(e);
  }
}
