"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Logo } from "./kit";
import { NotificationBell, UserMenu, useMe } from "./session";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/app", label: "My kitties" },
  { href: "/new", label: "New kitty" },
];

export function SiteNav({ light = false }: { light?: boolean }) {
  const path = usePathname();
  const { user } = useMe(false);
  return (
    <nav className="relative z-30 flex items-center gap-4 w-full">
      <Logo light={light} />
      <ul className={`hidden md:flex mx-auto items-center gap-1 rounded-full px-2 py-1.5 ${light ? "bg-white/15 backdrop-blur border border-white/25" : "bg-white shadow-sm border border-line"}`}>
        {LINKS.map((l) => {
          const active = l.href === path;
          return (
            <li key={l.href}>
              <Link href={l.href} className={`relative block rounded-full px-4 py-1.5 text-sm font-medium transition ${light ? "text-white/90 hover:text-white" : "text-ink-2 hover:text-ink"}`}>
                {l.label}
                {active && <span className={`absolute left-1/2 -translate-x-1/2 bottom-0 size-1 rounded-full ${light ? "bg-white" : "bg-ink"}`} />}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="ml-auto md:ml-0 flex items-center gap-2">
        {user ? (
          <>
            <NotificationBell />
            <UserMenu user={user} />
          </>
        ) : (
          <>
            <Link href="/login" className={`btn !py-2 !px-4 text-sm ${light ? "bg-white/15 backdrop-blur border border-white/30 text-white" : "btn-ghost"}`}>Log in</Link>
            <Link href="/signup" className={`btn !py-2 !px-4 text-sm ${light ? "bg-white text-ink hover:bg-white/90" : "btn-dark"}`}>
              Get started <ArrowRight size={14} />
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
