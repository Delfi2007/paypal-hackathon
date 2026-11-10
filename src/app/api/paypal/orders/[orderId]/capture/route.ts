import { fail, needKitty, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { captureOrder, orderCustomId } from "@/lib/paypal";
import { assertOrderOwnership } from "@/lib/orderGuard";
import { recordContribution } from "@/lib/agent";
import { convert } from "@/lib/money";

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const { kittyId } = (await req.json()) as { kittyId: string };
    const { me } = await needKitty(kittyId);
    const out = await mutate(kittyId, async (k) => {
      const m = k.members.find((x) => x.id === me.id)!;
      const fallback = { amount: await convert(Math.max(0, m.share - m.paid), k.baseCurrency, m.currency), currency: m.currency };
      // Verify ownership BEFORE capturing, so a member can never capture (or credit) someone else's order.
      assertOrderOwnership(k, me, orderId, await orderCustomId(orderId));
      const cap = await captureOrder(orderId, fallback);
      if (cap.status !== "COMPLETED") throw new Error(`Payment not completed (${cap.status})`);
      m.orderId = orderId;
      if (cap.captureId) m.captureId = cap.captureId;
      await recordContribution(k, m, { amount: cap.amount, currency: cap.currency }, cap.captureId ?? orderId);
      return cap;
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
