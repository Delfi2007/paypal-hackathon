import { fail, needKitty, ok } from "@/lib/api";
import { HttpError, mutate } from "@/lib/store";
import { authorizeHold, captureHold, voidHold } from "@/lib/holds";

// Hold lifecycle: authorize (holder, after PayPal approval) -> capture (organiser) | void (holder or organiser).
export async function POST(req: Request, { params }: { params: Promise<{ id: string; holdId: string }> }) {
  try {
    const { id, holdId } = await params;
    const { me } = await needKitty(id);
    const { action } = (await req.json()) as { action?: "authorize" | "capture" | "void" };
    const out = await mutate(id, (k) => {
      const who = k.members.find((m) => m.id === me.id)!;
      if (action === "authorize") return authorizeHold(k, holdId, who);
      if (action === "capture") return captureHold(k, holdId, who);
      if (action === "void") return voidHold(k, holdId, who, "Released by request");
      throw new HttpError(400, "action must be authorize, capture or void");
    });
    return ok({ hold: out });
  } catch (e) {
    return fail(e);
  }
}
