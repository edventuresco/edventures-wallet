"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OwlContext, OwlIntent } from "@/lib/owl/intent";

/**
 * Minimal shape of the Web Speech API's SpeechRecognition — not in
 * lib.dom.d.ts, and browser support (and the interface) varies, so this
 * covers only what useOwl needs.
 */
interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type UseOwlResult = {
  listening: boolean;
  transcript: string;
  speaking: boolean;
  /** False when the browser has no SpeechRecognition — UI should show a typed box. */
  supportsListening: boolean;
  lastIntent: OwlIntent | null;
  ask: (text: string) => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
};

function speakWithBrowserVoice(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const friendly = voices.find((voice) => /female|samantha|victoria|us english/i.test(voice.name)) ?? voices[0];
  if (friendly) utterance.voice = friendly;
  utterance.rate = 1;
  utterance.pitch = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/** kind → what to actually say aloud for each OwlIntent variant. */
function textToSpeak(intent: OwlIntent): string {
  return intent.kind === "propose_send" || intent.kind === "propose_save" ? intent.say : intent.text;
}

export function useOwl(context: OwlContext): UseOwlResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [lastIntent, setLastIntent] = useState<OwlIntent | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const supportsListening = Boolean(getSpeechRecognitionCtor());

  const speak = useCallback(async (text: string) => {
    setSpeaking(true);
    try {
      let response: Response;
      try {
        response = await fetch("/api/owl/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch {
        speakWithBrowserVoice(text);
        return;
      }

      if (response.status === 204 || !response.ok) {
        speakWithBrowserVoice(text);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } finally {
      setSpeaking(false);
    }
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTranscript(trimmed);

      const genericTrouble: OwlIntent = { kind: "say", text: "I didn't catch that. Ask me again?" };

      try {
        const response = await fetch("/api/owl/interpret", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed, context: contextRef.current }),
        });

        const intent: OwlIntent = response.ok ? await response.json() : genericTrouble;
        setLastIntent(intent);
        await speak(textToSpeak(intent));
      } catch {
        setLastIntent(genericTrouble);
        await speak(textToSpeak(genericTrouble));
      }
    },
    [speak],
  );

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor || listening) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const latest = results[results.length - 1];
      const text = latest?.[0]?.transcript ?? "";
      setTranscript(text);
      if (latest?.isFinal && text.trim()) {
        void ask(text);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, ask]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      audioRef.current?.pause();
    },
    [],
  );

  return { listening, transcript, speaking, supportsListening, lastIntent, ask, startListening, stopListening };
}
