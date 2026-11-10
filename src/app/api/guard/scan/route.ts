import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { scan, sanitize } from "@/lib/guard";

// Try the prompt-injection guard on any text. Used by the MCP tool and handy for demos.
export async function POST(req: Request) {
  try {
    await requireUser();
    const { text, context } = (await req.json()) as { text?: string; context?: "untrusted" | "command" };
    const t = String(text ?? "").slice(0, 4000);
    const v = scan(t, context === "command" ? "command" : "untrusted");
    return ok({ ...v, verdict: v.blocked ? "quarantined" : v.clean ? "clean" : "warning", safeText: v.blocked ? "[removed by guard]" : sanitize(t, 400) });
  } catch (e) {
    return fail(e);
  }
}
