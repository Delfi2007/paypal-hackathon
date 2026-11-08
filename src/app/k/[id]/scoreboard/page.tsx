"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Check, Loader2, Pencil, Send, Sparkles } from "lucide-react";
import { studioTheme } from "ag-studio";
import { useKitty } from "@/components/KittyShell";
import { Avatar, Chip, FeatureTag, api } from "@/components/kit";
import { fmt } from "@/lib/money";

// AG Studio touches the DOM on import, so it only loads in the browser.
const AgStudio = dynamic(() => import("ag-studio-react").then((m) => m.AgStudio), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-blue" /></div>,
});

const TONE_LABEL: Record<string, string> = { prompt: "Prompt payer", forgetful: "Forgetful", late: "Often late", new: "New" };

export default function ScoreboardPage() {
  const { kitty: k, reload } = useKitty();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const cur = k.baseCurrency;
  const money = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }), [cur]);

  const data = useMemo(
    () => ({
      sources: [
        {
          id: "friends",
          name: "Friends",
          data: k.members.map((m) => ({
            friend: m.name, pays_in: m.currency, owes: m.share, paid: m.paid,
            remaining: Math.max(0, Math.round((m.share - m.paid) * 100) / 100), nudges: m.remindersSent,
            tone: TONE_LABEL[m.persona] ?? m.persona, status: m.paid >= m.share ? "Paid up" : "Still owes",
          })),
          fields: [
            { id: "friend", name: "Friend", format: "textFormat" },
            { id: "pays_in", name: "Pays in", format: "textFormat" },
            { id: "owes", name: "Share", format: "currencyFormat", formatOptions: { format: money } },
            { id: "paid", name: "Paid", format: "currencyFormat", formatOptions: { format: money } },
            { id: "remaining", name: "Still owes", format: "currencyFormat", formatOptions: { format: money } },
            { id: "nudges", name: "Nudges sent", format: "integerFormat" },
            { id: "tone", name: "Reminder tone", format: "textFormat" },
            { id: "status", name: "Status", format: "textFormat" },
          ],
        },
        {
          id: "activity",
          name: "Activity",
          data: k.ledger.map((e) => ({ when: new Date(e.ts), actor: e.actorName ?? e.actor, kind: e.kind, event: e.title, amount: e.amount ?? 0 })),
          fields: [
            { id: "when", name: "When", format: "dateTimeFormat" },
            { id: "actor", name: "Actor", format: "textFormat" },
            { id: "kind", name: "Type", format: "textFormat" },
            { id: "event", name: "Event", format: "textFormat" },
            { id: "amount", name: "Amount", format: "currencyFormat", formatOptions: { format: money } },
          ],
        },
      ],
    }),
    [k.members, k.ledger, money],
  );

  const report = useMemo(() => {
    const ink = "#141a4d";
    const widget = (type: string, dataMapping: unknown, title: string, extra: Record<string, unknown> = {}) => ({
      type, dataMapping, format: { title: { enabled: true, text: title, typography: { fontWeight: "bold", fontSize: 15 } }, ...extra },
    });
    return {
      selectedPageId: "owing",
      pages: [
        {
          id: "owing",
          layout: { type: "widget", minWidth: 0, maxWidth: undefined, height: undefined, columns: 24, rowHeight: 30, pagePadding: 12, backgroundColor: "#f4f5f9", widgetPadding: 8, widgetBackgroundColor: "#ffffff", widgetBorderEnabled: true, widgetBorderRadius: 18, widgetBorderColor: "#e4e7f2", widgetBorderWidth: 1 },
          widgets: {
            hero: {
              type: "text", dataMapping: {},
              format: { widget: { backgroundColor: "#141a4d" }, style: { text: `${k.name}: the scoreboard`, color: "#ffffff", typography: { fontSize: 20, fontWeight: "bold" }, verticalAlign: "center", padding: true } },
            },
            pool: widget("value", { value: [{ id: "friends.paid", aggregation: "sum" }] }, "In the pool", { style: { typography: { fontSize: 34, fontWeight: "bold" }, color: "#16c75a", verticalAlign: "center" } }),
            owed: widget("value", { value: [{ id: "friends.remaining", aggregation: "sum" }] }, "Still to collect", { style: { typography: { fontSize: 34, fontWeight: "bold" }, color: "#ef3e5c", verticalAlign: "center" } }),
            bars: widget("bar-chart-stacked", { categoryKey: [{ id: "friends.friend" }], valueKey: [{ id: "friends.paid", aggregation: "sum" }, { id: "friends.remaining", aggregation: "sum" }] }, "Paid vs still owed, per friend"),
            donut: widget("donut-chart", { categoryKey: [{ id: "friends.friend" }], valueKey: [{ id: "friends.paid", aggregation: "sum" }] }, "Who has put in what"),
            table: widget("grid", { cols: [{ id: "friends.friend" }, { id: "friends.pays_in" }, { id: "friends.owes" }, { id: "friends.paid" }, { id: "friends.remaining" }, { id: "friends.nudges" }, { id: "friends.tone" }, { id: "friends.status" }] }, "The scoreboard"),
          },
          widgetLayout: {
            hero: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 3 },
            pool: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 3 },
            owed: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 3 },
            bars: { xTrack: 0, yTrack: 3, xSpan: 14, ySpan: 8 },
            donut: { xTrack: 14, yTrack: 3, xSpan: 10, ySpan: 8 },
            table: { xTrack: 0, yTrack: 11, xSpan: 24, ySpan: 8 },
          },
        },
        {
          id: "money",
          layout: { type: "widget", minWidth: 0, maxWidth: undefined, height: undefined, columns: 24, rowHeight: 30, pagePadding: 12, backgroundColor: "#f4f5f9", widgetPadding: 8, widgetBackgroundColor: "#ffffff", widgetBorderEnabled: true, widgetBorderRadius: 18, widgetBorderColor: "#e4e7f2", widgetBorderWidth: 1 },
          widgets: {
            byKind: widget("bar-chart-grouped", { categoryKey: [{ id: "activity.kind" }], valueKey: [{ id: "activity.amount", aggregation: "sum" }] }, "Money by type of event"),
            log: widget("grid", { cols: [{ id: "activity.when" }, { id: "activity.actor" }, { id: "activity.kind" }, { id: "activity.event" }, { id: "activity.amount" }] }, "Audit trail"),
          },
          widgetLayout: {
            byKind: { xTrack: 0, yTrack: 0, xSpan: 10, ySpan: 9 },
            log: { xTrack: 10, yTrack: 0, xSpan: 14, ySpan: 9 },
          },
        },
      ],
    };
  }, [k.name]);

  const theme = useMemo(
    () =>
      (studioTheme as unknown as { withParams: (p: Record<string, unknown>) => typeof studioTheme }).withParams({
        accentColor: "#2f5bff",
        fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
        borderRadius: 12,
        studioCanvasFontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
        studioCanvasBackgroundColor: "#f4f5f9",
      }),
    [],
  );

  const owing = k.members.filter((m) => m.paid < m.share);

  async function nudge() {
    setBusy(true);
    try {
      await api(`/api/kitties/${k.id}/action`, { label: "Nudge-bot: send friendly reminders", action: { type: "send_reminders", params: { memberIds: owing.map((m) => m.id) }, reasoning: "Nudge-bot read the scoreboard and sent a friendly reminder to everyone who still owes." } });
      await reload();
    } finally { setBusy(false); }
  }

  const lastReminder = k.ledger.find((e) => e.kind === "reminder" && e.messages?.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2"><FeatureTag n="12" label="AG Studio scoreboard" /><FeatureTag n="08" label="Nudge-bot" /></div>
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div>
          <p className="label">Powered by AG Studio</p>
          <h1 className="display text-4xl sm:text-5xl font-medium mt-1">The friendly scoreboard</h1>
          <p className="text-ink-2 mt-2 max-w-xl">A live dashboard of who has paid and who still owes, built with AG Studio. Click a bar or slice to cross-filter everything. A nudge-bot reads it and writes each friend a reminder in their own tone.</p>
        </div>
        <button onClick={() => setMode(mode === "view" ? "edit" : "view")} className="btn btn-ghost text-sm"><Pencil size={15} /> {mode === "view" ? "Customise the dashboard" : "Back to view"}</button>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="panel overflow-hidden rise" style={{ height: mode === "edit" ? "78vh" : "min(78vh, 760px)" }}>
          <AgStudio key={mode} data={data as never} mode={mode} initialState={report as never} theme={theme as never} />
        </div>

        <aside className="panel p-6 rise" style={{ animationDelay: ".1s" }}>
          <p className="label flex items-center gap-1.5"><Sparkles size={13} /> Nudge-bot</p>
          <h2 className="display text-3xl font-medium mt-1">Gentle, not nagging</h2>
          <p className="text-sm text-ink-2 mt-2">Reads the scoreboard and drafts a reminder per person, light for the prompt payer, warm and specific for the late one.</p>
          <ul className="mt-4 space-y-2">
            {owing.length === 0 && <li className="text-sm text-mute">Everyone has paid. Nothing to nudge 🎉</li>}
            {owing.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-soft/60 p-3">
                <Avatar m={m} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.name}</p>
                  <p className="text-xs text-mute">owes {fmt(m.share - m.paid, cur)} · {m.remindersSent} nudge{m.remindersSent === 1 ? "" : "s"} sent</p>
                </div>
                <Chip tone={m.persona === "late" ? "warn" : m.persona === "forgetful" ? "blue" : "mute"}>{TONE_LABEL[m.persona]}</Chip>
              </li>
            ))}
          </ul>
          <button onClick={nudge} disabled={busy || owing.length === 0} className="btn btn-dark w-full mt-4">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send friendly nudges
          </button>
          {lastReminder?.messages && (
            <div className="mt-5">
              <p className="label flex items-center gap-1.5"><Check size={12} /> Last sent</p>
              <div className="mt-2 space-y-2">
                {lastReminder.messages.slice(0, 3).map((m, i) => (
                  <div key={i} className="rounded-2xl rounded-tl-md bg-[#e9f0ff] px-3 py-2 text-sm"><b>{m.to}:</b> {m.text}</div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
