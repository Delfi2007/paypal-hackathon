import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { hasSubscription, removeSubscription, saveSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await requireUser();
    return ok({ subscribed: await hasSubscription(u.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const { subscription } = (await req.json()) as { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } };
    if (!subscription?.endpoint?.startsWith("https://")) throw new Error("Invalid subscription");
    await saveSubscription(u.id, subscription);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireUser();
    const { endpoint } = (await req.json()) as { endpoint: string };
    await removeSubscription(endpoint);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
