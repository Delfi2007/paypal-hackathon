// Persistence layer over libSQL. A kitty is one JSON document (its ledger, votes,
// proposals…) plus indexed tables for users, memberships and notifications.

import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./db";
import type { AppNotification, AppUser, Currency, Kitty, LedgerEvent } from "./types";

export const uid = (p = "") => `${p}${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
export const inviteCode = () => crypto.randomBytes(5).toString("base64url").replace(/[-_]/g, "x").toLowerCase();

// ------------------------------------------------------------------ users

export interface UserRow extends AppUser { passHash: string }

const toUser = (r: Record<string, unknown>): UserRow => ({
  id: String(r.id),
  email: String(r.email),
  name: String(r.name),
  passHash: String(r.pass_hash),
  paypalEmail: r.paypal_email ? String(r.paypal_email) : undefined,
  currency: String(r.currency) as Currency,
  hue: Number(r.hue),
});

export const publicUser = ({ passHash: _p, ...u }: UserRow): AppUser => u;

export async function createUser(u: { email: string; name: string; passHash: string; currency: Currency; paypalEmail?: string }): Promise<UserRow> {
  const c = await db();
  const id = uid("u_");
  const hue = Math.floor(Math.random() * 360);
  await c.execute({
    sql: "INSERT INTO users (id,email,name,pass_hash,paypal_email,currency,hue,created_at) VALUES (?,?,?,?,?,?,?,?)",
    args: [id, u.email.toLowerCase(), u.name, u.passHash, u.paypalEmail ?? null, u.currency, hue, new Date().toISOString()],
  });
  return (await getUserById(id))!;
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const r = await (await db()).execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.toLowerCase()] });
  return r.rows[0] ? toUser(r.rows[0] as never) : undefined;
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  const r = await (await db()).execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return r.rows[0] ? toUser(r.rows[0] as never) : undefined;
}

export async function updateUser(id: string, patch: { name?: string; currency?: Currency; paypalEmail?: string | null }) {
  const c = await db();
  const u = await getUserById(id);
  if (!u) return;
  await c.execute({
    sql: "UPDATE users SET name=?, currency=?, paypal_email=? WHERE id=?",
    args: [patch.name ?? u.name, patch.currency ?? u.currency, patch.paypalEmail === undefined ? u.paypalEmail ?? null : patch.paypalEmail, id],
  });
}

// ------------------------------------------------------------ api tokens

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Personal access token so an AI agent (or script) can act as this user. Shown once, stored hashed. */
export async function createApiToken(userId: string, name: string): Promise<{ id: string; token: string }> {
  const token = "kty_" + crypto.randomBytes(24).toString("base64url");
  const id = uid("t_");
  await (await db()).execute({ sql: "INSERT INTO api_tokens (id,user_id,name,token_hash,created_at) VALUES (?,?,?,?,?)", args: [id, userId, name, hashToken(token), new Date().toISOString()] });
  return { id, token };
}

export async function userByApiToken(token: string): Promise<UserRow | undefined> {
  if (!token.startsWith("kty_")) return undefined;
  const c = await db();
  const r = await c.execute({ sql: "SELECT user_id FROM api_tokens WHERE token_hash = ?", args: [hashToken(token)] });
  if (!r.rows[0]) return undefined;
  void c.execute({ sql: "UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?", args: [new Date().toISOString(), hashToken(token)] });
  return getUserById(String(r.rows[0].user_id));
}

export async function listApiTokens(userId: string) {
  const r = await (await db()).execute({ sql: "SELECT id,name,created_at,last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC", args: [userId] });
  return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), createdAt: String(x.created_at), lastUsedAt: x.last_used_at ? String(x.last_used_at) : null }));
}

export async function deleteApiToken(userId: string, id: string) {
  await (await db()).execute({ sql: "DELETE FROM api_tokens WHERE id = ? AND user_id = ?", args: [id, userId] });
}

// ---------------------------------------------------------------- kitties

const locks = new Map<string, Promise<unknown>>();
type Queue = { notes: Omit<AppNotification, "id" | "createdAt" | "read">[] };
const als = new AsyncLocalStorage<Queue>();

export async function getKitty(id: string): Promise<Kitty | undefined> {
  const r = await (await db()).execute({ sql: "SELECT data FROM kitties WHERE id = ?", args: [id] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].data)) as Kitty) : undefined;
}

export async function getKittyByInvite(code: string): Promise<Kitty | undefined> {
  const r = await (await db()).execute({ sql: "SELECT data FROM kitties WHERE invite_code = ?", args: [code] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].data)) as Kitty) : undefined;
}

/** Find the kitty whose JSON contains a PayPal id (invoice id, payout batch id). Used by webhooks. */
export async function findKittyContaining(paypalId: string): Promise<Kitty | undefined> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(paypalId)) return undefined;
  const r = await (await db()).execute({ sql: "SELECT data FROM kitties WHERE data LIKE ? LIMIT 1", args: [`%"${paypalId}"%`] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].data)) as Kitty) : undefined;
}

export async function listKittiesForUser(userId: string): Promise<Kitty[]> {
  const r = await (await db()).execute({
    sql: "SELECT k.data FROM kitties k JOIN memberships m ON m.kitty_id = k.id WHERE m.user_id = ? ORDER BY k.updated_at DESC",
    args: [userId],
  });
  return r.rows.map((x) => JSON.parse(String(x.data)) as Kitty);
}

async function persist(k: Kitty) {
  const c = await db();
  await c.batch(
    [
      {
        sql: "INSERT INTO kitties (id, invite_code, data, updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        args: [k.id, k.inviteCode, JSON.stringify(k), new Date().toISOString()],
      },
      ...k.members.map((m) => ({
        sql: "INSERT OR IGNORE INTO memberships (kitty_id, user_id) VALUES (?,?)",
        args: [k.id, m.id],
      })),
    ],
    "write",
  );
}

export async function putKitty(k: Kitty) {
  await persist(k);
  return k;
}

/** Read-modify-write one kitty under a per-kitty lock; flush queued notifications after the save. */
export async function mutate<T>(id: string, fn: (k: Kitty) => Promise<T> | T): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const mine = prev.then(() => gate);
  locks.set(id, mine);
  await prev.catch(() => undefined);
  try {
    const k = await getKitty(id);
    if (!k) throw new HttpError(404, "Kitty not found");
    const q: Queue = { notes: [] };
    const out = await als.run(q, () => fn(k));
    await persist(k);
    await flush(q);
    return out;
  } finally {
    release();
    if (locks.get(id) === mine) locks.delete(id);
  }
}

// ------------------------------------------------------------ notifications

/** Queue an in-app notification for each user; delivered after the surrounding mutate() saves. */
export function notify(userIds: string[], n: { kittyId?: string; kind: string; title: string; body?: string; href?: string }) {
  const q = als.getStore();
  const rows = userIds.map((userId) => ({ userId, ...n }));
  if (q) q.notes.push(...rows);
  else void flush({ notes: rows });
}

async function flush(q: Queue) {
  if (!q.notes.length) return;
  const c = await db();
  await c.batch(
    q.notes.map((n) => ({
      sql: "INSERT INTO notifications (id,user_id,kitty_id,kind,title,body,href,read,created_at) VALUES (?,?,?,?,?,?,?,0,?)",
      args: [uid("n_"), n.userId, n.kittyId ?? null, n.kind, n.title, n.body ?? null, n.href ?? null, new Date().toISOString()],
    })),
    "write",
  );
  try {
    const { pushTo } = await import("./push");
    for (const n of q.notes) await pushTo(n.userId, { title: n.title, body: n.body, href: n.href });
  } catch {}
}

export async function listNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const r = await (await db()).execute({
    sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [userId, limit],
  });
  return r.rows.map((x) => ({
    id: String(x.id), userId: String(x.user_id), kittyId: x.kitty_id ? String(x.kitty_id) : undefined,
    kind: String(x.kind), title: String(x.title), body: x.body ? String(x.body) : undefined,
    href: x.href ? String(x.href) : undefined, read: Number(x.read) === 1, createdAt: String(x.created_at),
  }));
}

export async function markNotificationsRead(userId: string) {
  await (await db()).execute({ sql: "UPDATE notifications SET read = 1 WHERE user_id = ?", args: [userId] });
}

// ------------------------------------------------------------------ ledger

/** Appends to the ledger as a hash chain: tampering with any past event breaks every later hash. */
export function log(k: Kitty, e: Omit<LedgerEvent, "id" | "ts" | "hash" | "prev">): LedgerEvent {
  const prev = k.ledger[0]?.hash ?? "genesis";
  const base = { id: uid("ev_"), ts: new Date().toISOString(), ...e };
  const hash = crypto.createHash("sha256").update(prev + JSON.stringify(base)).digest("hex");
  const ev: LedgerEvent = { ...base, prev, hash };
  k.ledger.unshift(ev);
  return ev;
}

export function verifyChain(k: Kitty): { ok: boolean; checked: number; brokenAt?: string } {
  const evs = [...k.ledger].reverse(); // oldest first
  let prev = "genesis";
  let checked = 0;
  for (const ev of evs) {
    if (!ev.hash) { prev = "genesis"; continue; } // pre-chain legacy events
    const { hash, prev: p, ...base } = ev;
    const want = crypto.createHash("sha256").update((p ?? prev) + JSON.stringify(base)).digest("hex");
    if (p !== prev && checked > 0) return { ok: false, checked, brokenAt: ev.id };
    if (want !== hash) return { ok: false, checked, brokenAt: ev.id };
    prev = hash;
    checked++;
  }
  return { ok: true, checked };
}

// --------------------------------------------------------------------- misc

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
