"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { api } from "@/components/kit";

/** Starts a ready-made demo group and drops the visitor straight into it. No account needed. */
export function DemoButton({ className = "", label = "Try the live demo" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const { id } = await api<{ id: string }>("/api/demo/start", {});
      router.push(`/k/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button onClick={start} disabled={busy} className={className}>
        {busy ? <>Setting up three friends… <Loader2 size={14} className="animate-spin" /></> : <>{label} <Play size={14} /></>}
      </button>
      {err && <span role="alert" className="rounded-full bg-white/90 px-3 py-1 text-xs text-bad">{err}</span>}
    </span>
  );
}
