import { mode, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  return ok(mode());
}
