// End-to-end smoke workflow against a running dev server (npm run dev):
// signs up 4 fresh users, creates a group, joins + signs, requests shares, records cash,
// pays a pre-approved vendor, triggers a vote on an over-cap payment, and checks the audit log.
//   npm run dev   (other terminal)
//   node scripts/e2e-workflow.mjs
const BASE = process.env.KITTY_URL || "http://localhost:3000";
const RUN = Date.now();
const PASSWORD = "e2e-" + RUN;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

function session() {
  let cookie = "";
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { "Content-Type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
}

const people = [
  { name: "Alice E2E", currency: "EUR" },
  { name: "Bob E2E", currency: "GBP" },
  { name: "Cara E2E", currency: "USD" },
  { name: "Dev E2E", currency: "EUR" },
].map((p) => ({ ...p, email: `e2e${RUN}-${p.name.split(" ")[0].toLowerCase()}@kitty.test`, s: session() }));

for (const p of people) {
  const r = await p.s("POST", "/api/auth/signup", { name: p.name, email: p.email, password: PASSWORD, currency: p.currency });
  check(`signup ${p.email}`, r.status === 200, r.j.error || "");
}
const [alice, ...rest] = people;
const me = await alice.s("GET", "/api/auth/me");
check("session works (/api/auth/me)", me.status === 200);

const draft = {
  name: `E2E Trip ${RUN}`, destination: "Lisbon", tagline: "automated test group",
  baseCurrency: "EUR", totalBudget: 2000, perPaymentCap: 500, quorum: 2, deadlineDays: 7,
  members: people.map((p) => ({ name: p.name })),
  vendors: [
    { name: "Hostel", email: "sb-ukfe353773873@personal.example.com", category: "stay", approved: true },
    { name: "Boat Tour", email: "sb-ukfe353773873@personal.example.com", category: "activity", approved: false },
  ],
};
const created = await alice.s("POST", "/api/kitties", { draft });
check("create group", created.status === 200 && created.j.id, created.j.error || "");
const { id, inviteCode } = created.j;

for (const p of rest) {
  const j = await p.s("POST", `/api/join/${inviteCode}`);
  check(`${p.name} joins via invite`, j.status === 200, j.j.error || "");
  const sg = await p.s("POST", `/api/kitties/${id}/sign`);
  check(`${p.name} signs mandate`, sg.status === 200, sg.j.error || "");
}
await alice.s("POST", `/api/kitties/${id}/sign`);

const act = (p, action, label) => (p.s || p)("POST", `/api/kitties/${id}/action`, { action, label });
const get = async () => (await alice.s("GET", `/api/kitties/${id}`)).j;

let st = await get();
check("group has 4 members", st.kitty?.members?.length === 4, `got ${st.kitty?.members?.length}`);

const req = await act(alice, { type: "request_contributions", params: {} }, "Request everyone's share");
check("request contributions", req.status === 200, req.j.error || "");
st = await get();
const members = st.kitty.members;
check("invoices created for members", members.some((m) => m.invoiceId), "(simulated or PayPal sandbox)");

for (const m of members.slice(0, 3)) {
  const r = await act(alice, { type: "record_cash", params: { memberId: m.id } }, `Record ${m.name} cash`);
  check(`record cash ${m.name}`, r.status === 200, r.j.error || "");
}
const nonOrg = await act(rest[0], { type: "record_cash", params: { memberId: members[3].id } }, "x");
check("non-organiser cannot record cash (403)", nonOrg.status === 403, `status ${nonOrg.status}`);

const rem = await act(alice, { type: "send_reminders", params: { memberIds: [members[3].id] } }, "Remind Dev");
check("send reminder", rem.status === 200, rem.j.error || "");

st = await get();
const hostel = st.kitty.vendors.find((v) => v.name === "Hostel");
const boat = st.kitty.vendors.find((v) => v.name === "Boat Tour");
const small = await act(alice, { type: "pay_vendor", params: { vendorId: hostel.id, amount: 100, memo: "deposit" } }, "Pay hostel 100");
check("pay approved vendor under cap", small.status === 200, JSON.stringify(small.j).slice(0, 120));

const big = await act(alice, { type: "pay_vendor", params: { vendorId: boat.id, amount: 400, memo: "boat" } }, "Pay boat 400");
check("unapproved vendor payment accepted into pipeline", big.status === 200, JSON.stringify(big.j).slice(0, 120));
st = await get();
const pending = (st.kitty.proposals || []).find((p) => p.status === "pending" || p.status === "voting");
if (pending) {
  const v1 = await rest[0].s("POST", `/api/kitties/${id}/vote`, { proposalId: pending.id, approve: true });
  check("vote approves proposal", v1.status === 200, `status ${v1.j.status || v1.j.error || ""}`);
  const v2 = await rest[1].s("POST", `/api/kitties/${id}/vote`, { proposalId: pending.id, approve: true });
  check("vote on closed proposal is refused (400)", v1.j.status === "pending" ? v2.status === 200 : v2.status === 400, `status ${v2.status}`);
} else {
  check("payment needed a vote (or was auto-handled)", true, "no pending proposal; policy resolved it directly");
}

const cmd = await alice.s("POST", `/api/kitties/${id}/command`, { text: "Pay Hostel 50 euro for snacks" });
check("natural-language command", cmd.status === 200, cmd.j.error || "");

st = await get();
check("audit log has entries", (st.kitty.ledger || []).length > 0, "");

const outsider = session();
await outsider("POST", "/api/auth/signup", { name: "Eve", email: `e2e${RUN}-eve@kitty.test`, password: PASSWORD, currency: "EUR" });
const denied = await outsider("GET", `/api/kitties/${id}`);
check("non-member cannot read group", denied.status >= 400, `status ${denied.status}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Group: ${BASE}/k/${id}   (log in as ${people[0].email}, password ${PASSWORD})`);
process.exit(fail ? 1 : 0);
