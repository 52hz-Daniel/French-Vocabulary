"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dataset } from "@/domain/types";
import { buildRecognitionQuestion } from "@/domain/questions";
import { recordStudyResult } from "@/domain/stats";
import AudioButton from "./AudioButton";
import { browserTTS } from "@/domain/tts";

type Feedback = "correct" | "incorrect" | undefined;
type Mode = "choice" | "audio" | "typing";

export default function ReviewSession() {
  const [data, setData] = useState<Dataset>();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/dataset").then((response) => response.json()).then(setData);
    return () => browserTTS()?.stop();
  }, []);
  const items = useMemo(() => data?.lexemes.slice().sort((a, b) => b.priority - a.priority) ?? [], [data]);
  const item = items[index];
  const question = useMemo(() => item && data ? buildRecognitionQuestion(item, data.lexemes, index) : undefined, [data, index, item]);
  const mode: Mode = index % 5 === 3 ? "typing" : index % 5 === 2 ? "audio" : "choice";

  if (!data) return <section className="review-shell"><p>Préparation de la session…</p></section>;
  if (!item || !question) return <section className="review-shell review-complete"><div className="eyebrow">Session terminée</div><h1>Bien joué.</h1><Link className="primary-button" href="/today">Retour à aujourd&apos;hui</Link></section>;
  const occurrence = item.occurrences[0];
  const sense = item.senses[0];
  const collectionId = item.collectionIds[0] ?? "review";
  const submitChoice = () => {
    if (!selected || feedback) return;
    const correct = selected === question.correctSenseId;
    setFeedback(correct ? "correct" : "incorrect");
    recordStudyResult(window.localStorage, collectionId, item.id, correct, (Date.now() - startedAt) / 1000);
  };
  const submitTyping = (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim()) return;
    const correct = answer.trim().localeCompare(item.lemma, "fr", { sensitivity: "base" }) === 0;
    setFeedback(correct ? "correct" : "incorrect");
    recordStudyResult(window.localStorage, collectionId, item.id, correct, (Date.now() - startedAt) / 1000);
  };
  const advance = () => {
    browserTTS()?.stop(); setSelected(undefined); setFeedback(undefined); setHint(false); setAnswer(""); setStartedAt(Date.now());
    if (index + 1 >= items.length) setIndex(items.length); else setIndex(index + 1);
  };
  const sentenceParts = occurrence.sentence.split(new RegExp(`(${occurrence.surfaceForm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));

  return <section className={`review-shell ${mode === "typing" ? "typing-mode" : ""}`}>
    <div className="review-progress"><i style={{width: `${((index + 1) / items.length) * 100}%`}} /></div>
    {mode === "typing" ? <form className="recall-card" onSubmit={submitTyping}>
      <div className="recall-heading"><span>Active Recall</span><span>{index + 1} / {items.length}</span></div>
      <div className="recall-reference"><h2>{sense.chineseGloss}</h2><p>{item.partOfSpeech}{sense.synonyms.length ? ` — Synonyme: ${sense.synonyms[0]}` : ""}</p><AudioButton text={item.lemma} kind="word" label="Play Word" /></div>
      <div className="recall-sentence"><p>{sentenceParts.map((part, partIndex) => part.toLocaleLowerCase("fr") === occurrence.surfaceForm.toLocaleLowerCase("fr") ? <span className="recall-input-wrap" key={partIndex}><input autoFocus value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(undefined); }} aria-label="Type the missing French word" className={feedback === "incorrect" ? "incorrect" : feedback === "correct" ? "correct" : ""} placeholder="________" />{feedback === "incorrect" && <small>Réessayez</small>}</span> : part)}</p><AudioButton text={occurrence.sentence} kind="sentence" label="Play Sentence" /></div>
      <div className="review-actions"><button type="button" className="skip-button" onClick={advance}>Skip for now</button><span className="key-hint">Press <kbd>Enter ↵</kbd></span>{feedback === "correct" ? <button className="primary-button" type="button" onClick={advance}>Continuer</button> : <button className="primary-button" type="submit">{feedback === "incorrect" ? "Vérifier à nouveau" : "Vérifier"}</button>}</div>
    </form> : <div className="quiz-card">
      <header className="quiz-word">
        <div className="word-meta">{item.ipa ? `/${item.ipa}/` : "/ français /"}<i />{item.partOfSpeech}</div>
        {mode === "audio" ? <><button className="audio-hero" onClick={() => browserTTS()?.speakWord(item.lemma)} aria-label="Écouter le mot"><span className="material-symbols-outlined">play_arrow</span></button><h1>Écouter le mot</h1><span className="keyboard-copy">Raccourci clavier : <kbd>Espace</kbd></span></> : <><h1>{item.lemma}</h1><AudioButton text={item.lemma} kind="word" label="Écouter" /></>}
      </header>
      <section className="quiz-question">
        <h2>{mode === "audio" ? "Sélectionnez la traduction correcte" : "Choisissez la définition correcte"}</h2>
        <button className="hint-toggle" onClick={() => setHint((value) => !value)}><span className="material-symbols-outlined">lightbulb</span>Besoin d&apos;un indice ? <kbd>H</kbd></button>
        {hint && <div className="hint-note"><p>“{occurrence.sentence}”</p><AudioButton text={occurrence.sentence} kind="sentence" label="Écouter l'exemple" /></div>}
        <div className="quiz-options">{question.options.map((option, optionIndex) => {
          const isSelected = selected === option.senseId;
          const isCorrect = feedback && option.senseId === question.correctSenseId;
          const isWrong = feedback === "incorrect" && isSelected;
          return <button key={option.senseId} disabled={Boolean(feedback)} className={`${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "incorrect" : ""}`} onClick={() => setSelected(option.senseId)}><span className="option-number">{optionIndex + 1}</span><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><strong>{option.label}</strong>{isCorrect && <span className="material-symbols-outlined result-icon">check_circle</span>}{isWrong && <span className="material-symbols-outlined result-icon">cancel</span>}</button>;
        })}</div>
        {feedback === "incorrect" && <aside className="usage-note"><span>Note d&apos;usage</span><p>« {item.lemma} » signifie <strong>{sense.chineseGloss}</strong>. Observez son emploi dans la phrase d&apos;exemple.</p></aside>}
      </section>
      <footer className="quiz-actions"><span>{index + 1} / {items.length}</span><button className="primary-button" disabled={!selected} onClick={feedback ? advance : submitChoice}>{feedback ? "Continuer" : "Vérifier"}</button></footer>
    </div>}
  </section>;
}
