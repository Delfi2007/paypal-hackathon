import { ok } from "@/lib/api";
import { pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({ key: pushPublicKey() });
}
