# Kitty: the AI treasurer for group money

> **Share the trip, not the chasing.** Kitty is a real multi-user app where friends pool money into a shared kitty through PayPal. An AI treasurer collects shares, pays vendors and nudges late payers, but only inside a **mandate the group signs**. Anything outside it goes to a **group vote**.

Built for the **PayPal AI Hackathon 2026: Build What's Next with PayPal and AI**. PayPal **sandbox** only (test money), no real funds ever move.

![Kitty](public/images/sky.webp)

## The problem

Group trips create shared costs: the villa deposit, the boat, the taxis, the dinner nobody split properly. Someone fronts the money and spends two weeks chasing friends across currencies. Ledger apps record debts. Nobody moves the money.

Letting an AI spend a group's money raises the obvious question: **how does the group trust it?** Most "AI payment guardrail" projects protect *one* user from *one* agent. Kitty is about **collective consent**: many real people, one pool, one set of rules they all signed.

## Idea: agents propose, policy decides, friends vote

| | |
|---|---|
| **Real accounts and groups** | Email + password accounts (scrypt-hashed, signed session cookies). Create a group, share an **invite link**, friends sign up and join. Each friend pays in **their own currency**. |
| **Sign the mandate** | Budget, per-payment cap, pre-approved payees, categories and a quorum. Every member signs. The kitty is "forming" until a quorum has signed. |
| **AI treasurer** | Plain-language commands become a plan of actions, each with its reasoning. The model only ever *proposes*. |
| **Deterministic policy engine** | `src/lib/policy.ts` checks every action against the mandate **before** any PayPal call. The model cannot bypass it (23 unit tests). |
| **Group votes** | Out-of-mandate actions become proposals. When the quorum approves, they run. Votes are tied to the logged-in member, never to a client-supplied id. |
| **Queued payouts** | An approved payment the pool cannot cover yet is queued, then released automatically the moment a contribution lands. |
| **Real notifications** | In-app inbox plus real **device push notifications** (Web Push, free). Reminders and vote requests reach the actual friend. |
| **Behaviour-based reminder tone** | Tone comes from how each friend has actually paid (prompt, forgetful, late), not a label. |
| **Tamper-evident audit trail** | Every event is hash-chained (`sha256(prev + event)`). Editing or deleting history breaks the chain, and the app verifies it. |
| **Receipt photo to itemised split** | A vision model reads the receipt and splits it by who had what, then the bill goes through the same policy engine. |
| **MCP server for any AI agent** | Your own Claude or other MCP agent can manage a kitty with a personal token. It is bound by the same mandate and votes. |

## PayPal integration (sandbox)

| PayPal product | How Kitty uses it |
|---|---|
| **Orders v2 + JS SDK Smart Buttons** | Each friend pays their share on `/pay/{kitty}` in their own currency. |
| **Invoicing v2** | "Request shares" creates and sends one invoice per friend. Reminders use the invoice remind endpoint. |
| **Payouts v1** | Vendors are paid from the pool after the policy check or the group vote passes. |
| **Webhooks** | `INVOICING.INVOICE.PAID` and `PAYMENT.PAYOUTS-ITEM.*` update the ledger and release queued payouts. Signatures are verified through PayPal's verify-webhook-signature API. |

Without PayPal keys the app falls back to **simulated** PayPal calls (IDs start with `SIM-`) so it still runs end to end. With keys it makes real sandbox calls.

## AI

| Feature | Model use |
|---|---|
| Command planning | Natural language to structured actions plus reasoning (JSON) |
| Mandate drafting | "Lisbon in March with 4 friends, about $4,000…" to budget, cap, quorum, payees |
| Adaptive reminders | Written per person, tone from real payment behaviour |
| Vision bill split | Receipt photo plus a hint ("Delfi skipped the wine") to an itemised split |

Uses Google Gemini (free tier). **Without a key it falls back to a deterministic rule-based planner**, so the app always runs.

## Run it

```bash
git clone https://github.com/Delfi2007/paypal-hackathon.git
cd paypal-hackathon
npm install
cp .env.example .env.local     # add keys (all optional, see below)
npm run dev
```

Open http://localhost:3000, create an account, start a kitty, then open the invite link in a second browser (or a private window) to join as a second friend.

### Test accounts for judges

```bash
npm run seed:judges     # with the app running in another terminal
```

Creates three real accounts and one real group through the normal API (password `judge-demo-2026`):

| Email | Friend | Pays in |
|---|---|---|
| `judge1@kitty.test` | Delfi (organiser) | EUR |
| `judge2@kitty.test` | Mukesh | GBP |
| `judge3@kitty.test` | Nambert | USD |

Log in as each in a separate browser profile to try signing, voting and paying as different people.

### Real PayPal sandbox and AI (optional)

1. Create a REST app at [developer.paypal.com](https://developer.paypal.com) (sandbox) and set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Enable **Invoicing** and **Payouts** on the app.
2. Set `KITTY_GEMINI_KEY` from [Google AI Studio](https://aistudio.google.com/apikey) (free).
3. Pay a share with a **sandbox personal account** from the developer dashboard (Testing Tools, Sandbox Accounts).
4. For webhooks on localhost, expose the app with a tunnel and register `/api/paypal/webhook`. The **Sync** button on the Activity page polls PayPal as a backup.

### Let your own AI agent run a kitty (MCP)

Create a token under **My kitties, Agent access**, then add this to Claude Desktop's config (the app shows the exact snippet):

```json
{ "mcpServers": { "kitty": { "command": "node", "args": ["mcp/kitty-mcp.mjs"],
  "env": { "KITTY_URL": "http://localhost:3000", "KITTY_TOKEN": "kty_..." } } } }
```

Tools: `kitty_status`, `kitty_pay_vendor`, `kitty_request_shares`, `kitty_send_reminders`, `kitty_ask`, `kitty_open_proposals`, `kitty_vote`, `kitty_audit`. Try it with `node scripts/mcp-smoke.mjs`.

### Tests

```bash
npm test            # policy engine, audit chain, reminder tone (23 tests)
npm run typecheck
npm run lint
```

CI runs all of them plus a production build on every push.

## Architecture

```
src/
  lib/
    policy.ts   deterministic mandate checks (allow / needs_quorum / block)
    agent.ts    plan → evaluate → execute or escalate → record; votes; fund-triggered release
    ai.ts       Gemini planning, reminders, vision split, mandate drafting (+ rule fallback)
    paypal.ts   OAuth, Orders v2, Invoicing v2, Payouts v1, webhook verification
    store.ts    libSQL storage, per-group locking, notifications, hash-chained ledger
    auth.ts     scrypt passwords, signed session cookie, personal access tokens
    push.ts     Web Push (VAPID)
  app/
    page.tsx            landing
    login, signup       accounts
    app/                my kitties, profile, agent access
    new                 create a group from one sentence
    join/[code]         invite link
    k/[id]/…            wallet · agent · send · approvals · activity · split
    pay/[id]            member checkout (PayPal Smart Buttons)
    api/…               auth, kitties, votes, orders, webhook, notifications, push
mcp/kitty-mcp.mjs       MCP server
tests/                  vitest
```

Next.js 15, React 19, Tailwind CSS 4, TypeScript, libSQL (SQLite file locally, Turso in production). Exchange rates come from the free, keyless Frankfurter API (ECB data). Artwork was generated with Google Flow.

## Team

Delfi, Mukesh Kumar, Nambert Jones

## License

[MIT](LICENSE)
