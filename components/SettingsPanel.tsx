"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supportedLanguages, type Language } from "@/domain/i18n";
import { useLanguage } from "./LanguageProvider";

export default function SettingsPanel() {
  const { language, setLanguage, t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  const labels: Record<Language,string> = { en: t("settings.english"), zh: t("settings.chinese"), fr: t("settings.french") };
  const choose = async (next: Language) => {
    setSaving(true); setSaved(false); setError(undefined);
    const response = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: next }) });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Settings update failed");
    else { setLanguage(next); setSaved(true); router.refresh(); }
    setSaving(false);
  };
  return <section className="settings-shell"><header><div className="eyebrow">TCF Lab</div><h1>{t("settings.title")}</h1><p>{t("settings.intro")}</p></header><section className="settings-section"><div className="section-title">{t("settings.language")}</div><div className="language-options">{supportedLanguages.map((value)=><button key={value} className={language===value?"active":""} aria-pressed={language===value} disabled={saving} onClick={()=>void choose(value)}><span>{labels[value]}</span><small>{value === "en" ? "English" : value === "zh" ? "中文" : "Français"}</small><span className="material-symbols-outlined">{language===value?"radio_button_checked":"radio_button_unchecked"}</span></button>)}</div><p className="settings-note">{t("settings.note")}</p>{saving&&<p className="settings-feedback">{t("settings.saving")}</p>}{saved&&!saving&&<p className="settings-feedback success">{t("settings.saved")}</p>}{error&&<p className="settings-feedback error">{error}</p>}</section></section>;
}
