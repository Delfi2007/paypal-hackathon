// Creates three real test accounts and one real group through the normal API, so judges can
// log in as different friends and try voting, signing and paying without making their own.
//   npm run dev        (in another terminal)
//   npm run seed:judges
const BASE = process.env.KITTY_URL || "http://localhost:3000";
const PASSWORD = process.env.JUDGE_PASSWORD || "judge-demo-2026";
const PEOPLE = [
  { name: "Delfi (organiser)", email: "judge1@kitty.test", currency: "EUR" },
  { name: "Mukesh", email: "judge2@kitty.test", currency: "GBP" },
  { name: "Nambert", email: "judge3@kitty.test", currency: "USD" },
];

function session() {
  let cookie = "";
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { "Content-Type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
    const j = await r.json().catch(() => ({}));
    return { status: r.status, j };
  };
}

const sessions = [];
for (const p of PEOPLE) {
  const s = session();
  let r = await s("POST", "/api/auth/signup", { ...p, password: PASSWORD });
  if (r.status === 409) r = await s("POST", "/api/auth/login", { email: p.email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`${p.email}: ${r.j.error}`);
  sessions.push(s);
}

const [owner, ...others] = sessions;
const existing = (await owner("GET", "/api/kitties")).j;
let id, code;
if (Array.isArray(existing) && existing.find((k) => k.name === "Goa Trip (judge demo)")) {
  id = existing.find((k) => k.name === "Goa Trip (judge demo)").id;
  console.log("group already exists:", id);
} else {
  const draft = {
    name: "Goa Trip (judge demo)", destination: "Goa, India", tagline: "Three friends, one beach villa, zero awkward money chats.",
    baseCurrency: "EUR", totalBudget: 3000, perPaymentCap: 1000, quorum: 2, deadlineDays: 7,
    members: [{ name: "a" }, { name: "b" }, { name: "c" }],
    vendors: [
      { name: "Beach Villa", email: process.env.PAYEE_EMAIL || "sb-snium53762550@business.example.com", category: "stay", approved: true },
      { name: "Scooter Rental", email: process.env.PAYEE_EMAIL || "sb-snium53762550@business.example.com", category: "transport", approved: false },
    ],
  };
  const c = await owner("POST", "/api/kitties", { draft });
  if (c.status !== 200) throw new Error(c.j.error);
  id = c.j.id; code = c.j.inviteCode;
  for (const s of others) {
    await s("POST", `/api/join/${code}`);
    await s("POST", `/api/kitties/${id}/sign`);
  }
  console.log("created group", id);
}

console.log("\nJudge test accounts (password for all: " + PASSWORD + ")");
for (const p of PEOPLE) console.log("  ", p.email.padEnd(20), p.name, `(pays in ${p.currency})`);
console.log(`\nOpen ${BASE}/login, sign in as any of them, then open the group "Goa Trip (judge demo)".`);
