import { afterEach, describe, expect, it } from "vitest";
import { DEMO_DOMAIN, demoEnabled, isDemoEmail } from "../src/lib/demo";

describe("demo accounts", () => {
  it("recognises only the reserved demo domain", () => {
    expect(isDemoEmail(`asha-ab12-1${DEMO_DOMAIN}`)).toBe(true);
    expect(isDemoEmail("ASHA@DEMO.KITTY.TEST")).toBe(true);
    expect(isDemoEmail("asha@kitty.test")).toBe(false);
    expect(isDemoEmail("asha@demo.kitty.test.evil.com")).toBe(false);
    expect(isDemoEmail("demo.kitty.test@gmail.com")).toBe(false);
  });

  afterEach(() => { delete process.env.KITTY_DEMO; });

  it("is on unless switched off", () => {
    expect(demoEnabled()).toBe(true);
    process.env.KITTY_DEMO = "off";
    expect(demoEnabled()).toBe(false);
  });
});
