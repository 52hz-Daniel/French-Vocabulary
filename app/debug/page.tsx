import { loadDataset } from "@/data/load-dataset";
import { getEntryReadiness } from "@/domain/study-ready";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const data = await loadDataset();
  return <section className="page-shell"><div className="eyebrow">Enrichment review</div><h1>Vocabulary records</h1><p className="lead">Pending fields stay visible here and never enter the normal learning queue.</p><div className="table-wrap"><table><thead><tr><th>Surface</th><th>Lexeme</th><th>Morphology</th><th>Meaning</th><th>Source</th><th>Learning status</th><th>Missing fields</th></tr></thead><tbody>{data.lexemes.map((lexeme) => { const occurrence = lexeme.occurrences[0]; const sense = lexeme.senses[0]; const entry = data.learningEntries?.find((item) => item.lexemeId === lexeme.id); const readiness = entry ? getEntryReadiness(entry, data) : { status: "RAW", reasons: ["learning_entry"] }; return <tr key={lexeme.id}><td>{occurrence.surfaceForm}</td><td>{lexeme.lemma}</td><td>{occurrence.morphology ?? "—"}</td><td>{sense.chineseGloss}</td><td>{occurrence.sourceReference}</td><td><span className={`status ${readiness.status.toLowerCase()}`}>{readiness.status}</span></td><td>{readiness.reasons.join(", ") || "—"}</td></tr>; })}</tbody></table></div></section>;
}
