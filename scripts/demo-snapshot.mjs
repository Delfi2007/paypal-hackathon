// Save or restore the demo group's state (local file DB), so a recording can be retaken without re-seeding.
//   node scripts/demo-snapshot.mjs save      after seed-demo.mjs
//   node scripts/demo-snapshot.mjs restore   before each take
import { createClient } from "@libsql/client";
import fs from "node:fs";
const FILE = ".data/demo-snapshot.json";
const db = createClient({ url: process.env.TURSO_DATABASE_URL || "file:.data/kitty.db", authToken: process.env.TURSO_AUTH_TOKEN });
const cmd = process.argv[2];
if (cmd === "save") {
  const k = (await db.execute("SELECT id, invite_code, data, updated_at FROM kitties WHERE data LIKE '%Lisbon Weekender%' AND data NOT LIKE '%(mock)%' ORDER BY updated_at DESC LIMIT 1")).rows[0];
  if (!k) throw new Error("demo group not found; run seed-demo.mjs first");
  const ms = (await db.execute({ sql: "SELECT user_id FROM memberships WHERE kitty_id=?", args: [k.id] })).rows.map((r) => r.user_id);
  fs.writeFileSync(FILE, JSON.stringify({ id: k.id, invite: k.invite_code, data: k.data, members: ms }));
  console.log(`saved ${k.id} with ${ms.length} members`);
} else if (cmd === "restore") {
  const s = JSON.parse(fs.readFileSync(FILE, "utf8"));
  // PayPal keeps its own state: a refunded invoice can't be refunded again. So Dev gets a fresh invoice, paid again.
  const k = JSON.parse(s.data);
  const dev = k.members.find((m) => m.name === "Dev");
  if (dev) { dev.paid = 0; for (const f of ["paidLocal", "paidAt", "invoiceId", "orderId", "captureId"]) delete dev[f]; }
  delete k.departed;
  await db.execute({ sql: "UPDATE kitties SET data=?, updated_at=? WHERE id=?", args: [JSON.stringify(k), new Date().toISOString(), s.id] });
  for (const u of s.members) await db.execute({ sql: "INSERT OR IGNORE INTO memberships (kitty_id, user_id) VALUES (?,?)", args: [s.id, u] });
  if (dev) {
    const BASE = process.env.KITTY_URL || "http://localhost:3002";
    const r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "demo@kitty.test", password: "demo-kitty-2026" }) });
    const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const act = (action) => fetch(BASE + `/api/kitties/${s.id}/action`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ action }) }).then((x) => x.json());
    await act({ type: "request_contributions", params: {} });
    console.log("fresh invoice for Dev:", (await act({ type: "record_cash", params: { memberId: dev.id } })).decision);
  }
  console.log(`restored ${s.id}`);
} else console.log("usage: save | restore");
