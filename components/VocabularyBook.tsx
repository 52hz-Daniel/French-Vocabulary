"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dataset } from "@/domain/types";
import { readStudyStats, type ItemStudyStats } from "@/domain/stats";

type Filter = "all" | "review" | "difficult";

export default function VocabularyBook() {
  const [data, setData] = useState<Dataset>();
  const [stats, setStats] = useState<Record<string, ItemStudyStats>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(12);

  useEffect(() => {
    fetch("/api/dataset").then((response) => response.json()).then((value: Dataset) => {
      setData(value);
      setStats(Object.fromEntries(value.collections.flatMap((collection) => Object.entries(readStudyStats(window.localStorage, collection.id).itemStats))));
    });
  }, []);

  const rows = useMemo(() => (data?.lexemes ?? []).filter((item) => {
    const itemStats = stats[item.id] ?? { attempts: 0, correct: 0, incorrect: 0 };
    const matchesText = `${item.lemma} ${item.senses[0]?.chineseGloss ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const matchesFilter = filter === "all" || (filter === "review" ? itemStats.attempts > 0 : itemStats.incorrect > itemStats.correct);
    return matchesText && matchesFilter;
  }), [data, filter, query, stats]);

  if (!data) return <section className="library-shell"><p>Chargement de la bibliothèque…</p></section>;
  return <section className="library-shell">
    <header className="library-heading">
      <h1>Library</h1>
      <div className="library-tools">
        <div className="library-tabs" role="tablist" aria-label="Vocabulary filters">
          {([['all', 'Tous'], ['review', 'À réviser'], ['difficult', 'Difficiles']] as const).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)} role="tab" aria-selected={filter === value}>{label}</button>)}
        </div>
        <label className="search-field"><span className="material-symbols-outlined">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un mot..." aria-label="Rechercher un mot" /></label>
      </div>
    </header>
    <div className="library-table"><table><thead><tr><th>Mot</th><th>Sens</th><th>Statut</th><th>Révision</th></tr></thead><tbody>{rows.slice(0, limit).map((item) => {
      const itemStats = stats[item.id] ?? { attempts: 0, correct: 0, incorrect: 0 };
      const status = itemStats.incorrect > itemStats.correct ? "difficult" : itemStats.attempts ? "learned" : "new";
      return <tr key={item.id}><td><Link href={`/learn/${item.collectionIds[0]}`}><strong>{item.lemma}</strong></Link></td><td>{item.senses[0]?.chineseGloss ?? "Sens en attente"}{item.senses[0]?.definitionFr ? ` (${item.senses[0].definitionFr})` : ""}</td><td><span className={`word-status ${status}`}><span className="material-symbols-outlined">{status === "learned" ? "check_circle" : status === "difficult" ? "warning" : "fiber_new"}</span>{status === "learned" ? "Appris" : status === "difficult" ? "Difficile" : "Nouveau"}</span></td><td>{itemStats.attempts ? `${itemStats.attempts} essais` : "–"}</td></tr>;
    })}</tbody></table></div>
    {rows.length === 0 && <p className="empty-message">Aucun mot ne correspond à ce filtre.</p>}
    {rows.length > limit && <button className="secondary-button load-more" onClick={() => setLimit((value) => value + 12)}>Charger plus</button>}
  </section>;
}
