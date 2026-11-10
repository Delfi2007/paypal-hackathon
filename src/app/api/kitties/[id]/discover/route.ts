import { fail, needKitty, ok } from "@/lib/api";
import { channel3Configured, discover } from "@/lib/channel3";

export const dynamic = "force-dynamic";

// GET /api/kitties/{id}/discover?q=beach+villa+lisbon  ->  real products/merchants priced in the kitty's currency,
// each screened by the injection guard. Members then add a payee and propose the payment as usual.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k } = await needKitty(id);
    if (!channel3Configured()) return ok({ enabled: false, message: "Set CHANNEL3_API_KEY to turn on product discovery (free at trychannel3.com)", suggestions: [], quarantined: [] });
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const out = await discover(q, k.baseCurrency, k.mandate.perPaymentCap);
    return ok({ enabled: true, baseCurrency: k.baseCurrency, perPaymentCap: k.mandate.perPaymentCap, ...out });
  } catch (e) {
    return fail(e);
  }
}
