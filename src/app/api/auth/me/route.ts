import { mode, ok } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { publicUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  return ok({ user: u ? publicUser(u) : null, mode: mode() });
}
