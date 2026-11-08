import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await requireUser();
    const items = await listNotifications(u.id);
    return ok({ items, unread: items.filter((n) => !n.read).length });
  } catch (e) {
    return fail(e);
  }
}

export async function POST() {
  try {
    const u = await requireUser();
    await markNotificationsRead(u.id);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
