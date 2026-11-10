// A friend drops out: refund, re-split the same budget, top-up invoices for the difference only.
//   KITTY_URL=http://localhost:3001 node scripts/e2e-dropout.mjs
const BASE = process.env.KITTY_URL || "http://localhost:3000";
const PAYEE = process.env.PAYEE_EMAIL || "sb-ukfe353773873@personal.example.com";
const RUN = Date.now(), PW = "drop-" + RUN;
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); };
const session = () => { let c = ""; return async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: { "Content-Type": "application/json", cookie: c }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.getSetCookie?.() ?? []; if (sc.length) c = sc.map((x) => x.split(";")[0]).join("; "); return { status: r.status, j: await r.json().catch(() => ({})) }; }; };

const P = ["Alice", "Ben", "Cara", "Dev"].map((n) => ({ name: n, email: `drop${RUN}-${n.toLowerCase()}@kitty.test`, s: session() }));
for (const p of P) await p.s("POST", "/api/auth/signup", { name: p.name, email: p.email, password: PW, currency: "EUR", paypalEmail: PAYEE });
const [alice, ben, cara, dev] = P;

const c = await alice.s("POST", "/api/kitties", { draft: { name: `Dropout ${RUN}`, destination: "Porto", tagline: "", baseCurrency: "EUR", totalBudget: 4000, perPaymentCap: 1500, quorum: 2, deadlineDays: 7, members: P.map((p) => ({ name: p.name })), vendors: [{ name: "Casa Verde", email: PAYEE, category: "stay", approved: true }] } });
const { id, inviteCode } = c.j;
for (const p of [ben, cara, dev]) { await p.s("POST", `/api/join/${inviteCode}`); await p.s("POST", `/api/kitties/${id}/sign`); }
const get = async (who = alice) => (await who.s("GET", `/api/kitties/${id}`)).j;
let k = (await get()).kitty;
check("group of 4, share 1000 each", k.members.length === 4 && k.sharePerMember === 1000);

await alice.s("POST", `/api/kitties/${id}/action`, { action: { type: "request_contributions", params: {} } });
k = (await get()).kitty;
const ids = Object.fromEntries(k.members.map((m) => [m.name, m.id]));
for (const n of ["Alice", "Ben", "Dev"]) await alice.s("POST", `/api/kitties/${id}/action`, { action: { type: "record_cash", params: { memberId: ids[n] } } });
k = (await get()).kitty;
const pool = k.members.reduce((s, m) => s + m.paid, 0);
check("Alice, Ben and Dev paid; Cara has not", Math.abs(pool - 3000) < 1.5, `pool ${pool.toFixed(2)}`);
const devInvoice = k.members.find((m) => m.name === "Dev").invoiceId;

// only the person themselves (or the organiser) can start it
const bad = await ben.s("POST", `/api/kitties/${id}/action`, { action: { type: "drop_member", params: { memberId: ids.Cara } } });
check("a friend cannot remove someone else", bad.status === 403);
const orgDrop = await alice.s("POST", `/api/kitties/${id}/action`, { action: { type: "drop_member", params: { memberId: ids.Alice } } });
check("the organiser cannot be dropped", orgDrop.j.decision === "block", orgDrop.j.decision);

const ask = await dev.s("POST", `/api/kitties/${id}/action`, { action: { type: "drop_member", params: { memberId: ids.Dev } }, label: "Dev asks to leave" });
check("leaving needs the group's vote", ask.j.decision === "needs_quorum", ask.j.decision);
k = (await get()).kitty;
const prop = k.proposals.find((p) => p.status === "pending" && p.action.type === "drop_member");
check("proposal is open and nothing has changed yet", !!prop && k.members.length === 4 && k.sharePerMember === 1000);

await ben.s("POST", `/api/kitties/${id}/vote`, { proposalId: prop.id, approve: true });
const after = await get();
k = after.kitty;
check("quorum reached: the proposal executed", k.proposals.find((p) => p.id === prop.id).status === "executed");
check("Dev is out; 3 friends remain", k.members.length === 3 && !k.members.some((m) => m.name === "Dev"));
check("shares re-split 1000 -> 1333.33", k.sharePerMember === 1333.33 && k.members.every((m) => m.share === 1333.33), `share ${k.sharePerMember}`);
const poolAfter = k.members.reduce((s, m) => s + m.paid, 0) - k.spent;
check("Dev was refunded: pool 3000 -> 2000", Math.abs(poolAfter - 2000) < 1.5, `pool ${poolAfter.toFixed(2)}`);
check("refund is in the audit trail", k.ledger.some((e) => /Refunded Dev/.test(e.title)));
check("re-split is in the audit trail", k.ledger.some((e) => /Dev left the kitty/.test(e.title)));
const ab = k.members.filter((m) => m.name === "Alice" || m.name === "Ben");
check("Alice and Ben owe only the difference (333.33)", ab.every((m) => Math.abs(m.share - m.paid - 333.33) < 0.02), ab.map((m) => `${m.name} paid ${m.paid} owes ${(m.share - m.paid).toFixed(2)}`).join("; "));
check("a fresh PayPal invoice was issued for the top-ups", ab.every((m) => /^INV2-/.test(m.invoiceId || "") || m.invoiceId?.startsWith("SIM-")), ab.map((m) => m.invoiceId).join(", "));
check("departed friend recorded", k.departed?.[0]?.name === "Dev" && k.departed[0].refunded === 1000);
check("Dev can no longer open the kitty", (await dev.s("GET", `/api/kitties/${id}`)).status === 403);
const list = await dev.s("GET", "/api/kitties");
check("and it vanished from Dev's list", !list.j.some?.((x) => x.id === id));
check("audit chain still verifies", after.chain.ok, `${after.chain.checked} events`);
const notes = await ben.s("GET", "/api/notifications");
check("friends were notified", notes.j.items.some((n) => /left/.test(n.title)));
console.log(`\n${pass} passed, ${fail} failed   (Dev's old invoice ${devInvoice})   ${BASE}/k/${id}`);
process.exit(fail ? 1 : 0);
