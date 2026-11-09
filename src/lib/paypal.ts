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

async function pp<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const t = await accessToken();
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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
      if (e.details?.[0]?.description) msg += ` — ${e.details[0].description}`;
    } catch {}
    throw new Error(`PayPal ${init.method || "GET"} ${path} → ${r.status}: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const sim = (p: string) => `SIM-${p}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const money = (v: number, c: Currency) => ({
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

/** The custom_id Kitty stamped on the order when it was created ("kittyId:memberId"). Undefined for simulated orders. */
export async function orderCustomId(orderId: string): Promise<string | undefined> {
  if (!paypalConfigured() || orderId.startsWith("SIM-")) return undefined;
  type O = { purchase_units?: { custom_id?: string }[] };
  const j = await pp<O>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  return j.purchase_units?.[0]?.custom_id;
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
  const j = await pp<Cap>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", json: {} });
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
}): Promise<{ id: string; url?: string; simulated: boolean; status: string }> {
  if (!paypalConfigured()) return { id: sim("INV"), simulated: true, status: "SENT" };
  const today = new Date().toISOString().slice(0, 10);
  const due = opts.dueDate >= today ? opts.dueDate : today;
  type Inv = { id: string; status: string; detail?: { metadata?: { recipient_view_url?: string } } };
  const draft = await pp<Inv>("/v2/invoicing/invoices", {
    method: "POST",
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
  /** Stable idempotency key for this payment (e.g. kitty id + proposal id). Retrying with the same key never pays twice. */
  ref: string;
}): Promise<{ batchId: string; status: string; simulated: boolean }> {
  if (!paypalConfigured()) return { batchId: sim("PAYOUT"), status: "SUCCESS", simulated: true };
  type P = { batch_header: { payout_batch_id: string; batch_status: string } };
  const batchKey = `kitty-${opts.ref}`.slice(0, 100); // PayPal-Request-Id allows up to 108 chars
  const j = await pp<P>("/v1/payments/payouts", {
    method: "POST",
    // PayPal-Request-Id makes the call idempotent: a retry returns the original batch instead of paying again.
    headers: { "PayPal-Request-Id": batchKey },
    json: {
      sender_batch_header: {
        sender_batch_id: batchKey,
        email_subject: "You have a payment from a Kitty group",
        email_message: opts.note.slice(0, 1000),
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: money(opts.amount, opts.currency).value, currency: opts.currency },
          receiver: opts.email,
          note: opts.note.slice(0, 4000),
          sender_item_id: opts.ref.slice(-30), // keeps the unique tail (proposal id) within PayPal's id length
        },
      ],
    },
  });
  return { batchId: j.batch_header.payout_batch_id, status: j.batch_header.batch_status, simulated: false };
}

/**
 * Pay several people in ONE Payouts batch (used for trip close-out refunds). Amounts are in each
 * recipient's own currency. `ref` is the idempotency key: a retry returns the original batch.
 */
export async function payoutBatch(opts: {
  ref: string;
  subject: string;
  items: { email: string; amount: number; currency: Currency; note: string; itemId: string }[];
}): Promise<{ batchId: string; status: string; simulated: boolean }> {
  if (!paypalConfigured()) return { batchId: sim("PAYOUT"), status: "SUCCESS", simulated: true };
  type P = { batch_header: { payout_batch_id: string; batch_status: string } };
  const batchKey = `kitty-${opts.ref}`.slice(0, 100);
  const j = await pp<P>("/v1/payments/payouts", {
    method: "POST",
    headers: { "PayPal-Request-Id": batchKey },
    json: {
      sender_batch_header: {
        sender_batch_id: batchKey,
        email_subject: opts.subject.slice(0, 255),
        email_message: "Your share of the leftover kitty, returned at trip close-out.",
      },
      items: opts.items.map((i) => ({
        recipient_type: "EMAIL",
        amount: { value: money(i.amount, i.currency).value, currency: i.currency },
        receiver: i.email,
        note: i.note.slice(0, 4000),
        sender_item_id: i.itemId.slice(-30),
      })),
    },
  });
  return { batchId: j.batch_header.payout_batch_id, status: j.batch_header.batch_status, simulated: false };
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
