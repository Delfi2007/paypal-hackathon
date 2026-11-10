"use client";

import { Chip } from "./kit";

/** Stat tile: small label, big number, optional delta chip. Used across the newer dashboard-style pages. */
export function Stat({ label, value, chip, tone = "mute", delay = 0 }: { label: string; value: React.ReactNode; chip?: string; tone?: "ok" | "warn" | "bad" | "blue" | "mute" | "lilac"; delay?: number }) {
  return (
    <div className="panel p-5 rise" style={{ animationDelay: `${delay}s` }}>
      <p className="text-sm text-mute">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="num text-[1.7rem] font-semibold leading-none">{value}</p>
        {chip && <Chip tone={tone}>{chip}</Chip>}
      </div>
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rise">
      <div>
        <h1 className="display text-4xl sm:text-5xl font-medium">{title}</h1>
        {sub && <p className="text-ink-2 mt-2 max-w-xl">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`h-2 rounded-full bg-soft overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-ink transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="py-10 text-center text-mute">
      <div className="mx-auto grid place-items-center size-11 rounded-full bg-soft text-ink-2">{icon}</div>
      <p className="font-semibold text-ink mt-3">{title}</p>
      <p className="text-sm mt-1 max-w-xs mx-auto">{text}</p>
    </div>
  );
}

/** Slide-to-confirm control (the swipe pattern from the payment keypad reference). Mouse, touch and keyboard (Enter). */
export function SwipeToConfirm({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  return (
    <div
      className={`swipe-track ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onPointerDown={(e) => {
        const bar = e.currentTarget;
        const knob = bar.querySelector<HTMLElement>(".swipe-knob")!;
        const max = bar.clientWidth - knob.clientWidth - 8;
        const start = e.clientX;
        const move = (ev: PointerEvent) => {
          const x = Math.max(0, Math.min(max, ev.clientX - start));
          knob.style.transform = `translateX(${x}px)`;
          knob.dataset.x = String(x);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const x = Number(knob.dataset.x || 0);
          knob.style.transition = "transform .25s";
          knob.style.transform = "translateX(0)";
          setTimeout(() => (knob.style.transition = ""), 260);
          knob.dataset.x = "0";
          if (x > max * 0.85) onConfirm();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-mute pointer-events-none">{label}</span>
      <button className="swipe-knob" aria-label={label} onKeyDown={(e) => e.key === "Enter" && onConfirm()}>→</button>
    </div>
  );
}
