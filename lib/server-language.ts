import "server-only";
import { cookies } from "next/headers";
import { isLanguage, translate, type Language } from "@/domain/i18n";

export async function serverLanguage(): Promise<Language> {
  const value = (await cookies()).get("tcf-language")?.value;
  return isLanguage(value) ? value : "en";
}
export async function serverTranslator() {
  const language = await serverLanguage();
  return { language, t: (key: Parameters<typeof translate>[1], values?: Record<string,string|number>) => translate(language,key,values) };
}
