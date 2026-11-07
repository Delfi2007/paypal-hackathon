import { fail, needKitty, ok } from "@/lib/api";
import { createOrder } from "@/lib/paypal";
import { convert } from "@/lib/money";

// Create a PayPal order for a member's outstanding share, in their own currency.
export async function POST(req: Request) {
  try {
    const { kittyId, memberId } = (await req.json()) as { kittyId: string; memberId: string };
    const k = needKitty(kittyId);
    const m = k.members.find((x) => x.id === memberId);
    if (!m) throw new Error("Unknown member");
    const owedBase = Math.max(0, m.share - m.paid);
    if (owedBase <= 0) throw new Error("Already paid in full");
    const amount = await convert(owedBase, k.baseCurrency, m.currency);
    const order = await createOrder({
      amount,
      currency: m.currency,
      kittyId,
      memberId,
      description: `${k.name} — ${m.name}'s share`,
    });
    return ok({ ...order, amount, currency: m.currency });
  } catch (e) {
    return fail(e);
  }
}
