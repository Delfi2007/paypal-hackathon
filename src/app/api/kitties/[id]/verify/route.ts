import { fail, needKitty, ok } from "@/lib/api";
import { verifyChain } from "@/lib/store";
import { verifyMandateSignatures } from "@/lib/signing";

export const dynamic = "force-dynamic";

// Independent integrity report: re-checks every Ed25519 mandate signature and the hash-chained audit trail.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { k } = await needKitty(id);
    const sigs = verifyMandateSignatures(k);
    const chain = verifyChain(k);
    const signedNow = sigs.validCurrent;
    return ok({
      kitty: k.id,
      mandateVersion: k.mandate.version,
      mandateHash: sigs.mandateHash,
      quorum: k.mandate.quorum,
      signatures: sigs.checks,
      validSignaturesForCurrentMandate: signedNow,
      quorumCryptographicallyMet: signedNow >= k.mandate.quorum,
      ledger: chain,
      ok: chain.ok && sigs.checks.every((c) => !c.current || c.valid),
    });
  } catch (e) {
    return fail(e);
  }
}
