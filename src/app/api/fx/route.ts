import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { convert } from "@/lib/money";
import type { Currency } from "@/lib/types";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const amount = Number(p.get("amount") ?? 0);
  const from = (p.get("from") ?? "USD") as Currency;
  const to = (p.get("to") ?? "USD") as Currency;
  return ok({ amount: await convert(amount, from, to), from, to });
}
