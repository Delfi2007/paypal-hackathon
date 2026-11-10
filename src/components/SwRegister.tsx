"use client";
import { useEffect } from "react";

// Registers the service worker so Kitty is installable as an app (and push works without a prompt first).
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
