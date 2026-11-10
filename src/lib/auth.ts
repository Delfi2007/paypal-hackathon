// Accounts: email + password (scrypt) and a stateless signed session cookie.
// No third-party auth service, so it works identically on localhost and in production.

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getUserById, HttpError, userByApiToken, type UserRow } from "./store";

const COOKIE = "kitty_session";
const TTL_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET (16+ chars) must be set in production");
  return "dev-only-session-secret-change-me";
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${b64(salt)}$${b64(hash)}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = crypto.scryptSync(pw, Buffer.from(salt, "base64url"), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}

function sessionToken(userId: string) {
  const exp = Date.now() + TTL_DAYS * 86400_000;
  const payload = b64(JSON.stringify({ u: userId, e: exp }));
  return `${payload}.${sign(payload)}`;
}

/** A ready-made Cookie header for a user. Server-side only: the demo seeder uses it to call the app's own API as each friend. */
export const sessionCookie = (userId: string) => `${COOKIE}=${sessionToken(userId)}`;

export async function startSession(userId: string) {
  (await cookies()).set(COOKIE, sessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<UserRow | undefined> {
  const bearer = (await headers()).get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) return userByApiToken(bearer.slice(7).trim());
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return undefined;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return undefined;
  const want = sign(payload);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return undefined;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof u !== "string" || Date.now() > e) return undefined;
    return await getUserById(u);
  } catch {
    return undefined;
  }
}

export async function requireUser(): Promise<UserRow> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please log in");
  return u;
}
