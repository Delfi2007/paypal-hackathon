import { ok } from "@/lib/api";
import { verifyWebhook } from "@/lib/paypal";
import { findKittyContaining, log, mutate } from "@/lib/store";
import { recordContribution } from "@/lib/agent";
import type { Currency } from "@/lib/types";

// PayPal webhook receiver. Subscribed events: INVOICING.INVOICE.PAID, PAYMENT.PAYOUTS-ITEM.*
// Signatures are verified with PayPal's verify-webhook-signature API before anything changes.
export async function POST(req: Request) {
  const body = await req.json();
  const verified = await verifyWebhook(req.headers, body);
  if (!verified) return ok({ ignored: true, reason: "signature not verified" });

  const type = String(body.event_type ?? "");
  if (type === "INVOICING.INVOICE.PAID") {
    const inv = body.resource?.invoice ?? body.resource;
    const invoiceId = inv?.id as string | undefined;
    const paid = Number(inv?.payments?.paid_amount?.value ?? inv?.amount?.value ?? 0);
    const currency = (inv?.payments?.paid_amount?.currency_code ?? inv?.detail?.currency_code) as Currency;
    if (invoiceId) {
      const found = await findKittyContaining(invoiceId);
      const m = found?.members.find((x) => x.invoiceId === invoiceId);
      if (found && m && m.paid < m.share) {
        await mutate(found.id, (k) => {
          const mm = k.members.find((x) => x.id === m.id)!;
          log(k, { actor: "paypal", kind: "info", title: "Webhook received: INVOICING.INVOICE.PAID", detail: `Invoice ${invoiceId}` });
          return recordContribution(k, mm, { amount: paid, currency: currency || mm.currency }, invoiceId);
        });
      }
    }
  } else if (type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const batchId = body.resource?.payout_batch_id as string | undefined;
    if (batchId) {
      const found = await findKittyContaining(batchId);
      if (found)
        await mutate(found.id, (k) => {
          if (k.closeOut?.paypalBatchId === batchId) {
            k.closeOut.status = String(body.resource?.transaction_status ?? type.split(".").pop());
            log(k, { actor: "paypal", kind: "payout", title: `Webhook received: refund ${k.closeOut.status}`, ref: batchId });
            return;
          }
          const p = k.payouts.find((x) => x.paypalBatchId === batchId);
          if (!p) return;
          p.status = String(body.resource?.transaction_status ?? type.split(".").pop());
          log(k, { actor: "paypal", kind: "payout", title: `Webhook received: payout ${p.status}`, ref: batchId });
        });
    }
  }
  return ok({ received: true });
}
