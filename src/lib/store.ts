// Tiny JSON-file store. Good enough for a hackathon demo and zero setup:
// state lives in memory and is flushed to .data/kitties.json on every write.

import fs from "node:fs";
import path from "node:path";
import type { Kitty, LedgerEvent } from "./types";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "kitties.json");

type DB = { kitties: Record<string, Kitty> };
const g = globalThis as unknown as { __kittyDb?: DB };

export const uid = (p = "") =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function load(): DB {
  if (g.__kittyDb) return g.__kittyDb;
  let db: DB = { kitties: {} };
  try {
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {}
  if (!db.kitties[DEMO_ID]) db.kitties[DEMO_ID] = seedDemo();
  g.__kittyDb = db;
  return db;
}

function save() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(g.__kittyDb, null, 2));
  } catch (e) {
    console.error("store save failed", e);
  }
}

export function listKitties(): Kitty[] {
  return Object.values(load().kitties).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getKitty(id: string): Kitty | undefined {
  return load().kitties[id];
}

export function putKitty(k: Kitty) {
  load().kitties[k.id] = k;
  save();
  return k;
}

/** Run a mutation against a kitty and persist it. */
export async function mutate<T>(id: string, fn: (k: Kitty) => Promise<T> | T): Promise<T> {
  const k = getKitty(id);
  if (!k) throw new Error("Kitty not found");
  const out = await fn(k);
  save();
  return out;
}

export function log(k: Kitty, e: Omit<LedgerEvent, "id" | "ts">): LedgerEvent {
  const ev: LedgerEvent = { id: uid("ev_"), ts: new Date().toISOString(), ...e };
  k.ledger.unshift(ev);
  return ev;
}

export function resetDemo() {
  const db = load();
  db.kitties[DEMO_ID] = seedDemo();
  save();
  return db.kitties[DEMO_ID];
}

// ---------------------------------------------------------------- demo seed

export const DEMO_ID = "santorini";

function ago(mins: number) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function seedDemo(): Kitty {
  const deadline = new Date(Date.now() + 6 * 86400_000).toISOString().slice(0, 10);
  const k: Kitty = {
    id: DEMO_ID,
    name: "Santorini, Slowly",
    destination: "Santorini, Greece",
    tagline: "Five friends. One caldera. Zero awkward money chats.",
    baseCurrency: "EUR",
    createdAt: ago(60 * 24 * 3),
    spent: 0,
    members: [
      { id: "m_delfi", name: "Delfi", email: "delfi@personal.example.com", currency: "EUR", share: 900, paid: 900, persona: "prompt", remindersSent: 0, avatarHue: 212, isOrganizer: true },
      { id: "m_mukesh", name: "Mukesh", email: "mukesh@personal.example.com", currency: "GBP", share: 900, paid: 0, persona: "forgetful", remindersSent: 1, avatarHue: 330 },
      { id: "m_nambert", name: "Nambert", email: "nambert@personal.example.com", currency: "USD", share: 900, paid: 900, paidLocal: { amount: 978.26, currency: "USD" }, persona: "prompt", remindersSent: 0, avatarHue: 28 },
      { id: "m_ana", name: "Ana", email: "ana@personal.example.com", currency: "EUR", share: 900, paid: 900, persona: "prompt", remindersSent: 0, avatarHue: 160 },
      { id: "m_kenji", name: "Kenji", email: "kenji@personal.example.com", currency: "JPY", share: 900, paid: 0, persona: "late", remindersSent: 2, avatarHue: 265 },
    ],
    vendors: [
      { id: "v_caldera", name: "Caldera Cliff Suites", email: "stay@business.example.com", category: "stay" },
      { id: "v_sail", name: "Aegean Sail Co.", email: "sail@business.example.com", category: "activities" },
      { id: "v_taxi", name: "Oia Taxi Collective", email: "taxi@business.example.com", category: "transport" },
      { id: "v_tavern", name: "Ammoudi Fish Tavern", email: "tavern@business.example.com", category: "food" },
    ],
    mandate: {
      totalBudget: 4500,
      perPaymentCap: 1500,
      allowedCategories: ["stay", "transport", "food", "activities"],
      approvedPayees: ["v_caldera", "v_sail", "v_taxi"],
      quorum: 3,
      deadline,
      signedBy: ["m_delfi", "m_nambert", "m_ana", "m_mukesh"],
      version: 1,
    },
    proposals: [],
    payouts: [],
    bills: [],
    ledger: [],
  };

  const ev = (mins: number, e: Omit<LedgerEvent, "id" | "ts">): LedgerEvent => ({
    id: uid("ev_"),
    ts: ago(mins),
    ...e,
  });

  k.ledger = [
    ev(60 * 5, {
      actor: "agent",
      kind: "reminder",
      title: "Nudged Kenji — second reminder",
      reasoning: "Kenji has paid late on past trips; a warm but specific nudge with the date works better than a generic ping.",
      messages: [{ to: "Kenji", text: "Kenji! Sunsets in Oia wait for no one 🌅 Your €900 share (≈ ¥ in your currency) is due Friday — one tap and you're in." }],
    }),
    ev(60 * 26, { actor: "paypal", kind: "payment", title: "Ana paid €900.00", amount: 900, ref: "SIM-CAP-ANA" }),
    ev(60 * 30, { actor: "paypal", kind: "payment", title: "Nambert paid $978.26 → €900.00", detail: "Paid in USD, settled to the pool in EUR", amount: 900, ref: "SIM-CAP-NAM" }),
    ev(60 * 40, { actor: "paypal", kind: "payment", title: "Delfi paid €900.00", amount: 900, ref: "SIM-CAP-DEL" }),
    ev(60 * 48, {
      actor: "agent",
      kind: "invoice",
      title: "Requested €900 from each of 5 travellers",
      reasoning: "Budget €4,500 split evenly across 5 people. Each person is billed in their own currency.",
    }),
    ev(60 * 49, { actor: "member", actorName: "Delfi, Nambert, Ana, Mukesh", kind: "mandate", title: "Mandate v1 signed by 4 of 5", detail: "Budget €4,500 · per-payment cap €1,500 · quorum 3 · 3 pre-approved payees" }),
    ev(60 * 50, {
      actor: "agent",
      kind: "plan",
      title: "Drafted the Santorini mandate",
      reasoning: "From: “5 of us, Santorini, around €900 each, hotel + sailing + taxis, nothing over €1.5k without asking.”",
    }),
  ];
  return k;
}
