import { NextResponse } from "next/server";
import type { Kitty, Member, ModeStatus } from "./types";
import { requireUser } from "./auth";
import { getKitty, HttpError, type UserRow } from "./store";
import { paypalConfigured } from "./paypal";
import { AI_MODEL, aiConfigured } from "./ai";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(e: unknown, status?: number) {
  const code = status ?? (e instanceof HttpError ? e.status : 400);
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: code });
}

/** Loads a kitty and checks the signed-in user is one of its members. */
export async function needKitty(id: string): Promise<{ k: Kitty; me: Member; user: UserRow }> {
  const user = await requireUser();
  const k = await getKitty(id);
  if (!k) throw new HttpError(404, "Kitty not found");
  const me = k.members.find((m) => m.id === user.id);
  if (!me) throw new HttpError(403, "You are not a member of this kitty");
  return { k, me, user };
}

export function mode(): ModeStatus {
  return {
    paypal: paypalConfigured() ? "live-sandbox" : "simulated",
    ai: aiConfigured() ? "gemini" : "rules",
    aiModel: aiConfigured() ? AI_MODEL : undefined,
    paypalClientId: paypalConfigured() ? process.env.PAYPAL_CLIENT_ID : undefined,
  };
}
