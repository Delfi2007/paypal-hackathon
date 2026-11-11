import { describe, expect, it } from "vitest";
import { assertOrderOwnership } from "../src/lib/orderGuard";
import { kitty } from "./helpers";

describe("order capture ownership", () => {
  const k = kitty();
  const me = { id: "u2" };

  it("accepts a real order stamped for this member and kitty", () => {
    expect(() => assertOrderOwnership(k, me, "5O190127TN364715T", "k1:u2")).not.toThrow();
  });

  it("rejects an order stamped for another member", () => {
    expect(() => assertOrderOwnership(k, me, "5O190127TN364715T", "k1:u3")).toThrow(/does not belong/);
  });

  it("rejects an order stamped for another kitty", () => {
    expect(() => assertOrderOwnership(k, me, "5O190127TN364715T", "k9:u2")).toThrow(/does not belong/);
  });

  it("rejects a real order with no custom_id", () => {
    expect(() => assertOrderOwnership(k, me, "5O190127TN364715T", undefined)).toThrow(/does not belong/);
  });

  it("rejects an order id that was already credited in this kitty", () => {
    const used = kitty();
    used.members[2].orderId = "5O190127TN364715T";
    expect(() => assertOrderOwnership(used, me, "5O190127TN364715T", "k1:u2")).toThrow(/already been recorded/);
  });

  it("lets simulated orders through (they never touch PayPal) but not replayed", () => {
    expect(() => assertOrderOwnership(k, me, "SIM-ORDER-ABC", undefined)).not.toThrow();
    const used = kitty();
    used.members[1].orderId = "SIM-ORDER-ABC";
    expect(() => assertOrderOwnership(used, me, "SIM-ORDER-ABC", undefined)).toThrow(/already been recorded/);
  });
});
