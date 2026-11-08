import { cookies, headers } from "next/headers";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createApiToken, deleteApiToken, HttpError, listApiTokens } from "@/lib/store";

export const dynamic = "force-dynamic";

// Tokens can only be managed from a logged-in browser session, never with another token.
async function browserUser() {
  if ((await headers()).get("authorization")) throw new HttpError(403, "Manage tokens from the website, not with a token");
  const u = await requireUser();
  if (!(await cookies()).get("kitty_session")) throw new HttpError(403, "Manage tokens from the website");
  return u;
}

export async function GET() {
  try {
    const u = await browserUser();
    return ok({ tokens: await listApiTokens(u.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const u = await browserUser();
    const { name } = (await req.json()) as { name?: string };
    const t = await createApiToken(u.id, (name ?? "My AI agent").trim().slice(0, 60) || "My AI agent");
    return ok({ id: t.id, token: t.token });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const u = await browserUser();
    const { id } = (await req.json()) as { id: string };
    await deleteApiToken(u.id, id);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
