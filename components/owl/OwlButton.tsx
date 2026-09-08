"use client";

import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { checkOwlName } from "@/lib/owl/name";
import type { OwlIntent } from "@/lib/owl/intent";

export type OwlButtonProps = {
  listening: boolean;
  speaking: boolean;
  transcript: string;
  lastIntent: OwlIntent | null;
  supportsListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onAsk: (text: string) => void;
};

function answerFrom(intent: OwlIntent | null): string | null {
  if (!intent) return null;
  return intent.kind === "propose_send" || intent.kind === "propose_save" ? intent.say : intent.text;
}

/**
 * 64px round mic button plus a transcript/answer bubble. Falls back to a
 * typed box when the browser has no SpeechRecognition (supportsListening).
 */
export function OwlButton({
  listening,
  speaking,
  transcript,
  lastIntent,
  supportsListening,
  onStartListening,
  onStopListening,
  onAsk,
}: OwlButtonProps) {
  const [typed, setTyped] = useState("");
  const answer = answerFrom(lastIntent);

  return (
    <div className="flex flex-col items-center gap-3">
      {supportsListening ? (
        <button
          type="button"
          onClick={listening ? onStopListening : onStartListening}
          aria-pressed={listening}
          aria-label={listening ? "Stop talking to your owl" : "Talk to your owl"}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm transition ${
            listening ? "bg-kid-coral" : "bg-kid-orange hover:brightness-95"
          }`}
        >
          {listening ? <MicOff size={28} aria-hidden /> : <Mic size={28} aria-hidden />}
        </button>
      ) : (
        <form
          className="flex w-full max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = typed.trim();
            if (!value) return;
            onAsk(value);
            setTyped("");
          }}
        >
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Ask your owl…"
            aria-label="Type a message to your owl"
            className="flex-1 rounded-full border border-kid-sage/40 bg-white px-4 py-2 text-ink"
          />
          <button type="submit" className="rounded-full bg-kid-orange px-4 py-2 font-semibold text-white">
            Ask
          </button>
        </form>
      )}

      {(transcript || answer || speaking) && (
        <div className="w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-kid-sage/30">
          {transcript && <p className="text-ink/60">&ldquo;{transcript}&rdquo;</p>}
          {speaking && !answer && <p className="text-ink/60">Thinking…</p>}
          {answer && <p className="mt-1 font-medium text-kid-green">{answer}</p>}
        </div>
      )}
    </div>
  );
}

export type NameYourOwlProps = {
  onName: (name: string) => void;
};

/** Small form for naming the owl; instant client-side check via checkOwlName. */
export function NameYourOwl({ onName }: NameYourOwlProps) {
  const [value, setValue] = useState("");
  const [rejected, setRejected] = useState(false);

  return (
    <form
      className="flex flex-col items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const result = checkOwlName(value);
        if (!result.ok) {
          setRejected(true);
          setValue("");
          return;
        }
        setRejected(false);
        onName(result.name);
      }}
    >
      <label htmlFor="owl-name" className="text-sm font-semibold text-kid-green">
        Name your owl
      </label>
      <input
        id="owl-name"
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setRejected(false);
        }}
        maxLength={16}
        placeholder="Pip"
        className="w-40 rounded-full border border-kid-sage/40 bg-white px-4 py-2 text-center text-ink"
      />
      <button type="submit" className="rounded-full bg-kid-orange px-4 py-2 font-semibold text-white">
        That&apos;s the name
      </button>
      {rejected && (
        <p role="alert" className="text-sm font-medium text-kid-coral">
          Try another name
        </p>
      )}
    </form>
  );
}
