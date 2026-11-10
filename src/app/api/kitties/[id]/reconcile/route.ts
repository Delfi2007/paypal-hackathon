import { fail, needKitty, ok } from "@/lib/api";
import { log, mutate } from "@/lib/store";
import { payoutBatchStatus, paypalConfigured } from "@/lib/paypal";
import { toolkitCall } from "@/lib/toolkit";

export const dynamic = "force-dynamic";

interface Row {
  kind: "invoice" | "order" | "payout";
  label: string;
  id: string;
  ours: string;
  paypal: string;
  ok: boolean;
  note?: string;
}

const PAID = new Set(["PAID", "MARKED_AS_PAID", "PARTIALLY_PAID"]);

// "Does PayPal's own record agree with our books?" Reads invoices, orders, payouts and disputes
// straight from PayPal (invoices, orders and disputes through the official Agent Toolkit) and
// compares each with what Kitty recorded.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k } = await needKitty(id);
    if (!paypalConfigured()) return ok({ simulated: true, rows: [], disputes: [], message: "Reconciliation needs PayPal sandbox keys. In simulated mode there is nothing on PayPal's side to compare." });

    const rows: Row[] = [];
    for (const m of k.members) {
      if (m.invoiceId && !m.invoiceId.startsWith("SIM-")) {
        try {
          const inv = await toolkitCall<{ status?: string; amount?: { value?: string; currency_code?: string } }>("get_invoice", { invoice_id: m.invoiceId });
          const ppPaid = PAID.has(String(inv.status));
          const oursPaid = m.paid >= m.share;
          rows.push({ kind: "invoice", label: `${m.name}'s share invoice`, id: m.invoiceId, ours: oursPaid ? "paid" : "owes", paypal: `${inv.status}${inv.amount?.value ? ` · ${inv.amount.value} ${inv.amount.currency_code}` : ""}`, ok: ppPaid === oursPaid, note: ppPaid === oursPaid ? undefined : ppPaid ? "PayPal has it paid; press Sync on the Activity page" : "We recorded it paid but PayPal does not" });
        } catch (e) {
          rows.push({ kind: "invoice", label: `${m.name}'s share invoice`, id: m.invoiceId, ours: m.paid >= m.share ? "paid" : "owes", paypal: "lookup failed", ok: false, note: (e as Error).message.slice(0, 120) });
        }
      }
      if (m.orderId && !m.orderId.startsWith("SIM-")) {
        try {
          const o = await toolkitCall<{ status?: string }>("get_order", { id: m.orderId });
          rows.push({ kind: "order", label: `${m.name}'s checkout`, id: m.orderId, ours: "captured", paypal: String(o.status), ok: o.status === "COMPLETED" });
        } catch (e) {
          rows.push({ kind: "order", label: `${m.name}'s checkout`, id: m.orderId, ours: "captured", paypal: "lookup failed", ok: false, note: (e as Error).message.slice(0, 120) });
        }
      }
    }
    for (const p of k.payouts.slice(0, 8)) {
      if (!p.paypalBatchId || p.paypalBatchId.startsWith("SIM-")) continue;
      try {
        const b = await payoutBatchStatus(p.paypalBatchId);
        const v = k.vendors.find((x) => x.id === p.vendorId);
        rows.push({ kind: "payout", label: `Payout to ${v?.name ?? "vendor"}`, id: p.paypalBatchId, ours: p.status, paypal: b.status, ok: b.status !== "DENIED" && b.status !== "FAILED" && b.status !== "CANCELED", note: b.items[0]?.amount ? `${b.items[0].amount} to ${b.items[0].receiver}` : undefined });
      } catch (e) {
        rows.push({ kind: "payout", label: "Payout", id: p.paypalBatchId, ours: p.status, paypal: "lookup failed", ok: false, note: (e as Error).message.slice(0, 120) });
      }
    }

    let disputes: { id: string; status: string; reason?: string; amount?: string }[] = [];
    try {
      const d = await toolkitCall<{ items?: { dispute_id: string; status: string; reason?: string; dispute_amount?: { value?: string; currency_code?: string } }[] }>("list_disputes", { page_size: 10 });
      disputes = (d.items ?? []).map((x) => ({ id: x.dispute_id, status: x.status, reason: x.reason, amount: x.dispute_amount?.value ? `${x.dispute_amount.value} ${x.dispute_amount.currency_code}` : undefined }));
    } catch {
      /* disputes are optional: the sandbox account may have none, or the scope may be off */
    }

    const bad = rows.filter((r) => !r.ok).length;
    await mutate(id, (kk) => {
      log(kk, { actor: "paypal", kind: "info", title: `Reconciled with PayPal: ${rows.length} record(s) checked, ${bad} mismatch${bad === 1 ? "" : "es"}`, detail: `Read through PayPal's official Agent Toolkit (read-only). ${disputes.length} open dispute(s).` });
    });
    return ok({ simulated: false, via: "@paypal/agent-toolkit", checkedAt: new Date().toISOString(), rows, disputes });
  } catch (e) {
    return fail(e);
  }
}
