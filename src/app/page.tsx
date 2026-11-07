import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowDown, ArrowLeft, Check, ShieldCheck, Users, ScrollText, MessageSquareText, X } from "lucide-react";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      {/* ------------------------------------------------ hero: full-bleed photo */}
      <section className="relative w-full h-[100svh] min-h-[760px] max-h-[1100px] flex flex-col">
        <Image src="/images/hero.webp" alt="Santorini cliffside village above the caldera" fill priority sizes="100vw" className="object-cover object-[65%_80%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#eef3f6]/85 via-[#eef3f6]/30 to-transparent lg:from-[#eef3f6]/70 lg:via-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1d3f6e]/35 to-transparent" />

        <div className="relative z-20 px-6 sm:px-10 lg:px-16 pt-6">
          <Nav />
        </div>

        <div className="relative z-10 flex-1 flex flex-col px-6 sm:px-10 lg:px-16 pb-16">
          <div className="mt-8 lg:mt-10 max-w-2xl rise">
            <p className="eyebrow leading-6 !text-ink">
              An AI treasurer
              <br />
              for every
              <br />
              group trip
            </p>
            <span className="rule my-6 text-ink" />
            <h1 className="display text-[3.4rem] sm:text-7xl xl:text-[5.8rem]">
              Share the Trip,
              <br />
              <em className="text-aegean">not</em> the Chasing.
            </h1>
            <p className="mt-7 max-w-md text-lg text-ink leading-relaxed">
              Kitty collects everyone&apos;s share through PayPal, pays the hotel and the boat, and nudges the friend who
              always forgets. It spends only inside the rules your group signs.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/k/santorini" className="pill pill-dark">
                Open the Santorini kitty <ArrowRight size={16} />
              </Link>
              <Link href="/new" className="pill pill-line bg-paper/60 backdrop-blur">
                Start your own
              </Link>
            </div>
          </div>

          <div className="mt-auto pt-8 flex items-end gap-6">
            <div className="hidden sm:block text-paper drop-shadow">
              <p className="eyebrow !text-paper">01 / 04</p>
              <p className="eyebrow !text-paper mt-4 leading-6">Speak<br />Sign<br />Vote<br />Settle</p>
              <div className="mt-5 flex gap-2">
                <span className="grid place-items-center size-9 rounded-full border border-paper/70"><ArrowLeft size={14} /></span>
                <span className="grid place-items-center size-9 rounded-full border border-paper/70"><ArrowRight size={14} /></span>
              </div>
            </div>

            {/* live policy card */}
            <div className="ml-auto w-full max-w-[350px] rounded-[1.25rem] bg-paper/90 backdrop-blur-md shadow-2xl shadow-ink/25 p-5 rise" style={{ animationDelay: ".25s" }}>
              <p className="eyebrow">Policy check · live</p>
              <p className="display text-2xl mt-2">Pay Caldera Cliff Suites €1,800</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex gap-2"><Check size={16} className="text-olive shrink-0" /> Pool has €2,700</li>
                <li className="flex gap-2"><Check size={16} className="text-olive shrink-0" /> Pre-approved payee</li>
                <li className="flex gap-2"><X size={16} className="text-bloom shrink-0" /> Over the €1,500 cap</li>
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-bloom-soft/70 px-3 py-2 text-sm">
                <span className="text-bloom font-medium">Needs 3 votes</span>
                <span className="flex -space-x-2">
                  {[212, 28, 160].map((h) => (
                    <span key={h} className="size-6 rounded-full border-2 border-paper" style={{ background: `hsl(${h} 55% 55%)` }} />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ wordmark band */}
      <section className="relative w-full -mt-10 z-10 rounded-t-[3rem] bg-cream px-6 sm:px-10 lg:px-16 pt-20 pb-16" id="how">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1 text-center">
            <h2 className="display text-5xl sm:text-7xl xl:text-8xl" style={{ letterSpacing: "0.32em", textTransform: "uppercase" }}>
              Mandate
            </h2>
            <p className="eyebrow mt-5 flex items-center justify-center gap-4">
              <span className="rule" /> the rules your money keeps <span className="rule" />
            </p>
          </div>
          <p className="eyebrow leading-6 lg:w-40 text-center lg:text-left">
            Agents propose
            <br />
            Policy decides
            <br />
            Friends vote
            <br />
            <span className="rule mt-2" />
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ editorial gallery */}
      <section className="w-full px-6 sm:px-10 lg:px-16 pb-24 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3.2fr)_minmax(0,3.2fr)] items-start">
        <div className="lg:pt-8 pr-4">
          <h3 className="display text-5xl xl:text-6xl uppercase leading-[0.95]">
            Money,
            <br />
            Minded.
          </h3>
          <p className="mt-5 text-ink-soft leading-relaxed max-w-sm">
            Most AI payment demos let a model call a payments API directly. Kitty separates the two. The AI only{" "}
            <em>proposes</em>. A deterministic policy engine checks every action against the group&apos;s signed mandate
            before PayPal is touched.
          </p>
          <Link href="/k/santorini" className="inline-flex items-center gap-2 mt-7 link-under">
            See it run <ArrowRight size={15} />
          </Link>
        </div>

        <figure className="relative">
          <div className="relative aspect-[4/3.3] overflow-hidden rounded-sm">
            <Image src="/images/terrace.webp" alt="Terrace table overlooking the caldera" fill sizes="(min-width:1024px) 30vw, 100vw" className="object-cover hover:scale-[1.03] transition-transform duration-700" />
          </div>
          <figcaption className="script text-5xl text-ink mt-4 ml-6 relative -rotate-3 leading-[0.95]">
            Same friends.<br />
            <span className="ml-10">No awkward asks.</span>
          </figcaption>
        </figure>

        <figure>
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
            <Image src="/images/sail.webp" alt="Sailboats below the caldera cliffs" fill sizes="(min-width:1024px) 20vw, 100vw" className="object-cover hover:scale-[1.03] transition-transform duration-700" />
          </div>
          <figcaption className="eyebrow mt-4 leading-5">Speak it<br />the agent plans</figcaption>
          <span className="rule mt-2" />
        </figure>

        <figure>
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
            <Image src="/images/alley.webp" alt="Whitewashed alley with bougainvillea" fill sizes="(min-width:1024px) 20vw, 100vw" className="object-cover hover:scale-[1.03] transition-transform duration-700" />
          </div>
          <figcaption className="eyebrow mt-4 leading-5">Vote on it<br />the group decides</figcaption>
          <span className="rule mt-2" />
        </figure>
      </section>

      {/* ------------------------------------------------ pillars */}
      <section className="w-full px-6 sm:px-10 lg:px-16 pb-24 grid gap-6 md:grid-cols-3">
        <Pillar icon={<MessageSquareText size={20} />} n="01" title="Speak it" tone="sky"
          body="“Pay the hotel deposit, book the sunset sail, remind whoever hasn't paid.” Kitty turns this into a plan of actions, each with its reasoning."
          foot="AI planning agent" />
        <Pillar icon={<ShieldCheck size={20} />} n="02" title="Sign it" tone="paper"
          body="Budget, a per-payment cap, approved payees and a quorum. Every PayPal call is checked against these rules first. The model cannot get around it."
          foot="Deterministic policy engine" />
        <Pillar icon={<Users size={20} />} n="03" title="Vote on it" tone="bloom"
          body="Anything outside the mandate becomes a proposal. Once enough friends approve, it runs on its own, or waits until the pool has the money."
          foot="Quorum consent" />
      </section>

      <section className="w-full grid lg:grid-cols-2 border-y border-ink/10">
        <div className="relative min-h-[460px] text-cream px-6 sm:px-10 lg:px-16 py-16 overflow-hidden">
          <Image src="/images/sail.webp" alt="" fill sizes="50vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-aegean-deep/95 via-aegean/85 to-aegean-deep/70" />
          <div className="relative">
            <p className="eyebrow !text-sky">Through PayPal</p>
            <h3 className="display text-5xl mt-4 max-w-md">Every currency in. One pool out.</h3>
            <ul className="mt-8 space-y-4 max-w-md text-sky">
              <li className="flex gap-3"><span className="eyebrow !text-paper w-24 shrink-0">Orders v2</span> Each friend pays their share by PayPal Checkout, in their own currency.</li>
              <li className="flex gap-3"><span className="eyebrow !text-paper w-24 shrink-0">Invoicing</span> Kitty emails a PayPal invoice and sends reminders written for each person.</li>
              <li className="flex gap-3"><span className="eyebrow !text-paper w-24 shrink-0">Payouts</span> Vendors are paid straight from the pool once the policy check or the group vote passes.</li>
              <li className="flex gap-3"><span className="eyebrow !text-paper w-24 shrink-0">Webhooks</span> Payments update the ledger on their own and release any payouts that were waiting.</li>
            </ul>
          </div>
        </div>
        <div className="px-6 sm:px-10 lg:px-16 py-16 flex flex-col justify-center">
          <ScrollText className="text-aegean" />
          <h3 className="display text-5xl mt-4">A ledger that explains itself.</h3>
          <p className="mt-5 text-ink-soft max-w-lg leading-relaxed">
            Every request, reminder, vote and payout is written down with the agent&apos;s reasoning and the rules it was
            checked against. Snap a dinner receipt and Kitty reads it, works out who had what, and splits it item by item.
          </p>
          <p className="script text-5xl text-bloom mt-8 -rotate-3">Good friends, clear money.</p>
        </div>
      </section>

      <footer className="w-full px-6 sm:px-10 lg:px-16 py-10 flex flex-wrap items-center gap-6">
        <span className="spaced text-sm font-medium">Kitty</span>
        <span className="rule" />
        <span className="eyebrow mx-auto" style={{ letterSpacing: "0.4em" }}>Travel together · settle lighter</span>
        <a href="#how" className="flex items-center gap-3 eyebrow">
          Scroll <span className="grid place-items-center size-10 rounded-full border border-ink/30"><ArrowDown size={14} /></span>
        </a>
      </footer>
    </main>
  );
}

function Pillar({ icon, n, title, body, foot, tone }: { icon: React.ReactNode; n: string; title: string; body: string; foot: string; tone: "sky" | "paper" | "bloom" }) {
  const bg = tone === "sky" ? "bg-sky/60" : tone === "bloom" ? "bg-bloom-soft/60" : "bg-paper";
  return (
    <div className={`rounded-[1.5rem] ${bg} p-7 flex flex-col min-h-[320px] border border-ink/5`}>
      <div className="flex items-center justify-between">
        <span className="grid place-items-center size-11 rounded-full bg-paper text-aegean">{icon}</span>
        <span className="display text-3xl text-ink/30">{n}</span>
      </div>
      <h4 className="display text-4xl mt-8">{title}</h4>
      <p className="mt-4 text-ink-soft leading-relaxed">{body}</p>
      <p className="eyebrow mt-auto pt-6 flex items-center gap-3"><span className="rule" />{foot}</p>
    </div>
  );
}
