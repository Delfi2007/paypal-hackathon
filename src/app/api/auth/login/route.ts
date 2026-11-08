import { fail, ok } from "@/lib/api";
import { startSession, verifyPassword } from "@/lib/auth";
import { getUserByEmail, publicUser } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    const u = await getUserByEmail((email ?? "").trim());
    // same message for unknown email and wrong password
    if (!u || !verifyPassword(password ?? "", u.passHash)) return fail("Wrong email or password", 401);
    await startSession(u.id);
    return ok({ user: publicUser(u) });
  } catch (e) {
    return fail(e);
  }
}
