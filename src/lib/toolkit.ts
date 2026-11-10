// PayPal's official Agent Toolkit (@paypal/agent-toolkit), used the safe way.
//
// The toolkit is itself an MCP server whose tools can create orders, send invoices and so on. Kitty
// must never let an AI skip the group's mandate, so we start it with a READ-ONLY allow-list: it can
// look things up (invoices, orders, disputes, transactions) but cannot move money. Everything that
// moves money still goes through Kitty's policy engine and PayPal's REST API.

import { PayPalAgentToolkit } from "@paypal/agent-toolkit/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { paypalAccessToken, paypalConfigured } from "./paypal";

const READ_ONLY = {
  actions: {
    invoices: { list: true, get: true },
    orders: { get: true },
    disputes: { list: true, get: true },
    transactions: { list: true },
    subscriptions: { show: true },
    subscriptionPlans: { list: true, show: true },
    products: { list: true, show: true },
  },
  context: { sandbox: true },
};

export const toolkitAvailable = () => paypalConfigured();

let client: { c: Client; at: number } | null = null;

async function connect(): Promise<Client> {
  // The toolkit holds an access token, so rebuild it well before the token's one-hour expiry.
  if (client && Date.now() - client.at < 20 * 60_000) return client.c;
  const token = await paypalAccessToken();
  const toolkit = new PayPalAgentToolkit({ accessToken: token, configuration: READ_ONLY as never });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await toolkit.connect(serverSide);
  const c = new Client({ name: "kitty", version: "1.0.0" });
  await c.connect(clientSide);
  client = { c, at: Date.now() };
  return c;
}

/** Call one of the toolkit's tools and return its parsed JSON result. */
export async function toolkitCall<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!toolkitAvailable()) throw new Error("PayPal Agent Toolkit needs PayPal sandbox keys");
  const c = await connect();
  const res = (await c.callTool({ name, arguments: args })) as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = res.content?.map((x) => x.text ?? "").join("") ?? "";
  if (res.isError) throw new Error(text.slice(0, 300) || `Toolkit tool ${name} failed`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function toolkitTools(): Promise<string[]> {
  const c = await connect();
  return (await c.listTools()).tools.map((t) => t.name);
}
