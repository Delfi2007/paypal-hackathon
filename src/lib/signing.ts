// Cryptographic mandate signing (Ed25519). A member's signature covers the exact rules of one
// mandate version, so anyone can later verify, with only the public key, that this person
// agreed to these rules. Changing any rule changes the message and invalidates old signatures.
//
// Two custody modes:
//  - server: Kitty makes a keypair for the member and keeps the private key encrypted at rest
//            (AES-256-GCM, key derived from SESSION_SECRET + user id). Works with no extra UI.
//  - self:   the member (or their AI agent) signs the message locally with their own key and sends
//            only the public key + signature. Kitty never sees the private key.

import crypto from "node:crypto";
import { db } from "./db";
import type { Kitty, Mandate, MandateSignature } from "./types";

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

function masterSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return "dev-only-session-secret-change-me";
}

const kek = (userId: string) => crypto.scryptSync(masterSecret(), `kitty-key:${userId}`, 32);

/** The exact bytes a member signs: canonical (sorted, no whitespace) description of the mandate. */
export function mandateMessage(k: Pick<Kitty, "id">, m: Mandate, signer: string): string {
  const body = {
    kitty: k.id,
    version: m.version,
    signer,
    totalBudget: m.totalBudget,
    perPaymentCap: m.perPaymentCap,
    quorum: m.quorum,
    deadline: m.deadline,
    categories: [...m.allowedCategories].sort(),
    payees: [...m.approvedPayees].sort(),
  };
  return `kitty-mandate/v1\n${JSON.stringify(body)}`;
}

export const mandateHash = (message: string) => crypto.createHash("sha256").update(message).digest("hex");

export function publicKeyFromB64(pub: string): crypto.KeyObject {
  return crypto.createPublicKey({ key: unb64(pub), format: "der", type: "spki" });
}

export function verifySignature(publicKey: string, message: string, signature: string): boolean {
  try {
    return crypto.verify(null, Buffer.from(message), publicKeyFromB64(publicKey), unb64(signature));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- server custody

async function ensureKeyTable() {
  await (await db()).execute(
    `CREATE TABLE IF NOT EXISTS user_keys (user_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, enc_private TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
}

function seal(userId: string, privDer: Buffer): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", kek(userId), iv);
  const enc = Buffer.concat([c.update(privDer), c.final()]);
  return [b64(iv), b64(c.getAuthTag()), b64(enc)].join(".");
}

function unseal(userId: string, sealed: string): Buffer {
  const [iv, tag, enc] = sealed.split(".").map(unb64);
  const d = crypto.createDecipheriv("aes-256-gcm", kek(userId), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]);
}

/** Returns the member's Ed25519 key, creating and sealing one the first time. */
async function serverKey(userId: string): Promise<{ publicKey: string; privateKey: crypto.KeyObject }> {
  await ensureKeyTable();
  const c = await db();
  const r = await c.execute({ sql: "SELECT public_key, enc_private FROM user_keys WHERE user_id = ?", args: [userId] });
  if (r.rows[0]) {
    const der = unseal(userId, String(r.rows[0].enc_private));
    return { publicKey: String(r.rows[0].public_key), privateKey: crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" }) };
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = b64(publicKey.export({ format: "der", type: "spki" }) as Buffer);
  const priv = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
  await c.execute({
    sql: "INSERT OR IGNORE INTO user_keys (user_id, public_key, enc_private, created_at) VALUES (?,?,?,?)",
    args: [userId, pub, seal(userId, priv), new Date().toISOString()],
  });
  return serverKey(userId); // re-read, so two racing requests agree on one key
}

export async function signAsServer(userId: string, message: string): Promise<{ publicKey: string; signature: string }> {
  const { publicKey, privateKey } = await serverKey(userId);
  return { publicKey, signature: b64(crypto.sign(null, Buffer.from(message), privateKey)) };
}

// --------------------------------------------------------------- verification

export interface SignatureCheck {
  memberId: string;
  name?: string;
  version: number;
  valid: boolean; // signature verifies against the public key and the message for that version
  current: boolean; // signed the mandate version that is in force now
  custody: "server" | "self";
  publicKey: string;
  signedAt: string;
}

export function verifyMandateSignatures(k: Kitty): { mandateHash: string; checks: SignatureCheck[]; validCurrent: number } {
  const m = k.mandate;
  const checks = (m.signatures ?? []).map((s: MandateSignature): SignatureCheck => {
    // A signature covers the rules of one mandate version. It only verifies against the rules in
    // force now when it was made for this version; after an amendment older signatures are
    // reported as stale (current: false), because the rules they covered no longer exist.
    const current = s.version === m.version;
    const valid = current && verifySignature(s.publicKey, mandateMessage(k, m, s.memberId), s.signature);
    return {
      memberId: s.memberId,
      name: k.members.find((x) => x.id === s.memberId)?.name,
      version: s.version,
      valid,
      current,
      custody: s.custody,
      publicKey: s.publicKey,
      signedAt: s.signedAt,
    };
  });
  return {
    mandateHash: mandateHash(mandateMessage(k, m, "*")),
    checks,
    validCurrent: checks.filter((c) => c.valid && c.current).length,
  };
}
