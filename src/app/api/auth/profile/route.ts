import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getUserById, publicUser, updateUser } from "@/lib/store";
import type { Currency } from "@/lib/types";

const CUR = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const b = (await req.json()) as { name?: string; currency?: string; paypalEmail?: string };
    const paypalEmail = (b.paypalEmail ?? "").trim().toLowerCase();
    if (paypalEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail)) throw new Error("PayPal email looks invalid");
    await updateUser(u.id, {
      name: b.name?.trim().slice(0, 60) || undefined,
      currency: CUR.includes(b.currency ?? "") ? (b.currency as Currency) : undefined,
      paypalEmail: b.paypalEmail === undefined ? undefined : paypalEmail || null,
    });
    return ok({ user: publicUser((await getUserById(u.id))!) });
  } catch (e) {
    return fail(e);
  }
}
