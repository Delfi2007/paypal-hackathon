// Smoke test for the MCP server. Needs the app running (npm run dev).
// Creates a user + group, mints an agent token, then drives the group through the MCP tools.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BASE = process.env.KITTY_URL || "http://localhost:3000";
let cookie = "";
async function web(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { "Content-Type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  return r.json();
}
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", "-", m); if (!c) process.exitCode = 1; };

const stamp = Date.now().toString(36);
await web("POST", "/api/auth/signup", { name: "Agent Owner", email: `agent.${stamp}@test.dev`, password: "correct-horse-1", currency: "EUR" });
const created = await web("POST", "/api/kitties", { draft: { name: "MCP trip", destination: "Porto", tagline: "", baseCurrency: "EUR", totalBudget: 3000, perPaymentCap: 1000, quorum: 1, deadlineDays: 7, members: [{ name: "a" }, { name: "b" }], vendors: [{ name: "Hotel Aurora", email: "sb-ukfe353773873@personal.example.com", category: "stay", approved: true }, { name: "Surf School", email: "sb-ukfe353773873@personal.example.com", category: "activities", approved: false }] } });
const o = await web("POST", "/api/paypal/orders", { kittyId: created.id });
await web("POST", `/api/paypal/orders/${o.id}/capture`, { kittyId: created.id });
const { token } = await web("POST", "/api/auth/tokens", { name: "smoke test" });
ok(token?.startsWith("kty_"), "agent token minted");

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["mcp/kitty-mcp.mjs"], env: { ...process.env, KITTY_URL: BASE, KITTY_TOKEN: token } }));
const tools = (await client.listTools()).tools.map((t) => t.name);
ok(tools.length >= 8, `MCP exposes ${tools.length} tools: ${tools.join(", ")}`);
const call = async (name, args = {}) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);

const list = await call("kitty_list");
ok(list.length === 1 && list[0].name === "MCP trip", "kitty_list sees the group");
const st = await call("kitty_status", { kittyId: created.id });
ok(st.pool.startsWith("1500.00"), `kitty_status pool = ${st.pool}, payees: ${st.payees.map((p) => p.name).join(", ")}`);
const p1 = await call("kitty_pay_vendor", { kittyId: created.id, payee: "hotel", amount: 600, memo: "deposit" });
ok(p1.result.startsWith("EXECUTED"), `in-mandate payment: ${p1.result}`);
const p2 = await call("kitty_pay_vendor", { kittyId: created.id, payee: "Surf School", amount: 200 });
ok(p2.result.startsWith("NEEDS A VOTE") || p2.result.startsWith("EXECUTED"), `unapproved payee: ${p2.result}`);
const p3 = await call("kitty_pay_vendor", { kittyId: created.id, payee: "Hotel Aurora", amount: 5000 });
ok(!p3.result.startsWith("EXECUTED"), `over-cap payment is NOT executed: ${p3.result}`);
const props = await call("kitty_open_proposals", { kittyId: created.id });
ok(props.length >= 1, `${props.length} proposal(s) waiting for votes: ${props.map((p) => p.title).join(" | ")}`);
const ask = await call("kitty_ask", { kittyId: created.id, instruction: "how much is left in the pool?" });
ok(typeof ask.reply === "string", `kitty_ask replied: "${ask.reply}"`);
const audit = await call("kitty_audit", { kittyId: created.id, limit: 3 });
ok(audit.chain.ok, `audit chain intact (${audit.chain.checked} events)`);
const bad = await fetch(BASE + "/api/kitties", { headers: { Authorization: "Bearer kty_not-a-real-token" } });
ok(bad.status === 401, "an invalid token is rejected");
const viaToken = await fetch(BASE + "/api/auth/tokens", { headers: { Authorization: `Bearer ${token}` } });
ok(viaToken.status === 403, "a token cannot create or list other tokens");
await client.close();
