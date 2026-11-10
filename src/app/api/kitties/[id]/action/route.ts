import { fail, needKitty, ok } from "@/lib/api";
import { HttpError, log, mutate } from "@/lib/store";
import { proposeAction } from "@/lib/agent";
import type { AgentAction } from "@/lib/types";

// Direct, UI-initiated actions (keypad, split bill, request shares). They go through
// exactly the same policy engine as agent-planned actions.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const { action, label } = (await req.json()) as { action: AgentAction; label?: string };
    const allowed = ["pay_vendor", "request_contributions", "send_reminders", "amend_mandate", "add_vendor", "record_cash", "refund_member", "void_payout", "drop_member"];
    if (!allowed.includes(action?.type)) throw new Error("Unsupported action");
    // A friend can leave for themselves; only the organiser can remove someone else.
    if (action.type === "drop_member" && action.params?.memberId !== me.id && me.role !== "organizer") throw new HttpError(403, "You can only leave for yourself; the organiser can remove others");
    if (action.type === "record_cash" && me.role !== "organizer") throw new HttpError(403, "Only the organiser can record cash payments");
    const out = await mutate(id, async (k) => {
      const actor = k.members.find((m) => m.id === me.id)!;
      if (label) log(k, { actor: "member", actorName: actor.name, kind: "command", title: label });
      const params = action.type === "record_cash" ? { ...action.params, byName: actor.name } : action.params;
      return proposeAction(k, { ...action, params, reasoning: action.reasoning || `Requested by ${actor.name}` }, actor);
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
