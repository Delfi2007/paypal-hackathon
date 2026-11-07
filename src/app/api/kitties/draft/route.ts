import { fail, ok } from "@/lib/api";
import { draftKitty } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { prompt } = (await req.json()) as { prompt: string };
    if (!prompt?.trim()) throw new Error("Describe your trip first");
    return ok(await draftKitty(prompt));
  } catch (e) {
    return fail(e);
  }
}
