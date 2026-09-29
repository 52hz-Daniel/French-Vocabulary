"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AudioButton from "./AudioButton";
import { useLanguage } from "./LanguageProvider";

interface StudyItem { id:string; collection_slug:string; collection_title:string; lemma:string; ipa:string|null; part_of_speech:string; gender:string|null; definition_fr:string|null; definition_zh:string|null; gloss:string|null; sentence_fr:string; sentence_zh:string|null; source_reference:string; status:string; forms:Array<{surface:string;form_kind:string;mood:string|null;tense:string|null;person:string|null}> }

export default function LearnSession({ collectionId, requestedId }: { collectionId: string; requestedId?: string }) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [item, setItem] = useState<StudyItem>();
  const [error, setError] = useState<string>();
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    fetch(`/api/library?collection=${encodeURIComponent(collectionId)}&limit=100`).then(async (response) => {
      const value = await response.json(); if (!response.ok) throw new Error(value.error ?? t("learn.notReady"));
      const ids = (value.items as Array<{id:string}>).map((entry) => entry.id); setQueue(ids); setIndex(Math.max(0, requestedId ? ids.indexOf(requestedId) : 0));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : t("learn.notReady")));
  }, [collectionId, requestedId]);
  useEffect(() => {
    const id = requestedId && queue.includes(requestedId) ? requestedId : queue[index];
    if (!id) return;
    fetch(`/api/study-items/${id}`).then(async (response) => { const value=await response.json(); if(!response.ok) throw new Error(value.error ?? t("learn.notReady")); setItem(value); const bookmark=await fetch(`/api/bookmarks/${id}`).then((result)=>result.json()); setFavorite(Boolean(bookmark.bookmarked)); }).catch((reason) => setError(reason instanceof Error?reason.message:t("learn.notReady")));
  }, [index, queue, requestedId]);
  if (error) return <section className="learn-detail-shell empty-state"><div className="eyebrow">{t("learn.databaseError")}</div><h1>{t("learn.notReady")}</h1><p>{error}</p><Link className="primary-button" href="/library">{t("learn.back")}</Link></section>;
  if (!item) return <section className="learn-detail-shell"><p>{t("learn.loading")}</p></section>;
  const next = () => { setFavorite(false); setItem(undefined); setIndex((value) => queue.length ? (value+1)%queue.length : 0); };
  const toggleFavorite=async()=>{const desired=!favorite;setFavorite(desired);const response=await fetch(`/api/bookmarks/${item.id}`,{method:desired?"PUT":"DELETE"});if(!response.ok)setFavorite(!desired);};
  return <section className="learn-detail-shell"><header className="learn-detail-top"><span>{t("learn.vocabulary")} · {item.collection_title}</span><span>{t("learn.word")} {index+1} {t("learn.of")} {queue.length}</span></header><article className="learn-detail-card"><div className="learn-word"><h1>{item.lemma}</h1><h2>{item.part_of_speech}{item.gender?` · ${item.gender}`:""} · {item.definition_zh ?? item.gloss ?? t("learn.meaningPending")}</h2></div><div className="learn-audio"><AudioButton text={item.lemma} kind="word" label={t("learn.playWord")} /><AudioButton text={item.sentence_fr} kind="sentence" label={t("learn.playSentence")} /></div>{item.definition_fr && <p className="lead">{item.definition_fr}</p>}<blockquote className="example-note"><p>“{item.sentence_fr}”</p>{item.sentence_zh && <p className="translation">{item.sentence_zh}</p>}</blockquote><p className="source-label">{t("learn.source")}: {item.source_reference}</p>{item.forms.length>0 && <details className="conjugations"><summary>{t("learn.forms")} ({item.forms.length})</summary><div className="conjugation-grid">{item.forms.slice(0,24).map((form,formIndex)=><div key={`${form.surface}-${formIndex}`}><strong>{form.surface}</strong><small>{[form.mood,form.tense,form.person].filter(Boolean).join(" · ")||form.form_kind}</small></div>)}</div></details>}</article><footer className="learn-actions"><button className={`secondary-button ${favorite?"is-favorite":""}`} aria-pressed={favorite} onClick={()=>void toggleFavorite()}><span className="material-symbols-outlined">{favorite?"bookmark_added":"bookmark_add"}</span>{favorite?t("learn.favorited"):t("learn.addFavorite")}</button><button className="primary-button" onClick={next}>{t("learn.next")} <span className="material-symbols-outlined">arrow_forward</span></button></footer></section>;
}
