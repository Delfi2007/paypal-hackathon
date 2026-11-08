import Image from "next/image";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Play, ShieldCheck, Sparkles, Vote } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { FEATURES, featureHref } from "@/lib/features";

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white">
      {/* ------------------------------------------------ hero (sky) */}
      <section className="p-3 sm:p-4">
        <div className="relative rounded-[2rem] overflow-hidden min-h-[92vh] flex flex-col">
          <Image src="/images/sky.webp" alt="Blue sky with clouds" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a5bff]/30 via-transparent to-white/10" />
          <div className="relative px-5 sm:px-10 pt-5"><SiteNav light /></div>

          <div className="relative flex-1 flex flex-col items-center text-center px-5 pt-14 sm:pt-20">
            <span className="rise inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full bg-mint" /> Built on PayPal sandbox · Orders · Invoicing · Payouts
            </span>
            <h1 className="display text-white text-5xl sm:text-7xl xl:text-[5.6rem] font-medium mt-6 rise drop-shadow-[0_4px_30px_rgba(0,40,140,.35)]" style={{ animationDelay: ".05s" }}>
              Your group money.<br />On autopilot.
            </h1>
            <p className="text-white/90 text-lg mt-5 max-w-xl rise" style={{ animationDelay: ".1s" }}>
              Kitty is an AI treasurer. It collects everyone&apos;s share through PayPal, pays the vendors and chases the friend who forgot. It only spends inside rules your group signs.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 rise" style={{ animationDelay: ".15s" }}>
              <Link href="/signup" className="btn btn-dark !py-3.5">Get started free <Sparkles size={15} /></Link>
              <Link href="/login" className="btn bg-white/20 backdrop-blur border border-white/40 text-white !py-3.5">Log in <Play size={14} /></Link>
            </div>

            {/* floating product cards */}
            <div className="relative mt-auto w-full max-w-5xl h-[260px] sm:h-[300px]">
              <FloatCard className="left-0 sm:left-[4%] top-10 w-[230px]" delay="0s" r="-6deg">
                <div className="flex items-center justify-between"><span className="text-xs text-mute">Mukesh paid</span><span className="text-[10px] rounded-full bg-ok-soft text-[#0e8f40] px-2 py-0.5 font-semibold">+ Received</span></div>
                <p className="num text-3xl font-semibold mt-2">+ £772<span className="text-mute text-lg">.83</span></p>
                <p className="text-xs text-mute mt-1">→ €900.00 settled to the pool</p>
                <div className="mt-3 flex items-center gap-2 text-xs"><span className="grid place-items-center size-6 rounded-full bg-blue text-white"><ArrowDownLeft size={12} /></span> PayPal Orders v2</div>
              </FloatCard>
              <FloatCard className="left-[calc(50%-130px)] top-0 w-[260px] z-10" delay="-2s">
                <p className="text-xs text-mute">Pay Caldera Cliff Suites</p>
                <p className="num text-3xl font-semibold mt-1">€1,800<span className="text-mute text-lg">.00</span></p>
                <ul className="mt-3 space-y-1.5 text-xs">
                  <li className="flex gap-1.5"><Check size={13} className="text-ok" /> Pre-approved payee</li>
                  <li className="flex gap-1.5"><Check size={13} className="text-ok" /> Pool has €2,700</li>
                  <li className="flex gap-1.5 text-[#6a4bd8] font-semibold"><Vote size={13} /> Over €1,500 cap · 2/3 votes</li>
                </ul>
                <div className="mt-3 h-9 rounded-full bg-blue text-white text-xs font-semibold grid place-items-center">Approve as Ana</div>
              </FloatCard>
              <FloatCard className="right-0 sm:right-[4%] top-12 w-[230px]" delay="-4s" r="6deg">
                <p className="text-xs text-mute">Pool balance</p>
                <p className="num text-3xl font-semibold mt-1">€2,700<span className="text-mute text-lg">.00</span></p>
                <svg viewBox="0 0 200 50" className="w-full h-12 mt-2"><path d="M0 45 L40 38 L70 30 L100 32 L130 18 L160 20 L200 6" fill="none" stroke="#16c75a" strokeWidth="2.5" strokeLinecap="round" /></svg>
                <p className="text-xs text-mute">3 of 5 paid · 6 days left</p>
              </FloatCard>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ PayPal rail */}
      <section className="py-8 overflow-hidden border-b border-line">
        <div className="flex w-max marquee gap-14 text-ink-2/70 font-semibold tracking-[0.2em] text-sm uppercase">
          {[...Array(2)].flatMap((_, j) => ["Orders v2", "JS SDK Buttons", "Invoicing v2", "Payouts v1", "Webhooks", "Multi-currency", "AI agent", "Policy engine", "Quorum votes", "Vision split"].map((t) => <span key={`${j}${t}`} className="flex items-center gap-14">{t}<span className="size-1.5 rounded-full bg-blue/40" /></span>))}
        </div>
      </section>

      {/* ------------------------------------------------ three pillars */}
      <section className="px-5 sm:px-10 lg:px-16 py-24 max-w-7xl mx-auto">
        <h2 className="display text-4xl sm:text-6xl font-medium text-center">Money should move as fast<br />as <span className="text-sky">your group does.</span></h2>
        <p className="text-center text-ink-2 mt-4">Agents propose. Policy decides. Friends vote. PayPal moves the money.</p>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <Pillar title="Speak it." text="Tell Kitty what you need in plain words. It plans the actions and explains each one." link="/signup" cta="Create an account" bg="bg-[#eef4ff]">
            <div className="panel p-4 w-[85%] -rotate-2">
              <p className="text-xs rounded-2xl bg-ink text-white px-3 py-2 w-fit ml-auto">Pay the hotel deposit & nudge Kenji</p>
              <p className="text-xs rounded-2xl bg-soft px-3 py-2 w-fit mt-2">Lining up €1,800 to Caldera Cliff Suites, and sending Kenji a friendly nudge.</p>
            </div>
          </Pillar>
          <Pillar title="Sign it." text="A mandate with a budget, a cap, payees and a quorum. A deterministic policy engine enforces it, and the AI can't get around it." link="/signup" cta="Start a kitty" bg="bg-[#eefaf3]">
            <div className="panel p-4 w-[85%] rotate-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-ok" /> Policy check</div>
              <ul className="mt-2 space-y-1 text-xs"><li>✓ Within total budget</li><li>✓ Pre-approved payee</li><li className="text-[#6a4bd8] font-semibold">✕ Over per-payment cap → vote</li></ul>
            </div>
          </Pillar>
          <Pillar title="Settle it." text="Friends pay in their own currency with PayPal. Approved payouts go out the moment the pool can cover them." link="/signup" cta="Join with a friend link" bg="bg-[#f5f0ff]">
            <div className="panel p-4 w-[85%] -rotate-1">
              <p className="text-xs text-mute">Kenji pays in JPY</p>
              <p className="num text-2xl font-semibold">¥147,000</p>
              <p className="text-xs text-ok font-semibold mt-1">→ released queued sail payout</p>
            </div>
          </Pillar>
        </div>
      </section>

      {/* ------------------------------------------------ feature directory */}
      <section id="features" className="px-5 sm:px-10 lg:px-16 pb-24 max-w-7xl mx-auto scroll-mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Every feature, one click away</p>
            <h2 className="display text-4xl sm:text-5xl font-medium mt-1">Find any feature</h2>
          </div>
          <p className="text-ink-2 max-w-sm text-sm">Each card opens the exact page in the live demo where you can try that feature.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <Link key={f.n} href={featureHref(f)} className="group panel p-6 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <span className="num text-sm font-semibold text-mute">{f.n}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${f.tag === "core" ? "bg-sky-soft text-blue" : "bg-[#efe9ff] text-[#6a4bd8]"}`}>{f.tag === "core" ? "Core" : "Plus"}</span>
              </div>
              <h3 className="font-semibold text-lg mt-4 leading-snug">{f.title}</h3>
              <p className="text-sm text-ink-2 mt-2 flex-1">{f.blurb}</p>
              {f.paypal && <p className="text-[11px] font-semibold text-[#003087] mt-3">PayPal · {f.paypal}</p>}
              <span className="mt-4 text-sm font-semibold text-blue flex items-center gap-1">Open {f.pageName} <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Prime-style band */}
      <section className="p-3 sm:p-4 bg-[#d6d6d8]">
        <div className="relative rounded-[2rem] overflow-hidden bg-[#f1efee] min-h-[560px]">
          <Image src="/images/coins.webp" alt="Frosted glass coins" fill sizes="100vw" className="object-cover object-[75%_center]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f1efee] via-transparent to-transparent" />
          <div className="relative h-full min-h-[560px] flex flex-col justify-end p-6 sm:p-12">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <h2 className="display text-6xl sm:text-8xl xl:text-[8.5rem] font-light leading-[0.88]">Real-time<br />settlement</h2>
              <div className="max-w-xs">
                <p className="text-lg leading-snug">Every friend pays in their own currency. The pool settles in one, live, and the moment it&apos;s funded the queued payouts go out.</p>
                <Link href="/signup" className="btn btn-black mt-6 !pl-6 !pr-2 !py-2">JUMP IN <span className="grid place-items-center size-9 rounded-full bg-white text-ink"><ArrowRight size={16} /></span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 sm:px-10 lg:px-16 py-10 flex flex-wrap items-center gap-4 text-sm text-mute">
        <span className="font-semibold text-ink">kitty</span>
        <span>Built for the PayPal AI Hackathon 2026 · PayPal sandbox</span>
        <span className="ml-auto">Delfi · Mukesh Kumar · Nambert Jones</span>
      </footer>
    </main>
  );
}

function FloatCard({ children, className, delay, r }: { children: React.ReactNode; className: string; delay: string; r?: string }) {
  return (
    <div className={`absolute rounded-[1.4rem] bg-white p-4 text-left text-ink shadow-[0_30px_60px_-20px_rgba(10,60,180,.45)] floaty ${className}`} style={{ animationDelay: delay, ["--r" as string]: r ?? "0deg" }}>
      {children}
    </div>
  );
}

function Pillar({ title, text, link, cta, bg, children }: { title: string; text: string; link: string; cta: string; bg: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`${bg} rounded-[1.6rem] h-60 grid place-items-center overflow-hidden`}>{children}</div>
      <h3 className="font-semibold text-xl mt-6">{title}</h3>
      <p className="text-ink-2 mt-2">{text}</p>
      <Link href={link} className="mt-4 inline-block text-sm font-semibold border-b border-ink pb-0.5">{cta}</Link>
    </div>
  );
}
