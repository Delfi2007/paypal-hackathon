// One-click demo: a visitor gets a ready-made group of three friends and can switch
// between them, so the whole flow (sign, pay, vote, payout) is testable from one browser.
// Demo accounts live on a reserved email domain that nobody can sign up with.

export const DEMO_DOMAIN = "@demo.kitty.test";
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(DEMO_DOMAIN);
/** On by default; set KITTY_DEMO=off to remove the demo entry point. */
export const demoEnabled = () => process.env.KITTY_DEMO !== "off";
