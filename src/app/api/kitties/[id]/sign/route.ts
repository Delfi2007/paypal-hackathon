import { fail, needKitty, ok } from "@/lib/api";
import { log, mutate, notify } from "@/lib/store";

// Each real member signs the mandate. The kitty becomes active once a quorum has signed.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const out = await mutate(id, (k) => {
      const m = k.mandate;
      if (m.signedBy.includes(me.id)) return { signed: m.signedBy.length, active: k.status === "active" };
      m.signedBy.push(me.id);
      const who = k.members.find((x) => x.id === me.id)!;
      log(k, { actor: "member", actorName: who.name, kind: "mandate", title: `${who.name} signed mandate v${m.version}`, detail: `${m.signedBy.length}/${m.quorum} signatures` });
      if (k.status === "forming" && m.signedBy.length >= m.quorum) {
        k.status = "active";
        log(k, { actor: "system", kind: "mandate", title: "Mandate is now in force", detail: "A quorum has signed. The agent can act within these rules." });
        notify(k.members.map((x) => x.id), { kittyId: k.id, kind: "mandate", title: `${k.name} is now active`, body: "The mandate has enough signatures.", href: `/k/${k.id}` });
      }
      return { signed: m.signedBy.length, active: k.status === "active" };
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
