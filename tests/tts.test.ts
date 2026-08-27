import { expect, it, vi } from "vitest";
import { BrowserTTSProvider } from "@/domain/tts";

class FakeUtterance {
  lang = ""; rate = 1; voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}

it("keeps word and sentence speech behind the provider abstraction", () => {
  const engine = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };
  const provider = new BrowserTTSProvider(engine, FakeUtterance as unknown as typeof SpeechSynthesisUtterance);
  provider.speakWord("parfait"); provider.speakSentence("C'est parfait.");
  expect(engine.speak).toHaveBeenCalledTimes(2);
  expect(engine.cancel).toHaveBeenCalledTimes(2);
  expect(engine.speak.mock.calls[0][0]).toMatchObject({ text: "parfait", lang: "fr-FR", rate: 0.9 });
  expect(engine.speak.mock.calls[1][0]).toMatchObject({ text: "C'est parfait.", rate: 1 });
});
