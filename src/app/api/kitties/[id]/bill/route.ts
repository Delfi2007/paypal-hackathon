import { fail, needKitty, ok } from "@/lib/api";
import { log, mutate, uid } from "@/lib/store";
import { parseBill } from "@/lib/ai";
import { convert, fmt } from "@/lib/money";
import { round2 } from "@/lib/policy";
import type { Bill, Currency } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await needKitty(id);
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const hint = String(form.get("hint") ?? "");
    let image: { data: string; mime: string } | null = null;
    if (file && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) throw new Error("Image too large (max 8 MB)");
      image = { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mime: file.type || "image/jpeg" };
    }

    const out = await mutate(id, async (k) => {
      const parsed = await parseBill(k, image, hint);
      const cur = (CURRENCIES.includes(parsed.currency) ? parsed.currency : k.baseCurrency) as Currency;
      const memberIds = k.members.map((m) => m.id);

      // Itemised subtotals per member, then tax + tip in proportion.
      const sub: Record<string, number> = Object.fromEntries(memberIds.map((m) => [m, 0]));
      for (const it of parsed.items) {
        const who = (it.assignedTo ?? []).filter((x) => memberIds.includes(x));
        const list = who.length ? who : memberIds;
        for (const m of list) sub[m] += Number(it.price) / list.length;
      }
      const subtotal = Object.values(sub).reduce((a, b) => a + b, 0) || 1;
      const extras = Number(parsed.tax || 0) + Number(parsed.tip || 0);
      const splits: Record<string, number> = {};
      for (const m of memberIds) splits[m] = round2(await convert(sub[m] + (sub[m] / subtotal) * extras, cur, k.baseCurrency));
      const totalBase = round2(Object.values(splits).reduce((a, b) => a + b, 0));

      // Match or create the merchant as a payee (not pre-approved).
      const merchant = parsed.merchant?.replace(/\(sample receipt\)/i, "").trim() || "Restaurant";
      let vendor = k.vendors.find((v) =>
        v.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && merchant.toLowerCase().includes(w)),
      );
      if (!vendor) {
        vendor = { id: uid("v_"), name: merchant, email: `${merchant.toLowerCase().replace(/[^a-z]/g, "").slice(0, 20)}@business.example.com`, category: "food" };
        k.vendors.push(vendor);
      }

      const bill: Bill = {
        id: uid("b_"),
        ts: new Date().toISOString(),
        merchant,
        currency: cur,
        items: parsed.items.map((i) => ({ name: i.name, price: Number(i.price), assignedTo: i.assignedTo ?? [] })),
        tax: Number(parsed.tax || 0),
        tip: Number(parsed.tip || 0),
        total: Number(parsed.total || 0),
        splits,
      };
      k.bills.unshift(bill);
      log(k, {
        actor: "agent",
        kind: "bill",
        title: `Read the ${merchant} receipt — ${parsed.items.length} items, ${fmt(bill.total, cur)}`,
        detail: k.members.map((m) => `${m.name} ${fmt(splits[m.id], k.baseCurrency)}`).join(" · "),
        reasoning: parsed.note || (hint ? `Split using: “${hint}”` : "Shared items split evenly; tax and tip in proportion."),
      });
      return { bill, vendorId: vendor.id, totalBase, note: parsed.note };
    });
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
