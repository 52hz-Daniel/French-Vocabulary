import Link from "next/link";
import { getProgress } from "@/db/catalog-repository";
import { serverTranslator } from "@/lib/server-language";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { language, t } = await serverTranslator();
  let progress: Awaited<ReturnType<typeof getProgress>>;
  try { progress = await getProgress(); } catch { progress = { totals: { active: 0, studied: 0, reviews: 0, lapses: 0 }, days: [], priority: [] }; }
  const totals = progress.totals as {active:number;studied:number;reviews:number;lapses:number};
  return <section className="progress-shell">
    <header className="progress-heading"><h1>{t("progress.title")}</h1><p>{t("progress.intro")}</p></header>
    <section className="progress-section"><div className="section-title">{t("progress.target")}</div><div className="progress-metrics"><div><strong>NCLC 5</strong><span>{t("progress.level")}</span></div><div><strong>{totals.active.toLocaleString(language)}</strong><span>{t("progress.active")}</span></div><div><strong>{totals.studied}</strong><span>{t("progress.studied")}</span></div></div><div className="level-track"><i /><div><b>{t("progress.current")}: B1/B2</b><b>{t("progress.targetLevel")}: C1 (NCLC 7)</b></div></div></section>
    <section className="progress-section"><div className="section-title">{t("progress.consistency")}</div><div className="consistency-grid">{Array.from({length:30},(_,index)=><i key={index} className={progress.days[index]?.encounters ? (progress.days[index].encounters>5?"strong":"") : "quiet"}/>)}</div><p>{progress.days.length} {t("progress.days")}</p></section>
    <section className="progress-section"><div className="section-title">{t("progress.retention")}</div><div className="retention"><div><span><i className="correct-key" />{t("progress.reviews")}</span><strong>{totals.reviews}</strong></div><div><span><i />{t("progress.lapses")}</span><strong>{totals.lapses}</strong></div></div></section>
    <section className="progress-section"><div className="section-title">{t("progress.priority")}</div><div className="priority-list">{progress.priority.map((item: {id:string;lemma:string;lapses:number}) => <Link href={`/learn/tcf-listening?item=${item.id}`} key={item.id}><div><strong>{item.lemma}</strong><span>{item.lapses ? t("progress.missed",{count:item.lapses}) : t("progress.ready")}</span></div><span className="material-symbols-outlined">arrow_forward</span></Link>)}</div></section>
  </section>;
}
