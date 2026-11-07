# Kitty: the AI treasurer for group trips

> **Share the trip, not the chasing.** Kitty is an AI agent that collects a group's shared money through PayPal, pays vendors from the pool, and chases the friend who forgot. It acts only inside a **mandate** the group signs. Anything outside it goes to a **group vote**.

Built for the **PayPal AI Hackathon 2026: Build What's Next with PayPal and AI**.

![Kitty landing page](public/images/hero.webp)

## The problem

Group trips create shared costs: the villa deposit, the boat, the taxis, the dinner nobody split properly. Someone fronts the money and spends the next two weeks chasing friends across currencies. Ledger apps record debts. Nobody moves the money.

Letting an AI agent spend money raises the obvious question: **how does a group trust it?**

## The idea: agents propose, policy decides, friends vote

| | |
|---|---|
| **Speak it** | Talk to Kitty in plain language: *"Pay the hotel the €1,800 deposit, book the sunset sail, remind whoever hasn't paid."* The AI agent turns this into a list of actions, each with its reasoning. |
| **Sign it** | The group signs a **mandate**: total budget, per-payment cap, pre-approved payees, allowed categories, and a quorum. |
| **Policy engine** | A **deterministic** rules engine (`src/lib/policy.ts`) checks every proposed action before any PayPal API call. The model cannot bypass it. |
| **Vote on it** | Out-of-mandate actions become proposals. When the quorum approves, they run automatically. |
| **Wait for funds** | An approved payment that the pool can't cover yet is queued. When a contribution lands, Kitty releases it on its own. |
| **Explainable ledger** | Every command, plan, policy check, vote, invoice, payment and payout is logged with the agent's reasoning and the rules it was checked against. |

## PayPal integration (sandbox)

| PayPal product | How Kitty uses it |
|---|---|
| **Orders v2 + JS SDK Smart Buttons** | Each member pays their share at `/pay/{kitty}/{member}`, **in their own currency**. Kitty converts it to the pool's base currency. |
| **Invoicing v2** | "Send everyone their PayPal request" creates and sends one invoice per member, in their currency. Reminders use the invoice remind endpoint. |
| **Payouts v1** | Vendors (hotel, boat, tavern) are paid from the pool after the policy check or the group vote passes. |
| **Webhooks** | `INVOICING.INVOICE.PAID` and `PAYMENT.PAYOUTS-ITEM.*` update the ledger and release queued payouts. Signatures are verified. A **Sync PayPal** button polls invoices when running on localhost. |

## AI

| Feature | Model use |
|---|---|
| Command planning | Natural language → structured actions plus reasoning (JSON) |
| Mandate drafting | "Lisbon in March with Priya, Tom…" → budget, cap, quorum, members, currencies, payees |
| Adaptive reminders | Tone follows each member's history (prompt, forgetful, late, new) and how many reminders they've had |
| Vision bill split | Receipt photo plus a hint ("Delfi skipped the wine") → itemised split, with tax and tip shared in proportion |

The AI uses Google's Gemini API (free tier, `gemini-2.5-flash`). **Without a key, Kitty falls back to a deterministic rule-based planner**, so the demo always runs.

## Run it

```bash
git clone https://github.com/Delfi2007/paypal-hackathon.git
cd paypal-hackathon
npm install
cp .env.example .env.local   # optional: add keys
npm run dev
```

Open http://localhost:3000 and click **Open the Santorini kitty**.

**Without keys**, PayPal calls are simulated (IDs start with `SIM-`) and the AI uses rules. Every flow still works end to end.

**With keys:**
1. Create a sandbox REST app at [developer.paypal.com](https://developer.paypal.com) and put `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env.local`.
2. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`.
3. Pay a share with a **sandbox personal account** from the developer dashboard.

## Demo script (about 3 minutes)

1. **Landing page:** the problem, plus the "agents propose, policy decides, friends vote" idea.
2. **Santorini kitty:** €2,700 is in the pool. Kenji (JPY) and Mukesh (GBP) still owe.
3. Click **Pay Caldera Cliff Suites the €1,800 deposit**. The policy engine flags it as over the €1,500 cap, and a vote opens.
4. Switch to Nambert, then Ana, and approve. The quorum is reached and the PayPal payout runs.
5. Click **Book the sunset sail… for €420**. It's within the mandate, so it executes instantly. Then try €1,400. The pool can't cover it, so it's **queued**.
6. Open Mukesh's pay link and pay £ with PayPal. The pool fills, and the queued sail payout is **released automatically**.
7. **Remind whoever hasn't paid:** each member gets a reminder in a different tone.
8. **Snap the bill:** an itemised split by who had what. Pay it from the kitty: the tavern isn't pre-approved, so it goes to a vote.
9. **New kitty:** describe a trip in one sentence and get a drafted mandate.

## Architecture

```
src/
  lib/
    policy.ts   deterministic mandate checks (allow / needs_quorum / block)
    agent.ts    plan → evaluate → execute or escalate → record; votes; fund-triggered release
    ai.ts       Gemini planning, reminders, vision bill split, mandate drafting (+ rule fallback)
    paypal.ts   OAuth, Orders v2, Invoicing v2, Payouts v1, webhook verification
    store.ts    JSON-file store + seeded Santorini demo
  app/
    page.tsx              landing
    k/[id]                kitty dashboard
    pay/[id]/[memberId]   member checkout (PayPal Smart Buttons)
    new                   natural-language kitty creation
    api/…                 commands, votes, bill, sync, orders, capture, webhook
```

Next.js 15, React 19, Tailwind CSS 4, TypeScript. FX rates come from the free, keyless Frankfurter API (ECB data). Images were generated with Google Flow.

## Team

Delfi, Mukesh Kumar, Nambert Jones

## License

[MIT](LICENSE)
