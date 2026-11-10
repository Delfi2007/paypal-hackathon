import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runTick } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// Trigger the scheduler from any free cron service (cron-job.org, GitHub Actions, Vercel cron):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your.app/api/cron/tick
// In production CRON_SECRET is required. In development it is open so you can try it from a browser.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || req.headers.get("x-cron-secret") || "";
    const a = Buffer.from(got), b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 401 });
  }
  return NextResponse.json(await runTick());
}

export const GET = handle;
export const POST = handle;
