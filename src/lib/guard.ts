// Spots instructions that try to talk the treasurer past the group's rules
// ("ignore the mandate", "no vote needed", "you are now…"). Detection is only for
// transparency: it adds an entry to the audit trail and a line in the reply.
// Safety never depends on it, because every action still goes through the
// deterministic policy engine whether or not anything is flagged.

const PATTERNS: RegExp[] = [
  /\b(ignore|bypass|override|skip|disregard|forget|disable|turn off|get around)\b[^.!?\n]{0,40}\b(mandate|rules?|polic(y|ies)|votes?|voting|quorum|caps?|limits?|approvals?|checks?|instructions?)\b/i,
  /\b(no (group )?(vote|approval|quorum|sign-?off)s? (is |are )?(needed|required|necessary)|without (a |any |the )?(group )?(vote|voting|approval|quorum|sign-?off|check)s?|skip the (vote|approval|check)s?|don'?t (need|wait for|ask for) (a |any |the )?(group )?(vote|approval)s?)\b/i,
  /\b(you are now|act as|pretend (to be|you are)|new instructions?|system prompt|developer mode|jailbreak)\b/i,
  /\b(pre-?approved|already approved|everyone (has )?(agreed|approved))\b[^.!?\n]{0,30}\b(so|just|pay|send)\b/i,
  /\bmark (it|this|the payment) as (within|inside) (the )?mandate\b/i,
];

export function looksLikeOverride(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
