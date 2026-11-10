// Generates public/openapi.json and public/kitty.postman_collection.json from one route table.
//   node scripts/gen-api-docs.mjs
import { writeFileSync } from "node:fs";

const ACTIONS = ["request_contributions", "send_reminders", "pay_vendor", "record_cash", "refund_member", "void_payout", "drop_member", "update_mandate", "release_hold", "capture_hold", "void_hold"];
const body = (props, req = []) => ({ required: true, content: { "application/json": { schema: { type: "object", properties: props, ...(req.length ? { required: req } : {}) } } } });
const S = { type: "string" }, N = { type: "number" };

// [method, path, tag, summary, requestBody?, auth]
const R = [
  ["post", "/api/auth/signup", "Auth", "Create an account (name, email, password, currency, PayPal sandbox email)", body({ name: S, email: S, password: S, currency: S, paypalEmail: S }, ["name", "email", "password"]), false],
  ["post", "/api/auth/login", "Auth", "Log in; sets the session cookie", body({ email: S, password: S }, ["email", "password"]), false],
  ["post", "/api/auth/logout", "Auth", "Log out"],
  ["get", "/api/auth/me", "Auth", "Current user"],
  ["post", "/api/auth/profile", "Auth", "Update name, currency or PayPal email", body({ name: S, currency: S, paypalEmail: S })],
  ["get", "/api/auth/tokens", "Auth", "List API tokens (for MCP and scripts)"],
  ["post", "/api/auth/tokens", "Auth", "Create an API token (shown once)", body({ name: S })],
  ["delete", "/api/auth/tokens", "Auth", "Revoke an API token", body({ id: S }, ["id"])],
  ["get", "/api/kitties", "Kitties", "List my kitties"],
  ["post", "/api/kitties", "Kitties", "Create a kitty from a draft (budget, cap, quorum, vendors)", body({ draft: { type: "object" } }, ["draft"])],
  ["post", "/api/kitties/draft", "Kitties", "Turn a plain-language description into a draft with Gemini", body({ text: S }, ["text"])],
  ["get", "/api/kitties/{id}", "Kitties", "Full kitty: members, proposals, ledger and audit-chain verification"],
  ["get", "/api/join/{code}", "Kitties", "Preview a kitty from its invite code", undefined, false],
  ["post", "/api/join/{code}", "Kitties", "Join a kitty with an invite code"],
  ["get", "/api/kitties/{id}/sign", "Mandate", "Who has signed the Ed25519 mandate"],
  ["post", "/api/kitties/{id}/sign", "Mandate", "Sign the mandate as the current user"],
  ["post", "/api/kitties/{id}/command", "Agent", "Natural-language command; the AI plans, the policy engine decides", body({ text: S, actorId: S }, ["text"])],
  ["post", "/api/kitties/{id}/action", "Agent", "Run one typed action through the policy engine: allow, needs_quorum or block", body({ action: { type: "object", properties: { type: { type: "string", enum: ACTIONS }, params: { type: "object" } } }, label: S }, ["action"])],
  ["post", "/api/kitties/{id}/vote", "Agent", "Vote on a proposal that needs quorum", body({ proposalId: S, approve: { type: "boolean" } }, ["proposalId", "approve"])],
  ["post", "/api/kitties/{id}/bill", "Agent", "Read a receipt photo with Gemini vision", body({ image: S })],
  ["get", "/api/kitties/{id}/discover", "Agent", "Product search through Channel3"],
  ["get", "/api/kitties/{id}/holds", "Holds", "List PayPal authorization holds"],
  ["post", "/api/kitties/{id}/holds", "Holds", "Place a hold for a deposit", body({ amount: N, vendor: S })],
  ["post", "/api/kitties/{id}/holds/{holdId}", "Holds", "Capture or void a hold", body({ op: { type: "string", enum: ["capture", "void"] } })],
  ["post", "/api/kitties/{id}/sync", "PayPal", "Sync invoice and payment status from PayPal"],
  ["post", "/api/kitties/{id}/reconcile", "PayPal", "Reconcile the ledger against PayPal using the official Agent Toolkit (read-only)"],
  ["get", "/api/kitties/{id}/verify", "Audit", "Verify the hash-chained audit ledger"],
  ["post", "/api/paypal/orders", "PayPal", "Create a PayPal order for a member's share", body({ kittyId: S, memberId: S }, ["kittyId", "memberId"])],
  ["post", "/api/paypal/orders/{orderId}/capture", "PayPal", "Capture an approved PayPal order"],
  ["post", "/api/paypal/webhook", "PayPal", "PayPal webhook receiver (signature verified)", undefined, false],
  ["post", "/api/guard/scan", "Safety", "Scan text for prompt injection before it reaches the agent", body({ text: S }, ["text"])],
  ["get", "/api/fx", "Utility", "Live FX rates", undefined, false],
  ["get", "/api/notifications", "Notifications", "My notifications"],
  ["post", "/api/notifications", "Notifications", "Mark notifications read", body({ ids: { type: "array", items: S } })],
  ["get", "/api/push/subscribe", "Notifications", "Push subscription status"],
  ["post", "/api/push/subscribe", "Notifications", "Subscribe this device to Web Push", body({ subscription: { type: "object" } }, ["subscription"])],
  ["delete", "/api/push/subscribe", "Notifications", "Unsubscribe this device"],
  ["post", "/api/cron/tick", "Scheduler", "Run due reminders and scheduled payments (needs CRON_SECRET bearer token)"],
  ["get", "/api/status", "Utility", "Health and which integrations are live", undefined, false],
];

const paths = {};
for (const [m, p, tag, summary, rb, auth = true] of R) {
  const params = [...p.matchAll(/\{(\w+)\}/g)].map((x) => ({ name: x[1], in: "path", required: true, schema: S }));
  (paths[p] ??= {})[m] = {
    tags: [tag], summary, ...(params.length ? { parameters: params } : {}), ...(rb ? { requestBody: rb } : {}),
    ...(auth ? {} : { security: [] }),
    responses: { "200": { description: "OK" }, "401": { description: "Not logged in" }, "403": { description: "Not allowed" } },
  };
}
const spec = {
  openapi: "3.0.3",
  info: {
    title: "Kitty API", version: "1.0.0",
    description: "Kitty is an AI treasurer for group money on the PayPal sandbox. The AI only proposes; a deterministic policy engine decides allow, needs_quorum or block before anything touches PayPal. Every decision lands in a hash-chained audit ledger.",
    license: { name: "MIT" },
  },
  servers: [{ url: "http://localhost:3000", description: "Local" }],
  security: [{ cookie: [] }, { bearer: [] }],
  components: { securitySchemes: { cookie: { type: "apiKey", in: "cookie", name: "kitty_session" }, bearer: { type: "http", scheme: "bearer", description: "API token from POST /api/auth/tokens" } } },
  paths,
};
writeFileSync("public/openapi.json", JSON.stringify(spec, null, 2));

const sample = (rb) => rb ? JSON.stringify(Object.fromEntries(Object.entries(rb.content["application/json"].schema.properties).map(([k, v]) => [k, v.type === "number" ? 0 : v.type === "boolean" ? true : v.type === "object" ? {} : v.type === "array" ? [] : ""])), null, 2) : undefined;
const groups = {};
for (const [m, p, tag, summary, rb] of R) {
  (groups[tag] ??= []).push({
    name: `${m.toUpperCase()} ${p}`, request: {
      method: m.toUpperCase(), description: summary,
      header: [{ key: "Content-Type", value: "application/json" }],
      url: { raw: "{{baseUrl}}" + p.replace(/\{(\w+)\}/g, "{{$1}}"), host: ["{{baseUrl}}"], path: p.slice(1).split("/").map((s) => s.replace(/\{(\w+)\}/g, "{{$1}}")) },
      ...(rb ? { body: { mode: "raw", raw: sample(rb), options: { raw: { language: "json" } } } } : {}),
    },
  });
}
const collection = {
  info: { name: "Kitty API", description: spec.info.description, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{apiToken}}", type: "string" }] },
  variable: [{ key: "baseUrl", value: "http://localhost:3000" }, { key: "apiToken", value: "" }, { key: "id", value: "" }, { key: "code", value: "" }, { key: "holdId", value: "" }, { key: "orderId", value: "" }],
  item: Object.entries(groups).map(([name, item]) => ({ name, item })),
};
writeFileSync("public/kitty.postman_collection.json", JSON.stringify(collection, null, 2));
console.log(`${R.length} operations -> public/openapi.json, public/kitty.postman_collection.json`);
