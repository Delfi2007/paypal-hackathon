"use client";

// Voice for the treasurer: speech-to-text with the browser's built-in SpeechRecognition and
// text-to-speech with speechSynthesis. No API, no key, no cost; audio never leaves the browser's
// own speech service. Chrome and Edge support recognition; Safari and Firefox may not.

import { useCallback, useEffect, useRef, useState } from "react";

type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const LANGS = [
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
];
export { LANGS };

export function useVoice(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState("en-US");
  const [speakReplies, setSpeakState] = useState(false);
  const rec = useRef<SR | null>(null);
  const finalRef = useRef("");
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      const l = localStorage.getItem("kitty-voice-lang"); if (l) setLangState(l);
      setSpeakState(localStorage.getItem("kitty-voice-speak") === "1");
    } catch {}
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError("Voice input isn't supported in this browser. Try Chrome or Edge."); return; }
    window.speechSynthesis?.cancel();
    setError(null); setInterim(""); finalRef.current = "";
    const r = new Ctor();
    r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t; else interimText += t;
      }
      setInterim((finalRef.current + interimText).trim());
    };
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Microphone access is blocked. Allow it in the address bar and try again.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Voice error: ${e.error}`);
    };
    r.onend = () => {
      setListening(false);
      const said = finalRef.current.trim();
      setInterim("");
      if (said) cb.current(said);
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);
  const setLang = (l: string) => { setLangState(l); try { localStorage.setItem("kitty-voice-lang", l); } catch {} };
  const setSpeak = (on: boolean) => { setSpeakState(on); try { localStorage.setItem("kitty-voice-speak", on ? "1" : "0"); } catch {} if (!on) window.speechSynthesis?.cancel(); };

  const speak = useCallback((text: string) => {
    if (!speakReplies || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[€£$¥]/g, (c) => ({ "€": " euros ", "£": " pounds ", $: " dollars ", "¥": " yen " }[c] ?? c)));
    u.lang = lang; u.rate = 1.03;
    window.speechSynthesis.speak(u);
  }, [speakReplies, lang]);

  useEffect(() => () => { rec.current?.abort(); window.speechSynthesis?.cancel(); }, []);

  return { supported, listening, interim, error, lang, setLang, speakReplies, setSpeak, start, stop, speak };
}
