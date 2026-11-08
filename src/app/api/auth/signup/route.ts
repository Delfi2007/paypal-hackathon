import { fail, ok } from "@/lib/api";
import { hashPassword, startSession } from "@/lib/auth";
import { createUser, getUserByEmail, publicUser } from "@/lib/store";
import type { Currency } from "@/lib/types";

const CUR = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { name?: string; email?: string; password?: string; currency?: string; paypalEmail?: string };
    const name = (b.name ?? "").trim().slice(0, 60);
    const email = (b.email ?? "").trim().toLowerCase();
    if (name.length < 2) throw new Error("Please enter your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address");
    if ((b.password ?? "").length < 8) throw new Error("Password must be at least 8 characters");
    const currency = (CUR.includes(b.currency ?? "") ? b.currency : "USD") as Currency;
    const paypalEmail = (b.paypalEmail ?? "").trim().toLowerCase();
    if (paypalEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail)) throw new Error("PayPal email looks invalid");
    if (await getUserByEmail(email)) return fail("An account with this email already exists. Try logging in.", 409);
    const u = await createUser({ email, name, passHash: hashPassword(b.password!), currency, paypalEmail: paypalEmail || undefined });
    await startSession(u.id);
    return ok({ user: publicUser(u) });
  } catch (e) {
    return fail(e);
  }
}
