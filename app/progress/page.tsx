import Link from "next/link";
import { loadDataset } from "@/data/load-dataset";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const data = await loadDataset();
  const ready = data.learningEntries?.filter((entry) => entry.status === "STUDY_READY").length ?? 0;
  const priority = data.lexemes.slice().sort((a, b) => b.priority - a.priority).slice(0, 3);
  return <section className="progress-shell">
    <header className="progress-heading"><h1>Progression</h1><p>Your journey towards NCLC 7 mastery.</p></header>
    <section className="progress-section"><div className="section-title">Target summary</div><div className="progress-metrics"><div><strong>NCLC 5</strong><span>Current Estimated Level</span></div><div><strong>{ready.toLocaleString()}</strong><span>Vocabulary Active</span></div><div><strong>B2</strong><span>Grammar Readiness</span></div></div><div className="level-track"><i /><div><b>Current: B1/B2</b><b>Target: C1 (NCLC 7)</b></div></div></section>
    <section className="progress-section"><div className="section-title">Consistency (Last 30 Days)</div><div className="consistency-grid">{Array.from({length: 30}, (_, index) => <i key={index} className={index % 7 === 0 || index > 26 ? "quiet" : index % 5 === 0 ? "strong" : ""} />)}</div><p>Study days appear here as you complete reviews.</p></section>
    <section className="progress-section"><div className="section-title">Retention quality</div><div className="retention"><div><span><i className="correct-key" />Correct First Try</span><strong>0%</strong></div><div><span><i />Required Review</span><strong>0%</strong></div></div></section>
    <section className="progress-section"><div className="section-title">Priority review</div><div className="priority-list">{priority.map((item, index) => <Link href="/vocabulary" key={item.id}><div><strong>{item.lemma}</strong><span>{index === 0 ? "High-priority vocabulary" : "Ready for recall"}</span></div><span className="material-symbols-outlined">arrow_forward</span></Link>)}</div></section>
  </section>;
}
