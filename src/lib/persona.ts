import type { Member, Persona } from "./types";

/** Reminder tone comes from how this person has actually behaved in this kitty. */
export function personaOf(m: Member, deadline: string): Persona {
  const paid = m.paid >= m.share;
  if (paid) return m.remindersSent === 0 ? "prompt" : "forgetful";
  const pastDue = new Date(deadline).getTime() < Date.now();
  if (m.remindersSent >= 2 || pastDue) return "late";
  if (m.remindersSent === 1) return "forgetful";
  return "new";
}
