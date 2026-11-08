// Core domain model for Kitty — an AI treasurer that runs a group's shared money
// under a signed mandate. Every agent action is checked by a deterministic
// policy engine before it can touch PayPal.

export type Currency = "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "JPY" | "SGD";

export type Persona = "prompt" | "forgetful" | "late" | "new";

export interface Member {
  id: string;
  name: string;
  email: string;
  currency: Currency; // the currency this member pays in
  share: number; // share owed, in kitty base currency
  paid: number; // amount received, in kitty base currency
  paidLocal?: { amount: number; currency: Currency };
  persona: Persona; // drives reminder tone, derived from real payment behaviour
  remindersSent: number;
  lastRemindedAt?: string;
  paidAt?: string;
  paypalEmail?: string; // the member's PayPal (sandbox) email
  role?: "organizer" | "member";
  joinedAt?: string;
  invoiceId?: string;
  orderId?: string;
  avatarHue: number;
  isOrganizer?: boolean;
}

export type VendorCategory =
  | "stay"
  | "transport"
  | "food"
  | "activities"
  | "other";

export interface Vendor {
  id: string;
  name: string;
  email: string; // PayPal receiver email
  category: VendorCategory;
  addedBy?: string;
}

export interface Mandate {
  totalBudget: number; // max the kitty may ever spend
  perPaymentCap: number; // any single payout above this needs quorum
  allowedCategories: VendorCategory[];
  approvedPayees: string[]; // vendor ids pre-approved by the group
  quorum: number; // votes needed to approve out-of-mandate actions
  deadline: string; // ISO date; collection deadline
  signedBy: string[]; // member ids who signed the mandate
  version: number;
}

export type ActionType =
  | "request_contributions"
  | "send_reminders"
  | "pay_vendor"
  | "add_vendor"
  | "split_bill"
  | "record_cash"
  | "amend_mandate"
  | "note";

export interface AgentAction {
  type: ActionType;
  // loose payload; validated per type by the agent executor
  params: Record<string, unknown>;
  reasoning: string; // the agent's explanation, shown in the ledger
}

export type PolicyDecision = "allow" | "needs_quorum" | "block";

export interface PolicyCheck {
  rule: string;
  pass: boolean;
  detail: string;
  severity: "quorum" | "block";
}

export interface PolicyResult {
  decision: PolicyDecision;
  checks: PolicyCheck[];
  summary: string;
}

export interface Proposal {
  id: string;
  createdAt: string;
  action: AgentAction;
  policy: PolicyResult;
  status: "pending" | "executed" | "rejected" | "failed";
  approvals: string[]; // member ids
  rejections: string[];
  title: string;
  awaitingFunds?: boolean; // approved/allowed, waits until the pool is funded
  requestedBy?: string;
  preApproved?: boolean; // within mandate, only waiting on funds
}

export type LedgerActor = "agent" | "policy" | "paypal" | "member" | "system";

export interface LedgerEvent {
  id: string;
  ts: string;
  actor: LedgerActor;
  actorName?: string;
  kind:
    | "command"
    | "plan"
    | "invoice"
    | "payment"
    | "reminder"
    | "payout"
    | "policy"
    | "vote"
    | "mandate"
    | "bill"
    | "error"
    | "info";
  title: string;
  detail?: string;
  reasoning?: string;
  policy?: PolicyResult;
  amount?: number;
  ref?: string; // PayPal id
  prev?: string; // hash chain: hash of the previous event
  hash?: string; // sha256(prev + event body): tamper-evident audit trail
  messages?: { to: string; text: string }[];
}

export interface Payout {
  id: string;
  vendorId: string;
  amount: number;
  memo: string;
  paypalBatchId?: string;
  status: string;
  ts: string;
}

export interface BillItem {
  name: string;
  price: number;
  assignedTo: string[]; // member ids
}

export interface Bill {
  id: string;
  ts: string;
  merchant: string;
  currency: Currency;
  items: BillItem[];
  tax: number;
  tip: number;
  total: number;
  splits: Record<string, number>; // memberId -> amount in base
  paidBy?: string;
}

export interface Kitty {
  id: string;
  createdBy: string;
  inviteCode: string;
  status: "forming" | "active";
  sharePerMember: number;
  expectedMembers: number;
  name: string;
  destination: string;
  tagline: string;
  baseCurrency: Currency;
  createdAt: string;
  members: Member[];
  vendors: Vendor[];
  mandate: Mandate;
  proposals: Proposal[];
  ledger: LedgerEvent[];
  payouts: Payout[];
  bills: Bill[];
  spent: number; // total paid out to vendors, base currency
}

export interface ModeStatus {
  paypal: "live-sandbox" | "simulated";
  ai: "gemini" | "rules";
  aiModel?: string;
  paypalClientId?: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  paypalEmail?: string;
  currency: Currency;
  hue: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  kittyId?: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}
