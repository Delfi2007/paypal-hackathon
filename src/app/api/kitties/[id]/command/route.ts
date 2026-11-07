import { fail, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { runCommand } from "@/lib/agent";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { text, actorId } = (await req.json()) as { text: string; actorId: string };
    if (!text?.trim()) throw new Error("Say something to your treasurer");
    const out = await mutate(id, async (k) => {
      const actor = k.members.find((m) => m.id === actorId) ?? k.members[0];
      return runCommand(k, text.trim().slice(0, 600), actor);
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
