"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AudioButton from "./AudioButton";
import { useLanguage } from "./LanguageProvider";

interface Question { questionId:string; studyItemId:string; word:string; ipa:string|null; partOfSpeech:string; sentenceFrench:string; options:Array<{senseId:string;label:string}> }

export default function ReviewSession() {
  const { t } = useLanguage();
  const [sessionId,setSessionId]=useState<string>();
  const [question,setQuestion]=useState<Question>();
  const [selected,setSelected]=useState<string>();
  const [feedback,setFeedback]=useState<{correct:boolean;correctSenseId?:string}>();
  const [error,setError]=useState<string>();
  const [done,setDone]=useState(false);
  const [startedAt,setStartedAt]=useState(Date.now());
  const [favorite,setFavorite]=useState(false);

  const loadNext=async(id:string)=>{setSelected(undefined);setFeedback(undefined);setQuestion(undefined);setFavorite(false);const response=await fetch(`/api/review/next?sessionId=${id}`);const value=await response.json();if(!response.ok)throw new Error(value.error??t("review.cannotStart"));if(!value.question){setDone(true);return;}setQuestion(value.question);setStartedAt(Date.now());const bookmark=await fetch(`/api/bookmarks/${value.question.studyItemId}`).then((result)=>result.json());setFavorite(Boolean(bookmark.bookmarked));};
  useEffect(()=>{fetch("/api/review/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({collectionId:"tcf-listening"})}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error??t("review.cannotStart"));setSessionId(value.sessionId);await loadNext(value.sessionId);}).catch(reason=>setError(reason instanceof Error?reason.message:t("review.cannotStart")));},[]);
  const submit=async()=>{if(!sessionId||!question||!selected)return;const response=await fetch(`/api/review/sessions/${sessionId}/answers`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({questionId:question.questionId,selectedSenseId:selected,idempotencyKey:crypto.randomUUID(),responseMs:Date.now()-startedAt})});const value=await response.json();if(!response.ok)throw new Error(value.error??"Answer submission failed");setFeedback(value);};
  const toggleFavorite=async()=>{if(!question)return;const desired=!favorite;setFavorite(desired);const response=await fetch(`/api/bookmarks/${question.studyItemId}`,{method:desired?"PUT":"DELETE"});if(!response.ok)setFavorite(!desired);};
  if(error)return <section className="review-shell review-complete"><div className="eyebrow">{t("review.databaseError")}</div><h1>{t("review.cannotStart")}</h1><p>{error}</p><Link className="primary-button" href="/today">{t("review.back")}</Link></section>;
  if(done)return <section className="review-shell review-complete"><div className="eyebrow">{t("review.complete")}</div><h1>{t("review.wellDone")}</h1><p>{t("review.noneDue")}</p><Link className="primary-button" href="/today">{t("review.backToday")}</Link></section>;
  if(!question)return <section className="review-shell"><div className="quiz-card"><p>{t("review.preparing")}</p></div></section>;
  return <section className="review-shell"><div className="review-progress"><i style={{width:"8%"}}/></div><div className="quiz-card"><header className="quiz-word"><div className="word-meta">{question.ipa?`/${question.ipa}/`:"/ français /"}<i/>{question.partOfSpeech}</div><h1>{question.word}</h1><AudioButton text={question.word} kind="word" label={t("review.listen")} /></header><section className="quiz-question"><h2>{t("review.choose")}</h2><div className="hint-note"><p>“{question.sentenceFrench}”</p><AudioButton text={question.sentenceFrench} kind="sentence" label={t("review.listenExample")} /></div><div className="quiz-options">{question.options.map((option,index)=>{const isSelected=selected===option.senseId;const correct=feedback&&option.senseId===feedback.correctSenseId;const wrong=feedback&&!feedback.correct&&isSelected;return <button key={option.senseId} disabled={Boolean(feedback)} className={`${isSelected?"selected":""} ${correct?"correct":""} ${wrong?"incorrect":""}`} onClick={()=>setSelected(option.senseId)}><span className="option-number">{index+1}</span><span className="option-letter">{String.fromCharCode(65+index)}</span><strong>{option.label}</strong>{correct&&<span className="material-symbols-outlined result-icon">check_circle</span>}{wrong&&<span className="material-symbols-outlined result-icon">cancel</span>}</button>})}</div>{feedback&&<button className={`secondary-button review-favorite ${favorite?"is-favorite":""}`} aria-pressed={favorite} onClick={()=>void toggleFavorite()}><span className="material-symbols-outlined">{favorite?"bookmark_added":"bookmark_add"}</span>{favorite?t("learn.favorited"):t("learn.addFavorite")}</button>}</section><footer className="quiz-actions"><span>FSRS</span><button className="primary-button" disabled={!selected} onClick={()=>{if(feedback&&sessionId)void loadNext(sessionId).catch(reason=>setError(String(reason)));else void submit().catch(reason=>setError(String(reason)));}}>{feedback?t("review.continue"):t("review.check")}</button></footer></div></section>;
}
