import crypto from "node:crypto";
import { fail, ok } from "@/lib/api";
import { hashPassword, sessionCookie, startSession } from "@/lib/auth";
import { allowDemoStart, DEMO_DOMAIN, DEMO_FRIENDS, demoDraft, demoEnabled } from "@/lib/demo";
import { createUser, getUserByEmail, HttpError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-click demo: builds a ready-made group of three friends through the app's own API (the same
// routes a real group uses), settles two of the three shares, then signs the visitor in as Asha.
export async function POST(req: Request) {
  try {
    if (!demoEnabled()) throw new HttpError(404, "The demo is switched off");
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (!allowDemoStart(ip)) throw new HttpError(429, "Too many demos from this address. Try again in a little while.");

    // Calls go straight back to this server (not out through the public URL).
    const base = process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : new URL(req.url).origin;
    const payee = (process.env.DEMO_PAYPAL_EMAIL ?? process.env.PAYEE_EMAIL ?? "").trim().toLowerCase();
    const tag = crypto.randomBytes(3).toString("hex");

    const users = [];
    for (const f of DEMO_FRIENDS) {
      const email = `${f.name.toLowerCase()}-${tag}${DEMO_DOMAIN}`;
      if (await getUserByEmail(email)) throw new HttpError(409, "Please try again");
      users.push(await createUser({ email, name: f.name, passHash: hashPassword(crypto.randomBytes(18).toString("base64url")), currency: f.currency, paypalEmail: payee || undefined }));
    }
    const [asha, ben, chloe] = users;

    const call = async (userId: string, method: string, url: string, body?: unknown) => {
      const r = await fetch(base + url, { method, headers: { "Content-Type": "application/json", cookie: sessionCookie(userId) }, body: body ? JSON.stringify(body) : undefined });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(String(j.error ?? `${method} ${url} failed (${r.status})`));
      return j;
    };

    const created = (await call(asha.id, "POST", "/api/kitties", { draft: demoDraft(payee || `alfama-villa-${tag}${DEMO_DOMAIN}`) })) as { id: string; inviteCode: string };
    for (const u of [ben, chloe]) {
      await call(u.id, "POST", `/api/join/${created.inviteCode}`);
      await call(u.id, "POST", `/api/kitties/${created.id}/sign`);
    }

    // Real PayPal invoices for everyone's share, then two of the three settle. A PayPal hiccup must not
    // stop the visitor from getting in, so these steps are best-effort.
    try {
      await call(asha.id, "POST", `/api/kitties/${created.id}/action`, { action: { type: "request_contributions", params: {} }, label: "Request everyone's share" });
      for (const u of [asha, ben]) {
        await call(asha.id, "POST", `/api/kitties/${created.id}/action`, { action: { type: "record_cash", params: { memberId: u.id } }, label: `Record ${u.name}'s share as paid` });
      }
    } catch (e) {
      console.error("demo: invoices skipped:", (e as Error).message);
    }

    await startSession(asha.id);
    return ok({ id: created.id });
  } catch (e) {
    return fail(e);
  }
}
