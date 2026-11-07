import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Nav({ right }: { right?: React.ReactNode }) {
  return (
    <nav className="flex items-center gap-8 w-full">
      <Link href="/" className="spaced text-lg font-medium tracking-[0.35em]">
        Kitty
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
        <Link href="/#how" className="hover:text-ink">How it works</Link>
        <Link href="/k/santorini" className="hover:text-ink">Live demo</Link>
        <Link href="/new" className="hover:text-ink">New kitty</Link>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {right ?? (
          <Link href="/k/santorini" className="pill pill-dark !py-2 !px-4 text-sm">
            Open demo <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </nav>
  );
}
