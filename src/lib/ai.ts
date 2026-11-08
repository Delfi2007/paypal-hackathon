// AI layer. Uses Google Gemini (free tier) when GEMINI_API_KEY is set, and a
// deterministic rule-based fallback otherwise, so the demo never hard-fails.
// The model only ever *proposes* actions — the policy engine decides.

import type { AgentAction, Kitty, Member, Currency, VendorCategory } from "./types";
import { fmt } from "./money";
import { poolBalance } from "./policy";

export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const geminiKey = () => process.env.KITTY_GEMINI_KEY || process.env.GEMINI_API_KEY;
export const aiConfigured = () => !!geminiKey();

// Models are tried in order. Busy (503), rate-limited (429), retired (404) or slow models
// fall through to the next one, so a flaky model never takes the app down.
const MODELS = Array.from(new Set([AI_MODEL, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-flash-lite-latest"]));

async function gemini(
  system: string,
  user: string,
  image?: { data: string; mime: string },
): Promise<unknown> {
  const parts: unknown[] = [{ text: user }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  let lastErr: Error = new Error("Gemini unavailable");
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey()! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(image ? 40000 : 20000),
      });
      if (!r.ok) {
        const body = (await r.text()).slice(0, 200);
        lastErr = new Error(`Gemini ${model} ${r.status}: ${body}`);
        if ([400, 429, 500, 503, 404].includes(r.status)) continue;
        throw lastErr;
      }
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
    } catch (e) {
      lastErr = e as Error;
      if (!/Gemini .* (400|429|500|503|404)|timed out|aborted|JSON|fetch failed/i.test(lastErr.message) && lastErr.name !== "TimeoutError") throw lastErr;
    }
  }
  throw lastErr;
}

function kittyContext(k: Kitty) {
  return JSON.stringify({
    name: k.name,
    destination: k.destination,
    baseCurrency: k.baseCurrency,
    poolBalance: poolBalance(k),
    spent: k.spent,
    mandate: k.mandate,
    members: k.members.map((m) => ({
      id: m.id,
      name: m.name,
      currency: m.currency,
      share: m.share,
      paid: m.paid,
      persona: m.persona,
      remindersSent: m.remindersSent,
    })),
    vendors: k.vendors,
    pendingProposals: k.proposals
      .filter((p) => p.status === "pending")
      .map((p) => ({ title: p.title, type: p.action.type })),
  });
}

// ------------------------------------------------------------- commands

export interface Plan {
  reply: string;
  actions: AgentAction[];
}

const COMMAND_SYSTEM = `You are Kitty, an AI treasurer that manages a travel group's shared money through PayPal.
You turn a member's plain-language instruction into a short list of concrete actions.
You never move money yourself: a separate deterministic policy engine checks every action against the group's signed mandate,
and anything outside it goes to a group vote. So propose what the member asked for faithfully — do not refuse because of limits,
and do not invent payments nobody asked for.

Available action types and params:
- "pay_vendor": { "vendorId": string (must be an existing vendor id), "amount": number (in base currency), "memo": string }
- "add_vendor": { "name": string, "email": string, "category": "stay"|"transport"|"food"|"activities"|"other" }
   (if the member wants to pay a vendor that does not exist, propose add_vendor first, then pay_vendor with vendorId "NEW")
- "request_contributions": {}  (send PayPal invoices to members who have not been billed / not paid)
- "send_reminders": { "memberIds": string[] }  (members who still owe)
- "amend_mandate": { "totalBudget"?: number, "perPaymentCap"?: number, "quorum"?: number, "deadline"?: "YYYY-MM-DD", "approvePayees"?: string[] }
- "note": { "text": string }  (answer a question, no money moves)

Every action needs a one-sentence "reasoning" written for the group (why this, why this amount).
Respond ONLY with JSON: {"reply": string (1-2 friendly sentences to the member), "actions": [{"type":..., "params": {...}, "reasoning": "..."}]}`;

export async function planCommand(k: Kitty, text: string, actor: Member): Promise<Plan> {
  if (aiConfigured()) {
    try {
      const out = (await gemini(
        COMMAND_SYSTEM,
        `Kitty state: ${kittyContext(k)}\n\nInstruction from ${actor.name}: """${text}"""`,
      )) as Plan;
      if (out && Array.isArray(out.actions)) return out;
    } catch (e) {
      console.error("gemini plan failed, using rules", e);
    }
  }
  return rulePlan(k, text);
}

function findVendor(k: Kitty, text: string) {
  const t = text.toLowerCase();
  const keywords: Record<string, VendorCategory> = {
    hotel: "stay", stay: "stay", villa: "stay", suite: "stay", airbnb: "stay",
    sail: "activities", boat: "activities", tour: "activities", cruise: "activities",
    taxi: "transport", cab: "transport", transfer: "transport", ferry: "transport",
    dinner: "food", tavern: "food", restaurant: "food", lunch: "food", food: "food",
  };
  const byName = k.vendors.find((v) =>
    v.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && t.includes(w)),
  );
  if (byName) return byName;
  for (const [kw, cat] of Object.entries(keywords))
    if (t.includes(kw)) return k.vendors.find((v) => v.category === cat);
  return undefined;
}

function rulePlan(k: Kitty, text: string): Plan {
  const t = text.toLowerCase();
  const amt = Number((text.match(/(\d[\d,]*(?:\.\d+)?)/)?.[1] ?? "0").replace(/,/g, ""));
  const owing = k.members.filter((m) => m.paid < m.share);

  if (/(cap|budget|quorum|limit|deadline)/.test(t) && /(raise|increase|change|set|lower|bump|extend)/.test(t)) {
    const params: Record<string, unknown> = {};
    if (/cap|limit/.test(t)) params.perPaymentCap = amt;
    else if (/budget/.test(t)) params.totalBudget = amt;
    else if (/quorum/.test(t)) params.quorum = amt;
    return {
      reply: "Rule changes go to the group — I've opened a vote.",
      actions: [{ type: "amend_mandate", params, reasoning: `Requested change to the mandate: ${JSON.stringify(params)}.` }],
    };
  }
  if (/(pay|book|deposit|settle|send)/.test(t) && amt > 0) {
    const v = findVendor(k, text);
    if (v)
      return {
        reply: `Lining up ${fmt(amt, k.baseCurrency)} to ${v.name.replace(/\.$/, "")}.`,
        actions: [{ type: "pay_vendor", params: { vendorId: v.id, amount: amt, memo: text.slice(0, 120) }, reasoning: `You asked to pay ${v.name} ${fmt(amt, k.baseCurrency)}; the pool has ${fmt(poolBalance(k), k.baseCurrency)}.` }],
      };
  }
  if (/(remind|nudge|chase|ping)/.test(t))
    return {
      reply: owing.length ? `Nudging ${owing.map((m) => m.name).join(" and ")}.` : "Everyone has paid — nobody to nudge!",
      actions: owing.length
        ? [{ type: "send_reminders", params: { memberIds: owing.map((m) => m.id) }, reasoning: `${owing.length} member(s) still owe their share before ${k.mandate.deadline}.` }]
        : [],
    };
  if (/(collect|request|invoice|bill everyone|ask everyone)/.test(t))
    return {
      reply: "Sending PayPal requests to everyone who still owes.",
      actions: [{ type: "request_contributions", params: {}, reasoning: "Members who haven't paid get a PayPal invoice in their own currency." }],
    };
  const bal = poolBalance(k);
  return {
    reply: `The pool holds ${fmt(bal, k.baseCurrency)}; ${owing.length} of ${k.members.length} still owe. Try “pay the hotel 1,200” or “remind everyone”.`,
    actions: [],
  };
}

// ------------------------------------------------------------- reminders

export async function draftReminders(k: Kitty, members: Member[]): Promise<{ memberId: string; text: string }[]> {
  if (aiConfigured()) {
    try {
      const out = (await gemini(
        `You write short payment reminders (max 220 chars each) for a group trip kitty. Match tone to persona:
"prompt" → light, thankful; "forgetful" → playful, easy one-tap; "late" → warm but specific with the date and what's at stake; "new" → welcoming, explain what the money is for.
Escalate gently with remindersSent. Mention the amount and the member's own currency where helpful. No guilt-tripping. Optional single emoji.
Return JSON: {"messages":[{"memberId": string, "text": string}]}`,
        `Kitty: ${kittyContext(k)}\nWrite one reminder each for: ${members.map((m) => m.id).join(", ")}`,
      )) as { messages: { memberId: string; text: string }[] };
      if (out?.messages?.length) return out.messages;
    } catch (e) {
      console.error("gemini reminders failed", e);
    }
  }
  return members.map((m) => {
    const owe = fmt(m.share - m.paid, k.baseCurrency);
    const text =
      m.persona === "late"
        ? `Hey ${m.name} — ${k.destination} is almost here! Your ${owe} share is due ${k.mandate.deadline}; the hotel deposit is waiting on it. One tap and you're set 🌅`
        : m.persona === "forgetful"
          ? `${m.name}! Gentle nudge 🙃 your ${owe} for ${k.name} — pay in ${m.currency}, takes 10 seconds.`
          : m.persona === "new"
            ? `Welcome ${m.name}! The kitty covers stay, boats and taxis for ${k.destination}. Your share is ${owe} — pay any time before ${k.mandate.deadline}.`
            : `Hi ${m.name}, quick reminder: ${owe} for ${k.name}. Thank you!`;
    return { memberId: m.id, text };
  });
}

// ------------------------------------------------------------- bill vision

export interface ParsedBill {
  merchant: string;
  currency: Currency;
  items: { name: string; price: number; assignedTo: string[] }[];
  tax: number;
  tip: number;
  total: number;
  note?: string;
}

export async function parseBill(
  k: Kitty,
  image: { data: string; mime: string } | null,
  hint: string,
): Promise<ParsedBill> {
  if (aiConfigured() && image) {
    const out = (await gemini(
      `You read restaurant/activity receipts and split them for a travel group.
Extract every line item with its price, plus tax/service and tip. Then assign each item to member ids using the user's hint
(e.g. "Ana and Kenji shared the octopus, Delfi had no wine"). Items nobody is named on are shared by everyone.
Currency must be an ISO code (guess from symbols; default ${k.baseCurrency}).
Return JSON: {"merchant": string, "currency": string, "items":[{"name":string,"price":number,"assignedTo":[memberId...]}], "tax": number, "tip": number, "total": number, "note": string}`,
      `Members: ${JSON.stringify(k.members.map((m) => ({ id: m.id, name: m.name })))}\nHint: ${hint || "(none — split everything evenly)"}`,
      image,
    )) as ParsedBill;
    return out;
  }
  // No key or no photo: a sample receipt split across the real members of this kitty.
  const ids = k.members.map((m) => m.id);
  const pair = ids.slice(0, 2);
  const noFirst = ids.slice(1);
  const trio = ids.slice(0, 3);
  return {
    merchant: "Seaside Taverna (sample receipt)",
    currency: k.baseCurrency,
    items: [
      { name: "Grilled octopus", price: 24, assignedTo: pair },
      { name: "Fava & capers", price: 9, assignedTo: ids },
      { name: "Catch of the day (1kg)", price: 68, assignedTo: ids },
      { name: "Tomato fritters", price: 11, assignedTo: ids },
      { name: "White wine, bottle ×2", price: 56, assignedTo: noFirst.length ? noFirst : ids },
      { name: "Baklava ×3", price: 18, assignedTo: trio },
    ],
    tax: 0,
    tip: 15,
    total: 201,
    note: aiConfigured() ? "No photo attached, so this is a sample receipt." : "Offline mode: showing a sample receipt.",
  };
}

// ------------------------------------------------------------- new kitty

export interface KittyDraft {
  name: string;
  destination: string;
  tagline: string;
  baseCurrency: Currency;
  totalBudget: number;
  perPaymentCap: number;
  quorum: number;
  deadlineDays: number;
  members: { name: string; email?: string; currency: Currency }[];
  vendors: { name: string; email?: string; category: VendorCategory; approved: boolean }[];
}

export async function draftKitty(prompt: string): Promise<KittyDraft> {
  if (aiConfigured()) {
    try {
      return (await gemini(
        `You set up a shared trip fund ("kitty") from a plain-language description. Infer sensible values.
perPaymentCap defaults to ~1/3 of budget; quorum defaults to a simple majority of members; deadlineDays defaults to 7.
Currencies must be one of USD, EUR, GBP, AUD, CAD, JPY, SGD. Vendors: anything the group plans to pay for (hotel, boat, taxi...);
"approved": true when the description implies the group already agreed on it. Use placeholder emails like name@business.example.com.
Return JSON matching: {"name","destination","tagline","baseCurrency","totalBudget","perPaymentCap","quorum","deadlineDays","members":[{"name","email","currency"}],"vendors":[{"name","email","category","approved"}]}`,
        prompt,
      )) as KittyDraft;
    } catch (e) {
      console.error("gemini draft failed", e);
    }
  }
  // Rule-based fallback: "with A, B and me", "$4,000", "over $1,200", "3 of us".
  const num = (s?: string) => (s ? Number(s.replace(/,/g, "")) : undefined);
  const withPart = prompt.match(/\bwith\s+([^.]+?)(?:\.|$)/i)?.[1] ?? "";
  const names = withPart
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^me$/i.test(s) ? "Me" : s.split(/\s+/)[0]))
    .filter((s) => /^[A-Z]/.test(s))
    .slice(0, 8);
  const budget = num(prompt.match(/(?:around|about|budget|total)?\s*[$€£]\s?(\d[\d,]*)/i)?.[1]) ?? 3000;
  const cap = num(prompt.match(/(?:over|above|more than)\s*[$€£]?\s?(\d[\d,]*)/i)?.[1]) ?? Math.round(budget / 3);
  const curOf = (n: string): Currency => {
    const m = prompt.match(new RegExp(`\\b${n}\\b[^.,]*?\\bin\\s+(USD|EUR|GBP|AUD|CAD|JPY|SGD)\\b`));
    return (m?.[1]?.toUpperCase() as Currency) ?? (prompt.includes("€") ? "EUR" : prompt.includes("£") ? "GBP" : "USD");
  };
  const members = (names.length ? names : ["Me", "Friend A", "Friend B"]).map((n) => ({ name: n, currency: curOf(n) }));
  const quorum = num(prompt.match(/(\d+)\s+of\s+us/i)?.[1]) ?? Math.floor(members.length / 2) + 1;
  const destination = prompt.match(/^\s*([A-Z][a-zA-Z]+)/)?.[1] ?? prompt.match(/\b(?:to|in)\s+([A-Z][a-zA-Z]+)/)?.[1] ?? "Somewhere lovely";
  const agreed = prompt.match(/agreed on (?:the )?([^.]+)/i)?.[1] ?? "";
  const vendors = agreed
    .split(/,|\band\b/i)
    .map((s) => s.replace(/^\s*(?:a|an|the)\s+/i, "").trim())
    .filter(Boolean)
    .map((name) => ({
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
      category: (/(apartment|hotel|villa|stay|airbnb|hostel)/i.test(name) ? "stay" : /(taxi|car|ferry|train|flight)/i.test(name) ? "transport" : /(dinner|food|restaurant)/i.test(name) ? "food" : "activities") as VendorCategory,
      approved: true,
    }));
  const symbol = prompt.match(/[$€£]/)?.[0];
  return {
    name: `${destination}, Together`,
    destination,
    tagline: "Good friends, clear money.",
    baseCurrency: symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : "USD",
    totalBudget: budget,
    perPaymentCap: cap,
    quorum: Math.min(quorum, members.length),
    deadlineDays: 7,
    members,
    vendors: vendors.length ? vendors : [{ name: "Accommodation", category: "stay", approved: true }],
  };
}
