import { fail, needKitty, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { vote } from "@/lib/agent";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const { proposalId, approve } = (await req.json()) as { proposalId: string; approve: boolean };
    const pr = await mutate(id, async (k) => vote(k, proposalId, k.members.find((m) => m.id === me.id)!, !!approve));
    return ok(pr);
  } catch (e) {
    return fail(e);
  }
}
