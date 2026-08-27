export interface TTSProvider {
  speakWord(text: string, language?: string): void;
  speakSentence(text: string, language?: string): void;
  stop(): void;
}

export interface SpeechEngine {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

export class BrowserTTSProvider implements TTSProvider {
  constructor(private readonly engine: SpeechEngine, private readonly Utterance: typeof SpeechSynthesisUtterance) {}

  private speak(text: string, language: string, rate: number): void {
    this.engine.cancel();
    const utterance = new this.Utterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    utterance.voice = this.engine.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("fr")) ?? null;
    this.engine.speak(utterance);
  }

  speakWord(text: string, language = "fr-FR"): void { this.speak(text, language, 0.9); }
  speakSentence(text: string, language = "fr-FR"): void { this.speak(text, language, 1); }
  stop(): void { this.engine.cancel(); }
}

export function browserTTS(): TTSProvider | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return new BrowserTTSProvider(window.speechSynthesis, window.SpeechSynthesisUtterance);
}
