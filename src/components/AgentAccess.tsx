"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { api, timeAgo } from "./kit";

type Tok = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

export function AgentAccess() {
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [name, setName] = useState("Claude");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => api<{ tokens: Tok[] }>("/api/auth/tokens").then((r) => setTokens(r.tokens)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { const r = await api<{ token: string }>("/api/auth/tokens", { name }); setFresh(r.token); await load(); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    await fetch("/api/auth/tokens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }
  const copy = (key: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(key); setTimeout(() => setCopied(null), 1400); };

  const origin = typeof location !== "undefined" ? location.origin : "http://localhost:3000";
  const config = JSON.stringify({ mcpServers: { kitty: { command: "node", args: ["mcp/kitty-mcp.mjs"], env: { KITTY_URL: origin, KITTY_TOKEN: fresh ?? "kty_paste_your_token_here" } } } }, null, 2);

  return (
    <section id="agents" className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-3xl font-medium">Agent access</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efe9ff] text-[#6a4bd8] px-2.5 py-1 text-[11px] font-semibold"><Bot size={12} /> MCP</span>
      </div>
      <p className="text-ink-2 mt-2 max-w-2xl">Let your own AI agent (Claude Desktop, Claude Code, Cursor…) run your kitties over the Model Context Protocol. It is bound by the same mandate as everyone else: in-rule payments execute, anything else opens a vote for your friends.</p>

      <div className="grid gap-6 lg:grid-cols-2 mt-5">
        <div className="panel p-6">
          <form onSubmit={create} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input !py-2.5" placeholder="Token name, e.g. Claude" aria-label="Token name" />
            <button disabled={busy} className="btn btn-dark !py-2.5 text-sm">{busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Create token</button>
          </form>
          {fresh && (
            <div className="mt-4 rounded-2xl bg-ok-soft border border-ok/30 p-4 pop">
              <p className="text-sm font-semibold text-[#0e8f40]">Copy it now. You will not see it again.</p>
              <div className="mt-2 flex gap-2"><code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs">{fresh}</code>
                <button onClick={() => copy("tok", fresh)} className="btn btn-dark !p-2.5" aria-label="Copy token">{copied === "tok" ? <Check size={14} /> : <Copy size={14} />}</button></div>
            </div>
          )}
          <ul className="mt-4 divide-y divide-line text-sm">
            {tokens.length === 0 && <li className="py-3 text-mute">No tokens yet.</li>}
            {tokens.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <KeyRound size={15} className="text-mute" />
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{t.name}</p><p className="text-xs text-mute">created {timeAgo(t.createdAt)} · {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}</p></div>
                <button onClick={() => revoke(t.id)} className="btn btn-ghost !p-2" aria-label="Revoke token"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] bg-night text-white p-6 overflow-hidden">
          <div className="flex items-center justify-between"><p className="label !text-white/60">claude_desktop_config.json</p>
            <button onClick={() => copy("cfg", config)} className="text-xs font-semibold text-mint flex items-center gap-1">{copied === "cfg" ? <Check size={13} /> : <Copy size={13} />} Copy</button></div>
          <pre className="mt-3 text-[12px] leading-relaxed text-white/85 overflow-x-auto">{config}</pre>
          <p className="mt-3 text-xs text-white/50">Run it from the repo folder. Tools: kitty_status, kitty_pay_vendor, kitty_request_shares, kitty_send_reminders, kitty_ask, kitty_open_proposals, kitty_vote, kitty_audit.</p>
        </div>
      </div>
    </section>
  );
}
