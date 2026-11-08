// Single source of truth for "where is each feature?" — used by the landing
// page directory and the app sidebar so every feature is one click away.

export interface Feature {
  n: string;
  title: string;
  blurb: string;
  page: string; // relative to /k/[id] ("" = wallet); absolute when starting with "/"
  pageName: string;
  paypal?: string;
  tag: "core" | "plus";
}

export const FEATURES: Feature[] = [
  { n: "01", title: "Natural-language agent", blurb: "Say what you need. The agent turns it into a plan of actions, each with its reasoning.", page: "agent", pageName: "Agent", tag: "core" },
  { n: "02", title: "Invoices & payment tracking", blurb: "PayPal invoices per member in their own currency. Webhooks and sync mark them paid.", page: "activity", pageName: "Activity", paypal: "Invoicing v2 · Webhooks", tag: "core" },
  { n: "03", title: "Policy engine & approvals", blurb: "Every action is checked against the signed mandate. Anything outside it goes to a group vote.", page: "approvals", pageName: "Approvals", tag: "core" },
  { n: "04", title: "Explainable audit timeline", blurb: "Every command, check, vote and payment, with the agent's reasoning behind it.", page: "activity", pageName: "Activity", tag: "core" },
  { n: "05", title: "Payouts when the pool is funded", blurb: "Pay vendors from the pool. Payments the pool can't cover yet are queued, then released automatically.", page: "send", pageName: "Pay vendor", paypal: "Payouts v1", tag: "core" },
  { n: "06", title: "Bill photo → itemised split", blurb: "Snap a receipt. The vision model reads every line and splits it by who had what.", page: "split", pageName: "Split bill", tag: "plus" },
  { n: "07", title: "Multi-currency, one settlement", blurb: "Each friend pays in their own currency and the pool settles in one.", page: "", pageName: "Wallet", paypal: "Orders v2 · Checkout", tag: "plus" },
  { n: "08", title: "Adaptive reminder tone", blurb: "Reminders written for each person: light for the prompt payer, firmer for the late one.", page: "agent", pageName: "Agent", tag: "plus" },
  { n: "09", title: "Mandate from one sentence", blurb: "Describe the trip and Kitty drafts the budget, cap, payees and quorum for everyone to sign.", page: "/new", pageName: "New kitty", tag: "plus" },
  { n: "10", title: "Swipe-to-pay keypad", blurb: "Type an amount, do quick maths, swipe to confirm. The policy engine still decides.", page: "send", pageName: "Pay vendor", tag: "plus" },
  { n: "11", title: "Member checkout page", blurb: "Each friend gets a personal pay link with live FX and PayPal Smart Buttons.", page: "/pay", pageName: "Pay link", paypal: "JS SDK Buttons", tag: "plus" },
];

export function featureHref(f: Feature) {
  return f.page.startsWith("/") && f.page !== "/pay" ? f.page : "/app";
}
