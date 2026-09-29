"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { translate, type Language, type MessageKey } from "@/domain/i18n";

const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (key: MessageKey, values?: Record<string,string|number>) => string } | null>(null);

export default function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);
  const value = useMemo(() => ({ language, setLanguage, t: (key: MessageKey, values?: Record<string,string|number>) => translate(language,key,values) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
