"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, LogOut, Settings2, User } from "lucide-react";
import type { AppNotification, AppUser, ModeStatus } from "@/lib/types";
import { Avatar, api, timeAgo } from "./kit";

export function useMe(required = false) {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [mode, setMode] = useState<ModeStatus | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: AppUser | null; mode: ModeStatus }>("/api/auth/me");
      setUser(r.user);
      setMode(r.mode);
      if (required && !r.user) router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    } catch {
      setUser(null);
    }
  }, [required, router]);

  useEffect(() => { refresh(); }, [refresh]);
  return { user, mode, refresh };
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: AppNotification[]; unread: number }>("/api/notifications");
      setItems(r.items);
      setUnread(r.unread);
      // real OS notification for brand-new items once the user has allowed them
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const n of r.items) {
          if (!n.read && !seen.current.has(n.id) && seen.current.size > 0) new Notification(n.title, { body: n.body });
        }
      }
      r.items.forEach((n) => seen.current.add(n.id));
      if (seen.current.size === 0) seen.current.add("init");
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api("/api/notifications", {});
      setUnread(0);
      setItems((x) => x.map((n) => ({ ...n, read: true })));
    }
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={toggle} aria-label="Notifications" className="relative grid place-items-center size-10 rounded-full bg-white border border-line hover:border-ink/30 transition">
        <Bell size={17} />
        {unread > 0 && <span className="absolute -top-1 -right-1 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-[#7b5cff] text-white text-[10px] font-bold">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[460px] overflow-auto panel !rounded-2xl p-2 z-50 pop">
          <p className="label px-3 py-2">Notifications</p>
          {items.length === 0 && <p className="px-3 py-6 text-sm text-mute text-center">Nothing yet. Votes, payments and reminders show up here.</p>}
          {items.map((n) => {
            const body = (
              <div className={`px-3 py-2.5 rounded-xl hover:bg-soft transition ${n.read ? "" : "bg-sky-soft/50"}`}>
                <p className="text-sm font-semibold leading-snug">{n.title}</p>
                {n.body && <p className="text-xs text-ink-2 mt-0.5 leading-snug">{n.body}</p>}
                <p className="text-[11px] text-mute mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            );
            return n.href ? <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}

export function UserMenu({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full bg-white border border-line pl-1 pr-3 py-1 hover:border-ink/30 transition" aria-label="Account menu">
        <Avatar m={{ name: user.name, avatarHue: user.hue }} size={30} />
        <span className="text-sm font-medium hidden sm:block max-w-[110px] truncate">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 panel !rounded-2xl p-2 z-50 pop">
          <div className="px-3 py-2">
            <p className="font-semibold truncate">{user.name}</p>
            <p className="text-xs text-mute truncate">{user.email}</p>
            <p className="text-xs text-mute mt-1 truncate">PayPal: {user.paypalEmail || "same as login email"}</p>
          </div>
          <Link href="/app" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-soft"><User size={15} /> My kitties</Link>
          <Link href="/app#profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-soft"><Settings2 size={15} /> Profile &amp; PayPal</Link>
          <button onClick={async () => { await api("/api/auth/logout", {}); router.replace("/"); router.refresh(); }} className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-soft text-bad"><LogOut size={15} /> Log out</button>
        </div>
      )}
    </div>
  );
}

export function SavedTick({ show }: { show: boolean }) {
  return show ? <span className="inline-flex items-center gap-1 text-xs text-ok font-semibold pop"><Check size={13} /> Saved</span> : null;
}
