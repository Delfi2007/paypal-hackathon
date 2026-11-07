import { NextResponse } from "next/server";
import type { Kitty, ModeStatus } from "./types";
import { getKitty } from "./store";
import { paypalConfigured } from "./paypal";
import { AI_MODEL, aiConfigured } from "./ai";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(e: unknown, status = 400) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status });
}

export function needKitty(id: string): Kitty {
  const k = getKitty(id);
  if (!k) throw new Error("Kitty not found");
  return k;
}

export function mode(): ModeStatus {
  return {
    paypal: paypalConfigured() ? "live-sandbox" : "simulated",
    ai: aiConfigured() ? "gemini" : "rules",
    aiModel: aiConfigured() ? AI_MODEL : undefined,
    paypalClientId: paypalConfigured() ? process.env.PAYPAL_CLIENT_ID : undefined,
  };
}
