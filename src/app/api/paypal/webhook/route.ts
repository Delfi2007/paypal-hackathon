import { ok } from "@/lib/api";
import { verifyWebhook } from "@/lib/paypal";
import { listKitties, mutate, log } from "@/lib/store";
import { recordContribution } from "@/lib/agent";
import type { Currency } from "@/lib/types";

// PayPal webhook receiver. Subscribe to INVOICING.INVOICE.PAID and
// PAYMENT.PAYOUTS-ITEM.* in the developer dashboard and set PAYPAL_WEBHOOK_ID.
export async function POST(req: Request) {
  const body = await req.json();
  const verified = await verifyWebhook(req.headers, body);
  if (!verified) return ok({ ignored: true, reason: "signature not verified" }, 200);

  const type = String(body.event_type ?? "");
  if (type === "INVOICING.INVOICE.PAID") {
    const inv = body.resource?.invoice ?? body.resource;
    const invoiceId = inv?.id as string | undefined;
    const paid = Number(inv?.payments?.paid_amount?.value ?? inv?.amount?.value ?? 0);
    const currency = (inv?.payments?.paid_amount?.currency_code ?? inv?.detail?.currency_code) as Currency;
    for (const k of listKitties()) {
      const m = k.members.find((x) => x.invoiceId === invoiceId);
      if (m && m.paid < m.share) {
        await mutate(k.id, (kk) => recordContribution(kk, kk.members.find((x) => x.id === m.id)!, { amount: paid, currency: currency || m.currency }, invoiceId!));
      }
    }
  } else if (type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const batchId = body.resource?.payout_batch_id;
    for (const k of listKitties()) {
      const po = k.payouts.find((p) => p.paypalBatchId === batchId);
      if (po)
        await mutate(k.id, (kk) => {
          const p = kk.payouts.find((x) => x.id === po.id)!;
          p.status = String(body.resource?.transaction_status ?? type.split(".").pop());
          log(kk, { actor: "paypal", kind: "payout", title: `Payout update: ${p.status}`, ref: batchId });
        });
    }
  }
  return ok({ received: true });
}
