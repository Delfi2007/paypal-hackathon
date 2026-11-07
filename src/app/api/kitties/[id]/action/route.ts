import { fail, ok } from "@/lib/api";
import { log, mutate } from "@/lib/store";
import { proposeAction } from "@/lib/agent";
import type { AgentAction } from "@/lib/types";

// Direct, UI-initiated actions (e.g. "pay this bill from the kitty").
// They go through exactly the same policy engine as agent-planned actions.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, actorId, label } = (await req.json()) as { action: AgentAction; actorId: string; label?: string };
    const allowed = ["pay_vendor", "request_contributions", "send_reminders", "amend_mandate"];
    if (!allowed.includes(action?.type)) throw new Error("Unsupported action");
    const out = await mutate(id, async (k) => {
      const actor = k.members.find((m) => m.id === actorId) ?? k.members[0];
      if (label) log(k, { actor: "member", actorName: actor.name, kind: "command", title: label });
      return proposeAction(k, { ...action, reasoning: action.reasoning || `Requested by ${actor.name}` }, actor);
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
