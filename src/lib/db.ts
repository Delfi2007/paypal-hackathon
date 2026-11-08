// Database. libSQL speaks SQLite: locally it is a plain file (zero setup), and in
// production the same code talks to a free Turso database via TURSO_DATABASE_URL.

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

const g = globalThis as unknown as { __kdb?: Client; __kdbReady?: Promise<void> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    paypal_email TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    hue INTEGER NOT NULL DEFAULT 220,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS kitties (
    id TEXT PRIMARY KEY,
    invite_code TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    kitty_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (kitty_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kitty_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    href TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL
  )`,
];

export async function db(): Promise<Client> {
  if (!g.__kdb) {
    const url = process.env.TURSO_DATABASE_URL || "file:.data/kitty.db";
    if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.join(process.cwd(), url.slice(5))), { recursive: true });
    g.__kdb = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    const c = g.__kdb;
    g.__kdbReady = c.batch(SCHEMA.map((sql) => ({ sql, args: [] })), "write").then(() => undefined);
  }
  await g.__kdbReady;
  return g.__kdb!;
}
