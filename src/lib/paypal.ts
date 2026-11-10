// Thin PayPal REST client (sandbox). Uses Orders v2 for member contributions,
// Invoicing v2 for emailed payment requests, and Payouts v1 for paying vendors.
// When no credentials are configured, every call is simulated so the app
// still runs end-to-end for judges without keys.

import type { Currency } from "./types";

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

export function paypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.exp) return token.value;
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal auth failed (${r.status}): ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return token.value;
}

async function pp<T>(path: string, init: RequestInit & { json?: unknown; requestId?: string } = {}): Promise<T> {
  const t = await accessToken();
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Idempotency: PayPal returns the original response for a repeated key instead of acting twice.
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId.slice(0, 108) } : {}),
      ...(init.headers || {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = text;
    try {
      const e = JSON.parse(text);
      msg = e.message || e.name || text;
      const d = e.details?.[0];
      if (d) msg += ` — ${[d.field, d.issue, d.description].filter(Boolean).join(": ")}`;
    } catch {}
    throw new Error(`PayPal ${init.method || "GET"} ${path} → ${r.status}: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const sim = (p: string) => `SIM-${p}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
export const money = (v: number, c: Currency) => ({
  currency_code: c,
  value: c === "JPY" ? Math.round(v).toString() : v.toFixed(2),
});

// ---------- Orders (member pays their share with PayPal Checkout) ----------

export async function createOrder(opts: {
  amount: number;
  currency: Currency;
  kittyId: string;
  memberId: string;
  description: string;
}): Promise<{ id: string; simulated: boolean }> {
  if (!paypalConfigured()) return { id: sim("ORDER"), simulated: true };
  const j = await pp<{ id: string }>("/v2/checkout/orders", {
    method: "POST",
    json: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.memberId,
          custom_id: `${opts.kittyId}:${opts.memberId}`,
          description: opts.description.slice(0, 127),
          amount: money(opts.amount, opts.currency),
        },
      ],
    },
  });
  return { id: j.id, simulated: false };
}

export interface CaptureResult {
  id: string;
  status: string;
  captureId?: string;
  amount: number;
  currency: Currency;
  customId?: string;
  payerEmail?: string;
}

export async function captureOrder(orderId: string, fallback: { amount: number; currency: Currency }): Promise<CaptureResult> {
  if (!paypalConfigured() || orderId.startsWith("SIM-"))
    return { id: orderId, status: "COMPLETED", captureId: sim("CAP"), ...fallback };
  type Cap = {
    id: string;
    status: string;
    payer?: { email_address?: string };
    purchase_units: {
      payments: { captures: { id: string; amount: { value: string; currency_code: Currency }; custom_id?: string }[] };
    }[];
  };
  const j = await pp<Cap>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", json: {}, requestId: `cap-${orderId}` });
  const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    id: j.id,
    status: j.status,
    captureId: cap?.id,
    amount: cap ? Number(cap.amount.value) : fallback.amount,
    currency: cap?.amount.currency_code ?? fallback.currency,
    customId: cap?.custom_id,
    payerEmail: j.payer?.email_address,
  };
}

// ---------- Invoicing (emailed payment request) ----------

export async function createAndSendInvoice(opts: {
  email: string;
  name: string;
  amount: number;
  currency: Currency;
  itemName: string;
  note: string;
  dueDate: string; // YYYY-MM-DD
  idemKey?: string;
}): Promise<{ id: string; url?: string; simulated: boolean; status: string }> {
  if (!paypalConfigured()) return { id: sim("INV"), simulated: true, status: "SENT" };
  const today = new Date().toISOString().slice(0, 10);
  const due = opts.dueDate >= today ? opts.dueDate : today;
  type Inv = { id: string; status: string; detail?: { metadata?: { recipient_view_url?: string } } };
  const draft = await pp<Inv>("/v2/invoicing/invoices", {
    method: "POST",
    requestId: opts.idemKey ? `inv-${opts.idemKey}` : undefined,
    json: {
      detail: {
        currency_code: opts.currency,
        note: opts.note.slice(0, 4000),
        invoice_date: today,
        payment_term: { term_type: "DUE_ON_DATE_SPECIFIED", due_date: due },
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: opts.name },
            email_address: opts.email,
          },
        },
      ],
      items: [
        {
          name: opts.itemName.slice(0, 200),
          quantity: "1",
          unit_amount: money(opts.amount, opts.currency),
        },
      ],
    },
  });
  await pp(`/v2/invoicing/invoices/${draft.id}/send`, {
    method: "POST",
    requestId: `send-${draft.id}`,
    json: { send_to_recipient: true, send_to_invoicer: false },
  });
  const sent = await pp<Inv>(`/v2/invoicing/invoices/${draft.id}`);
  return {
    id: draft.id,
    simulated: false,
    status: sent.status,
    url: sent.detail?.metadata?.recipient_view_url,
  };
}

export async function invoiceStatus(id: string): Promise<{ status: string; paid: number }> {
  if (!paypalConfigured() || id.startsWith("SIM-")) return { status: "SENT", paid: 0 };
  type Inv = { status: string; payments?: { paid_amount?: { value: string } } };
  const j = await pp<Inv>(`/v2/invoicing/invoices/${id}`);
  return { status: j.status, paid: Number(j.payments?.paid_amount?.value ?? 0) };
}

/** Record a payment made outside PayPal (cash, bank transfer) against an invoice, so PayPal marks it paid. */
export async function recordInvoicePayment(id: string, amount: number, currency: Currency, note: string) {
  if (!paypalConfigured() || id.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/invoicing/invoices/${id}/payments`, {
    method: "POST",
    json: {
      method: "CASH",
      payment_date: new Date().toISOString().slice(0, 10),
      note: note.slice(0, 2000),
      amount: money(amount, currency),
    },
  });
  return { simulated: false };
}

export async function remindInvoice(id: string, subject: string, note: string) {
  if (!paypalConfigured() || id.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/invoicing/invoices/${id}/remind`, {
    method: "POST",
    json: { subject: subject.slice(0, 4000), note: note.slice(0, 4000), send_to_invoicer: false },
  });
  return { simulated: false };
}

// ---------- Payouts (pay vendors from the pool) ----------

export async function payout(opts: {
  email: string;
  amount: number;
  currency: Currency;
  note: string;
  ref: string;
  /** Stable key for this logical payment: a retry with the same key can never pay twice. */
  idemKey: string;
}): Promise<{ batchId: string; status: string; simulated: boolean }> {
  if (!paypalConfigured()) return { batchId: sim("PAYOUT"), status: "SUCCESS", simulated: true };
  type P = { batch_header: { payout_batch_id: string; batch_status: string } };
  const j = await pp<P>("/v1/payments/payouts", {
    method: "POST",
    requestId: opts.idemKey,
    json: {
      sender_batch_header: {
        sender_batch_id: opts.idemKey.slice(0, 30),
        email_subject: "You have a payment from a Kitty group",
        email_message: opts.note.slice(0, 1000),
      },
      items: [
        {
          recipient_type: "EMAIL",
          // Payouts v1 spells the field "currency" (Orders/Invoicing use "currency_code").
          amount: { value: money(opts.amount, opts.currency).value, currency: opts.currency },
          receiver: opts.email,
          note: opts.note.slice(0, 4000),
          sender_item_id: opts.ref,
        },
      ],
    },
  });
  return { batchId: j.batch_header.payout_batch_id, status: j.batch_header.batch_status, simulated: false };
}

// ---------- Payout lifecycle: look up the item, cancel it while unclaimed ----------

export type PayoutItemInfo = { itemId?: string; status: string; batchStatus: string };

/** Reads a payout batch from PayPal: the single item's id and live status. */
export async function payoutStatus(batchId: string): Promise<PayoutItemInfo> {
  if (!paypalConfigured() || batchId.startsWith("SIM-")) return { itemId: undefined, status: "SUCCESS", batchStatus: "SUCCESS" };
  type B = { batch_header: { batch_status: string }; items?: { payout_item_id: string; transaction_status: string }[] };
  const j = await pp<B>(`/v1/payments/payouts/${batchId}`);
  const it = j.items?.[0];
  return { itemId: it?.payout_item_id, status: it?.transaction_status ?? j.batch_header.batch_status, batchStatus: j.batch_header.batch_status };
}

/** Cancels a payout that the recipient has not claimed yet (PayPal only allows UNCLAIMED items). */
export async function cancelPayoutItem(itemId: string): Promise<{ status: string; simulated: boolean }> {
  if (!paypalConfigured() || itemId.startsWith("SIM-")) return { status: "RETURNED", simulated: true };
  const j = await pp<{ transaction_status?: string }>(`/v1/payments/payouts-item/${itemId}/cancel`, { method: "POST", requestId: `cancel-${itemId}` });
  return { status: j.transaction_status ?? "RETURNED", simulated: false };
}

// ---------- Refunds ----------

/** Refunds (part of) a captured PayPal payment back to the payer. Idempotent per `idemKey`. */
export async function refundCapture(opts: {
  captureId: string;
  amount: number;
  currency: Currency;
  note: string;
  idemKey: string;
}): Promise<{ id: string; status: string; simulated: boolean }> {
  if (!paypalConfigured() || opts.captureId.startsWith("SIM-")) return { id: sim("REFUND"), status: "COMPLETED", simulated: true };
  const j = await pp<{ id: string; status: string }>(`/v2/payments/captures/${opts.captureId}/refund`, {
    method: "POST",
    requestId: `refund-${opts.idemKey}`,
    json: { amount: money(opts.amount, opts.currency), note_to_payer: opts.note.slice(0, 255) },
  });
  return { id: j.id, status: j.status, simulated: false };
}

/** Cancels an unpaid invoice (used when a friend drops out before paying). */
export async function cancelInvoice(id: string, note: string) {
  if (!paypalConfigured() || id.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/invoicing/invoices/${id}/cancel`, { method: "POST", json: { subject: "Invoice cancelled", note: note.slice(0, 1000), send_to_invoicer: false, send_to_recipient: false } });
  return { simulated: false };
}

/** Records a refund against an invoice that was paid outside PayPal Checkout (cash / manual). */
export async function refundInvoice(id: string, amount: number, currency: Currency, idemKey: string) {
  if (!paypalConfigured() || id.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/invoicing/invoices/${id}/refunds`, {
    method: "POST",
    requestId: `invrefund-${idemKey}`,
    json: { method: "CASH", refund_date: new Date().toISOString().slice(0, 10), amount: money(amount, currency) },
  });
  return { simulated: false };
}

// ---------- Holds: authorize now, capture or void later (Orders v2 intent=AUTHORIZE) ----------

export async function createHoldOrder(opts: {
  amount: number;
  currency: Currency;
  kittyId: string;
  memberId: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl?: string; simulated: boolean }> {
  if (!paypalConfigured()) return { id: sim("HOLD"), simulated: true };
  type O = { id: string; links?: { rel: string; href: string }[] };
  const j = await pp<O>("/v2/checkout/orders", {
    method: "POST",
    json: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: opts.memberId,
          custom_id: `${opts.kittyId}:${opts.memberId}`,
          description: opts.description.slice(0, 127),
          amount: money(opts.amount, opts.currency),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: { return_url: opts.returnUrl, cancel_url: opts.cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" },
        },
      },
    },
  });
  const link = j.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
  return { id: j.id, approveUrl: link?.href, simulated: false };
}

export async function authorizeOrder(orderId: string): Promise<{ authorizationId: string; status: string; simulated: boolean }> {
  if (!paypalConfigured() || orderId.startsWith("SIM-")) return { authorizationId: sim("AUTH"), status: "CREATED", simulated: true };
  type A = { purchase_units: { payments: { authorizations: { id: string; status: string }[] } }[] };
  const j = await pp<A>(`/v2/checkout/orders/${orderId}/authorize`, { method: "POST", json: {}, requestId: `auth-${orderId}` });
  const a = j.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!a) throw new Error("PayPal did not return an authorization");
  return { authorizationId: a.id, status: a.status, simulated: false };
}

export async function captureAuthorization(authId: string, amount: number, currency: Currency): Promise<{ captureId: string; status: string; simulated: boolean }> {
  if (!paypalConfigured() || authId.startsWith("SIM-")) return { captureId: sim("CAP"), status: "COMPLETED", simulated: true };
  const j = await pp<{ id: string; status: string }>(`/v2/payments/authorizations/${authId}/capture`, {
    method: "POST",
    requestId: `acap-${authId}`,
    json: { amount: money(amount, currency), final_capture: true },
  });
  return { captureId: j.id, status: j.status, simulated: false };
}

export async function voidAuthorization(authId: string): Promise<{ simulated: boolean }> {
  if (!paypalConfigured() || authId.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/payments/authorizations/${authId}/void`, { method: "POST", requestId: `void-${authId}` });
  return { simulated: false };
}

/** Renews an authorization after its 3-day honor period so the hold stays valid. */
export async function reauthorize(authId: string, amount: number, currency: Currency): Promise<{ simulated: boolean }> {
  if (!paypalConfigured() || authId.startsWith("SIM-")) return { simulated: true };
  await pp(`/v2/payments/authorizations/${authId}/reauthorize`, { method: "POST", requestId: `reauth-${authId}-${Date.now().toString(36).slice(0, 6)}`, json: { amount: money(amount, currency) } });
  return { simulated: false };
}

// ---------- Webhooks ----------

export async function verifyWebhook(headers: Headers, body: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!paypalConfigured() || !webhookId) return false;
  try {
    const j = await pp<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      json: {
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: body,
      },
    });
    return j.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
export const paypalAccessToken = () => accessToken();

/** Current status of a payout batch (PENDING, SUCCESS, DENIED...). */
export async function payoutBatchStatus(batchId: string): Promise<{ status: string; items: { status: string; receiver?: string; amount?: string }[] }> {
  if (!paypalConfigured() || batchId.startsWith("SIM-")) return { status: "SUCCESS", items: [] };
  type B = { batch_header: { batch_status: string }; items?: { transaction_status?: string; payout_item?: { receiver?: string; amount?: { value?: string } } }[] };
  const j = await pp<B>(`/v1/payments/payouts/${batchId}`);
  return { status: j.batch_header.batch_status, items: (j.items ?? []).map((i) => ({ status: i.transaction_status ?? "", receiver: i.payout_item?.receiver, amount: i.payout_item?.amount?.value })) };
}
