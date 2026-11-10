// Seeds a populated demo group for an existing account + 5 new mock friends joined via invite link.
//   node scripts/seed-mock-group.mjs <owner-email> <owner-password>
const BASE = process.env.KITTY_URL || "http://localhost:3000";
const [OWNER_EMAIL, OWNER_PW] = process.argv.slice(2);
if (!OWNER_EMAIL || !OWNER_PW) { console.error("usage: node scripts/seed-mock-group.mjs <email> <password>"); process.exit(1); }
const RUN = Date.now(), FRIEND_PW = "mock-" + RUN.toString(16).slice(-8), PAYEE = process.env.PAYEE_EMAIL || "sb-ukfe353773873@personal.example.com";
const session = () => { let c = ""; return async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: { "Content-Type": "application/json", cookie: c }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.getSetCookie?.() ?? []; if (sc.length) c = sc.map((x) => x.split(";")[0]).join("; "); return { status: r.status, j: await r.json().catch(() => ({})) }; }; };

const owner = session();
const li = await owner("POST", "/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PW });
if (li.status !== 200) throw new Error("owner login failed: " + li.j.error);
const friends = [["Priya", "INR"], ["Tom", "GBP"], ["Yuki", "JPY"], ["Marco", "EUR"], ["Sasha", "USD"]].map(([name, currency]) => ({ name, currency, email: `mock${RUN}-${name.toLowerCase()}@kitty.test`, s: session() }));
for (const f of friends) { const r = await f.s("POST", "/api/auth/signup", { name: f.name, email: f.email, password: FRIEND_PW, currency: f.currency }); if (r.status !== 200) throw new Error(f.email + ": " + r.j.error); }

const me = (await owner("GET", "/api/auth/me")).j; const ownerName = me.user?.name || me.name || "Owner";
const c = await owner("POST", "/api/kitties", { draft: { name: "Lisbon Weekender (mock)", destination: "Lisbon, Portugal", tagline: "Six friends, one apartment, zero spreadsheets.", baseCurrency: "EUR", totalBudget: 2400, perPaymentCap: 600, quorum: 3, deadlineDays: 10,
  members: [{ name: ownerName }, ...friends.map((f) => ({ name: f.name }))],
  vendors: [{ name: "Alfama Apartment", email: PAYEE, category: "stay", approved: true }, { name: "Sunset Sailing", email: PAYEE, category: "activity", approved: false }, { name: "Time Out Market", email: PAYEE, category: "food", approved: true }] } });
if (c.status !== 200) throw new Error("create: " + c.j.error);
const { id, inviteCode } = c.j;
for (const f of friends) { const j = await f.s("POST", `/api/join/${inviteCode}`); const sg = await f.s("POST", `/api/kitties/${id}/sign`); console.log("joined+signed", f.name, j.status, sg.status); }
await owner("POST", `/api/kitties/${id}/sign`);

const act = (s, action, label) => s("POST", `/api/kitties/${id}/action`, { action, label });
await act(owner, { type: "request_contributions", params: {} }, "Request everyone's share");
let k = (await owner("GET", `/api/kitties/${id}`)).j.kitty;
for (const m of k.members.slice(0, 4)) await act(owner, { type: "record_cash", params: { memberId: m.id } }, `Record ${m.name}'s share as paid in cash`);
const lastTwo = k.members.slice(4).map((m) => m.id);
await act(owner, { type: "send_reminders", params: { memberIds: lastTwo } }, "Remind the late payers");
const apt = k.vendors.find((v) => v.name === "Alfama Apartment"), sail = k.vendors.find((v) => v.name === "Sunset Sailing");
const p1 = await act(owner, { type: "pay_vendor", params: { vendorId: apt.id, amount: 400, memo: "Apartment deposit" } }, "Pay Alfama Apartment €400");
const p2 = await act(owner, { type: "pay_vendor", params: { vendorId: sail.id, amount: 300, memo: "Sailing trip" } }, "Pay Sunset Sailing €300");
console.log("apartment:", p1.j.decision, "| sailing:", p2.j.decision, "(left pending for you to vote on)");

const lines = [`Group: ${BASE}/k/${id}`, `Invite link: ${BASE}/join/${inviteCode}`, `Owner: ${OWNER_EMAIL}`, `Friends' password: ${FRIEND_PW}`, ...friends.map((f) => `  ${f.email}  (${f.name}, ${f.currency})`)];
import("node:fs").then((fs) => { fs.mkdirSync(".data", { recursive: true }); fs.writeFileSync(".data/mock-accounts.txt", lines.join("\n") + "\n"); });
console.log("\n" + lines.join("\n"));
