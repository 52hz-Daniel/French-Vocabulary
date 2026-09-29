import { describe, expect, it } from "vitest";
import { isLanguage, messages, supportedLanguages, translate } from "@/domain/i18n";

describe("system language catalog", () => {
  it("provides the same complete interface key set in all three languages", () => {
    const expected = Object.keys(messages.en).sort();
    expect(supportedLanguages).toEqual(["en", "zh", "fr"]);
    for (const language of supportedLanguages) expect(Object.keys(messages[language]).sort()).toEqual(expected);
  });

  it("validates languages and interpolates translated values", () => {
    expect(isLanguage("zh")).toBe(true);
    expect(isLanguage("de")).toBe(false);
    expect(translate("fr", "progress.missed", { count: 3 })).toBe("Manqué 3 fois");
    expect(translate("zh", "nav.settings")).toBe("设置");
  });
});
