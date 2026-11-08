import { fail, mode, needKitty, ok } from "@/lib/api";
import { verifyChain } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k, me, user } = await needKitty(id);
    return ok({
      kitty: k,
      mode: mode(),
      me: me.id,
      user: { id: user.id, name: user.name, email: user.email, paypalEmail: user.paypalEmail, currency: user.currency, hue: user.hue },
      chain: verifyChain(k),
    });
  } catch (e) {
    return fail(e);
  }
}
