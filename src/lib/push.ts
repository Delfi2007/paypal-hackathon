// Web Push: real device notifications, free, no account. Keys are self-generated VAPID keys.
import webpush from "web-push";
import { db } from "./db";

let ready = false;
function init(): boolean {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  ready = true;
  return true;
}

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export async function saveSubscription(userId: string, sub: webpush.PushSubscription) {
  await (await db()).execute({
    sql: "INSERT INTO push_subs (endpoint,user_id,data) VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, data=excluded.data",
    args: [sub.endpoint, userId, JSON.stringify(sub)],
  });
}

export async function removeSubscription(endpoint: string) {
  await (await db()).execute({ sql: "DELETE FROM push_subs WHERE endpoint = ?", args: [endpoint] });
}

export async function hasSubscription(userId: string) {
  const r = await (await db()).execute({ sql: "SELECT 1 FROM push_subs WHERE user_id = ? LIMIT 1", args: [userId] });
  return r.rows.length > 0;
}

export async function pushTo(userId: string, msg: { title: string; body?: string; href?: string }) {
  if (!init()) return;
  const c = await db();
  const r = await c.execute({ sql: "SELECT endpoint, data FROM push_subs WHERE user_id = ?", args: [userId] });
  await Promise.all(
    r.rows.map(async (row) => {
      try {
        await webpush.sendNotification(JSON.parse(String(row.data)), JSON.stringify(msg), { TTL: 3600 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removeSubscription(String(row.endpoint)); // expired subscription
      }
    }),
  );
}
