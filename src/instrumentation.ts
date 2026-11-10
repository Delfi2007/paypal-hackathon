// Runs once when the Next.js server boots. The Node-only scheduler lives in instrumentation-node.ts so
// it is never bundled for the Edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
