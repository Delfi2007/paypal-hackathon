import { fail, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { captureOrder } from "@/lib/paypal";
import { recordContribution } from "@/lib/agent";
import { convert } from "@/lib/money";

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const { kittyId, memberId } = (await req.json()) as { kittyId: string; memberId: string };
    const out = await mutate(kittyId, async (k) => {
      const m = k.members.find((x) => x.id === memberId);
      if (!m) throw new Error("Unknown member");
      const fallback = { amount: await convert(Math.max(0, m.share - m.paid), k.baseCurrency, m.currency), currency: m.currency };
      const cap = await captureOrder(orderId, fallback);
      if (cap.status !== "COMPLETED") throw new Error(`Payment not completed (${cap.status})`);
      m.orderId = orderId;
      await recordContribution(k, m, { amount: cap.amount, currency: cap.currency }, cap.captureId ?? orderId);
      return cap;
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
