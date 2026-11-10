import { fail, needKitty, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { createHold, holdsOf } from "@/lib/holds";

export const dynamic = "force-dynamic";

// GET: the kitty's authorization holds. POST: start a hold for your own share (returns the PayPal approval link).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k } = await needKitty(id);
    return ok({ holds: holdsOf(k) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const origin = new URL(req.url).origin;
    const out = await mutate(id, (k) => {
      const member = k.members.find((m) => m.id === me.id)!;
      return createHold(k, member, { returnUrl: `${origin}/k/${k.id}/holds`, cancelUrl: `${origin}/k/${k.id}/holds` });
    });
    return ok({ hold: out.hold, approveUrl: out.approveUrl, next: out.hold.simulated ? "POST /holds/{id} {action:'authorize'}" : "Open approveUrl as the buyer, approve, then POST /holds/{id} {action:'authorize'}" });
  } catch (e) {
    return fail(e);
  }
}
