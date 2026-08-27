"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dataset } from "@/domain/types";
import AudioButton from "./AudioButton";
import { browserTTS } from "@/domain/tts";

const posLabel = (value: string) => ({ noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv." }[value] ?? value);

export default function LearnSession({ collectionId }: { collectionId: string }) {
  const [data, setData] = useState<Dataset>();
  const [index, setIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    fetch("/api/dataset").then((response) => response.json()).then(setData);
    return () => browserTTS()?.stop();
  }, []);
  const items = useMemo(() => data?.lexemes.filter((item) => item.collectionIds.includes(collectionId)) ?? [], [collectionId, data]);
  const item = items[index];
  if (!data) return <section className="learn-detail-shell"><p>Chargement du vocabulaire…</p></section>;
  if (!item) return <section className="learn-detail-shell empty-state"><div className="eyebrow">Collection indisponible</div><h1>Rien à étudier.</h1><Link className="primary-button" href="/library">Retour à la bibliothèque</Link></section>;
  const sense = item.senses[0];
  const occurrence = item.occurrences[0];
  const collection = data.collections.find((entry) => entry.id === collectionId);
  const next = () => { browserTTS()?.stop(); setFavorite(false); setIndex((value) => (value + 1) % items.length); };
  return <section className="learn-detail-shell">
    <header className="learn-detail-top"><span>Vocabulary · {collection?.name ?? "Collection"}</span><span>Word {index + 1} of {items.length}</span></header>
    <article className="learn-detail-card">
      <div className="learn-word"><h1>{item.lemma}</h1><h2>{posLabel(item.partOfSpeech)} {sense?.chineseGloss}</h2></div>
      <div className="learn-audio"><AudioButton text={item.lemma} kind="word" label="Play Word" /><AudioButton text={occurrence.sentence} kind="sentence" label="Play Sentence" /></div>
      <blockquote className="example-note"><p>“{occurrence.sentence}”</p>{occurrence.sentenceTranslation && <p className="translation">{occurrence.sentenceTranslation}</p>}</blockquote>
      <p className="source-label">Source: {occurrence.sourceReference}</p>
      {item.conjugations && item.conjugations.length > 0 && <details className="conjugations"><summary>Conjugaison et formes ({item.conjugations.length})</summary><div className="conjugation-grid">{item.conjugations.slice(0, 12).map((form, formIndex) => <div key={`${form.surface}-${formIndex}`}><strong>{form.surface}</strong><small>{[form.mood, form.tense, form.person].filter(Boolean).join(" · ") || "forme"}</small></div>)}</div></details>}
    </article>
    <footer className="learn-actions"><button className={`secondary-button ${favorite ? "is-favorite" : ""}`} onClick={() => setFavorite((value) => !value)}><span className="material-symbols-outlined">{favorite ? "bookmark_added" : "bookmark_add"}</span>{favorite ? "Ajouté aux favoris" : "Ajouter aux favoris"}</button><button className="primary-button" onClick={next}>Suivant <span className="material-symbols-outlined">arrow_forward</span></button></footer>
  </section>;
}
