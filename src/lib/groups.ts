import type { Kitty, Member } from "./types";
import type { UserRow } from "./store";

export function makeMember(u: UserRow, k: Pick<Kitty, "sharePerMember">, role: "organizer" | "member"): Member {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    paypalEmail: u.paypalEmail,
    currency: u.currency,
    share: k.sharePerMember,
    paid: 0,
    persona: "new",
    remindersSent: 0,
    avatarHue: u.hue,
    role,
    isOrganizer: role === "organizer",
    joinedAt: new Date().toISOString(),
  };
}
