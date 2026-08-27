import Link from "next/link";
import { loadDataset } from "@/data/load-dataset";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await loadDataset();
  const ready = data.learningEntries?.filter((entry) => entry.status === "STUDY_READY").length ?? 0;
  const available = data.collections.find((item) => item.available);
  const studyCount = ready || (available ? data.lexemes.filter((item) => item.collectionIds.includes(available.id)).length : 0);
  return <section className="today-shell">
    <header className="today-hero">
      <h1>Bonjour, Antoine.</h1>
      <p>Votre session d&apos;étude quotidienne est prête.<br />L&apos;instrument est calibré.</p>
      <Link className="primary-button today-action" href={studyCount ? "/vocabulary" : "/debug"}>{studyCount ? "Commencer la révision" : "Vérifier les données"}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>
    </header>
    <section className="today-section">
      <div className="section-title"><span className="material-symbols-outlined">fact_check</span>Programme du jour</div>
      <div className="today-metrics"><div><strong>{Math.min(studyCount, 12)}</strong><span>mots à apprendre</span></div><div><strong>{studyCount}</strong><span>mots à réviser</span></div><div className="difficult"><strong>0</strong><span>mots difficiles</span></div></div>
    </section>
    <section className="today-section recent-section">
      <div className="section-title"><span className="material-symbols-outlined">show_chart</span>Progression récente</div>
      <div className="streak-row"><div><strong>Série en cours</strong><span>{available ? `Collection active : ${available.name}` : "Aucune collection active"}</span></div><div className="streak-dots" aria-label="Study streak"><i /><i /><i /><i /><i className="today-dot" /><small>Auj</small></div></div>
    </section>
  </section>;
}
