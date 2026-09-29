import Link from "next/link";
import { getTodaySummary } from "@/db/catalog-repository";
import { serverTranslator } from "@/lib/server-language";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { t } = await serverTranslator();
  let summary: Awaited<ReturnType<typeof getTodaySummary>>;
  try { summary = await getTodaySummary(); }
  catch { summary = { available: 0, due: 0, difficult: 0, collection_title: null }; }
  return <section className="today-shell">
    <header className="today-hero">
      <h1>{t("today.greeting")}</h1>
      <p>{t("today.ready")}<br />{t("today.calibrated")}</p>
      <Link className="primary-button today-action" href={summary.due ? "/vocabulary" : "/debug"}>{summary.due ? t("today.start") : t("today.checkData")}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>
    </header>
    <section className="today-section">
      <div className="section-title"><span className="material-symbols-outlined">fact_check</span>{t("today.program")}</div>
      <div className="today-metrics"><div><strong>{summary.available}</strong><span>{t("today.learn")}</span></div><div><strong>{summary.due}</strong><span>{t("today.review")}</span></div><div className="difficult"><strong>{summary.difficult}</strong><span>{t("today.difficult")}</span></div></div>
    </section>
    <section className="today-section recent-section">
      <div className="section-title"><span className="material-symbols-outlined">show_chart</span>{t("today.recent")}</div>
      <div className="streak-row"><div><strong>{t("today.streak")}</strong><span>{summary.collection_title ? `${t("today.activeCollection")}: ${summary.collection_title}` : t("today.connect")}</span></div><div className="streak-dots" aria-label={t("today.streak")}><i /><i /><i /><i /><i className="today-dot" /><small>{t("today.today")}</small></div></div>
    </section>
  </section>;
}
