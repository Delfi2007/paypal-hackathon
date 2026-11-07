import { fail, mode, needKitty, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok({ kitty: needKitty(id), mode: mode() });
  } catch (e) {
    return fail(e, 404);
  }
}
