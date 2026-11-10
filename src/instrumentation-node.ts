// Starts the scheduler timer (free, no external service): every 10 minutes the app chases late
// payers, renews/captures holds and syncs PayPal. Turn it off with KITTY_SCHEDULER=off
// (e.g. on serverless hosts: call GET /api/cron/tick from any free cron service instead).
import { runTick } from "./lib/scheduler";

const g = globalThis as unknown as { __kittyTimer?: ReturnType<typeof setInterval> };

if (process.env.KITTY_SCHEDULER !== "off" && !g.__kittyTimer) {
  const every = Math.max(1, Number(process.env.KITTY_SCHEDULER_MINUTES) || 10) * 60_000;
  const tick = async () => {
    try {
      const r = await runTick();
      if (r.reminders || r.holdsCaptured || r.holdsReleased || r.holdsRenewed || r.nudges || r.proposalsExpired || r.payoutsUpdated || r.invoicesSynced)
        console.log("[scheduler]", JSON.stringify(r));
    } catch (e) {
      console.error("[scheduler] tick failed", e);
    }
  };
  g.__kittyTimer = setInterval(tick, every);
  g.__kittyTimer.unref?.();
  setTimeout(tick, 30_000).unref?.();
}
