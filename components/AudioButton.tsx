"use client";
import { browserTTS } from "@/domain/tts";

export default function AudioButton({ text, kind, label }: { text: string; kind: "word" | "sentence"; label: string }) {
  return <button type="button" className="audio-button" aria-label={label} onClick={() => {
    const provider = browserTTS();
    if (!provider) return;
    kind === "word" ? provider.speakWord(text) : provider.speakSentence(text);
  }}><span className="material-symbols-outlined" aria-hidden="true">volume_up</span><span>{label}</span></button>;
}
