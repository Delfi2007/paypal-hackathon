import { fail, needKitty, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { invoiceStatus } from "@/lib/paypal";
import { recordContribution } from "@/lib/agent";

// Poll PayPal for paid invoices: a backup for webhooks, which cannot reach localhost.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await needKitty(id);
    const updates = await mutate(id, async (k) => {
      let n = 0;
      for (const m of k.members) {
        if (!m.invoiceId || m.paid >= m.share) continue;
        const s = await invoiceStatus(m.invoiceId).catch(() => null);
        if (s && (s.status === "PAID" || s.status === "MARKED_AS_PAID") && s.paid > 0) {
          await recordContribution(k, m, { amount: s.paid, currency: m.currency }, m.invoiceId);
          n++;
        }
      }
      return n;
    });
    return ok({ updates });
  } catch (e) {
    return fail(e);
  }
}
