import { fail, needKitty, ok } from "@/lib/api";
import { createOrder } from "@/lib/paypal";
import { convert } from "@/lib/money";

// Create a PayPal order for the signed-in member's outstanding share, in their own currency.
export async function POST(req: Request) {
  try {
    const { kittyId } = (await req.json()) as { kittyId: string };
    const { k, me } = await needKitty(kittyId);
    if (k.status === "closed") throw new Error("This kitty is closed");
    const owedBase = Math.max(0, me.share - me.paid);
    if (owedBase <= 0) throw new Error("Already paid in full");
    const amount = await convert(owedBase, k.baseCurrency, me.currency);
    const order = await createOrder({
      amount,
      currency: me.currency,
      kittyId,
      memberId: me.id,
      description: `${k.name} — ${me.name}'s share`,
    });
    return ok({ ...order, amount, currency: me.currency });
  } catch (e) {
    return fail(e);
  }
}
