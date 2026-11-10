// Prompt-injection guard. Everything a stranger can type into Kitty (a vendor's name, a payment
// memo, a line read off a receipt photo) is UNTRUSTED text that ends up in front of the AI.
// This module screens that text with deterministic rules, before any model sees it, and
// quarantines anything that tries to give the agent orders. Pure and free: no model, no network.
//
// Layers: 1) screen + quarantine untrusted fields   2) sanitise what is shown to the model
//         3) screen the model's own output   4) the policy engine still checks every payment.

export type Severity = "none" | "low" | "high";

export interface GuardVerdict {
  clean: boolean; // true when nothing suspicious was found
  blocked: boolean; // true when the text must not reach the agent / be stored as trusted
  severity: Severity;
  score: number;
  signals: string[]; // human-readable reasons, shown in the audit trail
}

type Rule = { id: string; label: string; weight: number; re: RegExp };

const RULES: Rule[] = [
  {
    id: "override",
    label: "tries to override the agent's instructions",
    weight: 3,
    re: /\b(ignore|disregard|forget|override|bypass|circumvent|disable)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the|these)\b[^.\n]{0,40}\b(instructions?|rules?|prompts?|polic(?:y|ies)|mandate|limits?|caps?|guard(?:rails?)?|checks?|safety)\b/i,
  },
  {
    id: "role",
    label: "tries to reassign the agent's role",
    weight: 3,
    re: /\b(you are now|from now on you|act as (?:an?|the)|pretend (?:to be|you)|new instructions?|updated instructions?|system prompt|developer mode|jailbreak|dan mode)\b/i,
  },
  {
    id: "tags",
    label: "contains fake system/assistant markup",
    weight: 3,
    re: /<\/?\s*(system|assistant|user|instructions?|tool|function)\s*>|\[\/?(?:inst|system)\]|^\s*(?:system|assistant|developer)\s*:/im,
  },
  {
    id: "drain",
    label: "asks to send all of the group's money",
    weight: 3,
    re: /\b(send|transfer|wire|pay|move|release|withdraw)\b[^.\n]{0,30}\b(all|entire|every|remaining|full|whole|max(?:imum)?)\b[^.\n]{0,25}\b(funds?|money|pool|balance|kitty|cash)\b/i,
  },
  {
    id: "secrecy",
    label: "asks the agent to hide something from the group",
    weight: 3,
    re: /\b(do not|don'?t|never|without)\b[^.\n]{0,25}\b(tell|mention|inform|notify|alert|reveal|show|log|record)\b[^.\n]{0,30}\b(group|members?|users?|anyone|organi[sz]er|ledger|audit)\b/i,
  },
  {
    id: "skipvote",
    label: "asks to skip a vote, quorum or policy check",
    weight: 3,
    re: /\b(skip|no need for|without (?:a |any )?|waive|auto-?approve|pre-?approve this)\b[^.\n]{0,20}\b(votes?|voting|approvals?|quorum|polic(?:y|ies)|checks?|signatures?)\b/i,
  },
  {
    id: "giftcard",
    label: "mentions untraceable payout methods",
    weight: 2,
    re: /\b(gift ?cards?|itunes card|steam card|bitcoin|btc|ethereum|usdt|crypto(?:currency)?|western union|moneygram|wallet address|0x[a-f0-9]{20,})\b/i,
  },
  {
    id: "invisible",
    label: "hides characters that are invisible to humans",
    weight: 2,
    re: /[​-‏‪-‮⁠-⁤­﻿]/,
  },
  {
    id: "encoded",
    label: "contains a long encoded blob",
    weight: 2,
    re: /[A-Za-z0-9+/]{48,}={0,2}/,
  },
  {
    id: "link",
    label: "contains a link",
    weight: 1,
    re: /\b(?:https?:\/\/|www\.)\S+/i,
  },
  {
    id: "urgent",
    label: "uses pressure wording (urgent / act now)",
    weight: 1,
    re: /\b(urgent(?:ly)?|immediately|act now|asap|right now|final warning)\b[^.\n]{0,20}\b(pay|send|transfer|approve)\b/i,
  },
];

/** Normalise lookalike characters (full-width letters, ligatures) so tricks can't dodge the rules. */
export function normalise(text: string): string {
  return String(text ?? "").normalize("NFKC");
}

/**
 * Screen untrusted text. `context` tunes the threshold:
 *  - "untrusted": vendor names, memos, receipt lines. A single strong signal is enough to block.
 *  - "command": what a signed-in member typed. Only blocked on an obvious attack.
 */
export function scan(text: string, context: "untrusted" | "command" = "untrusted"): GuardVerdict {
  const raw = String(text ?? "");
  const norm = normalise(raw);
  // Also scan with invisible characters removed, so "ig​nore previous rules" is still caught.
  const stripped = norm.replace(/[​-‏‪-‮⁠-⁤­﻿]/g, "");
  const signals: string[] = [];
  let score = 0;
  for (const r of RULES) {
    if (r.re.test(raw) || r.re.test(norm) || r.re.test(stripped)) {
      signals.push(r.label);
      score += r.weight;
    }
  }
  const limit = context === "command" ? 3 : 2;
  const blocked = score >= limit;
  return {
    clean: signals.length === 0,
    blocked,
    severity: score === 0 ? "none" : blocked ? "high" : "low",
    score,
    signals,
  };
}

/** The text with invisible/control characters, markup and prompt delimiters neutralised, length-capped. */
export function sanitize(text: string, max = 120): string {
  return normalise(text)
    .replace(/[\u0000-\u001F\u007F​-‏‪-‮⁠-⁤­﻿]/g, " ")
    .replace(/<[^>]{0,40}>/g, " ")
    .replace(/[`"]{2,}|-{3,}|={3,}|#{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * What to put in a model prompt for an untrusted field: the cleaned text, or a visible placeholder
 * when the guard blocked it, so the model never reads the attack.
 */
export function forPrompt(text: string, max = 80): string {
  const v = scan(text);
  return v.blocked ? "[removed by guard]" : sanitize(text, max);
}

export function reason(v: GuardVerdict): string {
  return v.signals.join("; ");
}

/** Screen every untrusted field of a record at once. Returns the first blocked field, if any. */
export function scanFields(fields: Record<string, unknown>): { field: string; verdict: GuardVerdict } | null {
  for (const [field, value] of Object.entries(fields)) {
    if (value == null || value === "") continue;
    const verdict = scan(String(value));
    if (verdict.blocked) return { field, verdict };
  }
  return null;
}
