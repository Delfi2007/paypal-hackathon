import { fail, ok } from "@/lib/api";
import { mutate } from "@/lib/store";
import { vote } from "@/lib/agent";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { proposalId, memberId, approve } = (await req.json()) as {
      proposalId: string;
      memberId: string;
      approve: boolean;
    };
    const pr = await mutate(id, async (k) => {
      const m = k.members.find((x) => x.id === memberId);
      if (!m) throw new Error("Unknown member");
      return vote(k, proposalId, m, approve);
    });
    return ok(pr);
  } catch (e) {
    return fail(e);
  }
}
