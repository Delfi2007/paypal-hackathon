import { fail, needKitty, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { runCommand } from "@/lib/agent";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) throw new Error("Say something to your treasurer");
    const out = await mutate(id, async (k) => runCommand(k, text.trim().slice(0, 600), k.members.find((m) => m.id === me.id)!));
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
