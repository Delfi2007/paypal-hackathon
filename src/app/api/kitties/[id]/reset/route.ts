import { fail, ok } from "@/lib/api";
import { DEMO_ID, resetDemo } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== DEMO_ID) return fail("Only the demo kitty can be reset");
  resetDemo();
  return ok({ reset: true });
}
