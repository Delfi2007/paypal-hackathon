import { fail, needKitty, ok } from "@/lib/api";
import { HttpError, log, mutate, notify } from "@/lib/store";
import { mandateHash, mandateMessage, signAsServer, verifySignature } from "@/lib/signing";

// GET: the exact message a member signs (so a member or their AI agent can sign it with their own key).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k, me } = await needKitty(id);
    const message = mandateMessage(k, k.mandate, me.id);
    return ok({ message, hash: mandateHash(message), version: k.mandate.version, algorithm: "ed25519", encoding: "base64url" });
  } catch (e) {
    return fail(e);
  }
}

// POST: each real member signs the mandate with an Ed25519 signature. The kitty becomes active once a
// quorum has signed. Body is optional: send { publicKey, signature } (both base64url) to sign with
// your own key (self-custody); otherwise Kitty signs with the key it holds for you (server custody).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { me } = await needKitty(id);
    const body = (await req.json().catch(() => ({}))) as { publicKey?: string; signature?: string };
    const out = await mutate(id, async (k) => {
      const m = k.mandate;
      m.signatures ??= [];
      const already = m.signatures.find((s) => s.memberId === me.id && s.version === m.version);
      if (already && m.signedBy.includes(me.id)) return { signed: m.signedBy.length, active: k.status === "active", signature: already, hash: mandateHash(mandateMessage(k, m, me.id)) };

      const message = mandateMessage(k, m, me.id);
      let publicKey: string, signature: string, custody: "server" | "self";
      if (body.publicKey && body.signature) {
        if (!verifySignature(body.publicKey, message, body.signature)) throw new HttpError(400, "Signature does not verify for this mandate version");
        publicKey = body.publicKey;
        signature = body.signature;
        custody = "self";
      } else {
        ({ publicKey, signature } = await signAsServer(me.id, message));
        custody = "server";
      }
      const sig = { memberId: me.id, publicKey, signature, version: m.version, signedAt: new Date().toISOString(), custody };
      m.signatures = m.signatures.filter((s) => s.memberId !== me.id).concat(sig);
      if (!m.signedBy.includes(me.id)) m.signedBy.push(me.id);
      const who = k.members.find((x) => x.id === me.id)!;
      log(k, {
        actor: "member",
        actorName: who.name,
        kind: "mandate",
        title: `${who.name} signed mandate v${m.version}`,
        detail: `${m.signedBy.length}/${m.quorum} signatures · Ed25519 ${custody === "self" ? "(own key)" : "(Kitty-held key)"} · ${signature.slice(0, 16)}…`,
      });
      if (k.status === "forming" && m.signedBy.length >= m.quorum) {
        k.status = "active";
        log(k, { actor: "system", kind: "mandate", title: "Mandate is now in force", detail: "A quorum has signed. The agent can act within these rules." });
        notify(k.members.map((x) => x.id), { kittyId: k.id, kind: "mandate", title: `${k.name} is now active`, body: "The mandate has enough signatures.", href: `/k/${k.id}` });
      }
      return { signed: m.signedBy.length, active: k.status === "active", signature: sig, hash: mandateHash(message) };
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
