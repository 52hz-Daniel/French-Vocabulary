"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { translatePartOfSpeech } from "@/domain/i18n";

type Filter = "all" | "review" | "difficult" | "new";
type Sort = "lemma" | "meaning" | "status" | "due";
interface LibraryItem { id: string; lemma: string; partOfSpeech: string; meaningChinese: string | null; status: string; dueAt: string | null; lapses: number; collectionId: string; bookmarked: boolean }
interface CollectionOption { slug: string; title: string }

export default function VocabularyBook() {
  const { language, t } = useLanguage();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collection, setCollection] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("lemma");
  const [direction, setDirection] = useState<"asc"|"desc">("asc");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async (append = false, nextCursor?: string | null) => {
    setLoading(true); setError(undefined);
    const params = new URLSearchParams({ q: query, status: filter, collection, favorite: String(favoritesOnly), sort, direction, limit: "40" });
    if (nextCursor) params.set("cursor", nextCursor);
    try {
      const response = await fetch(`/api/library?${params}`);
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? t("library.queryError"));
      setItems((current) => append ? [...current, ...value.items] : value.items);
      setCursor(value.nextCursor);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("library.queryError")); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch("/api/library?options=true").then((response)=>response.json()).then((value)=>setCollections(value.collections??[])).catch(()=>undefined); }, []);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timeout); }, [query, filter, collection, favoritesOnly, sort, direction]);

  const changeSort = (next: Sort) => { if (sort === next) setDirection((value)=>value === "asc" ? "desc" : "asc"); else { setSort(next); setDirection("asc"); } };
  const sortLabel = (column: Sort) => sort === column ? (direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more";
  const column = (columnSort: Sort, label: string) => <button className={sort===columnSort?"active":""} onClick={()=>changeSort(columnSort)} title={direction === "asc" ? t("library.sortDescending") : t("library.sortAscending")}><span>{label}</span><span className="material-symbols-outlined">{sortLabel(columnSort)}</span></button>;

  return <section className="library-shell">
    <header className="library-heading"><h1>{t("library.title")}</h1><div className="library-tools"><label className="search-field"><span className="material-symbols-outlined">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("library.search")} aria-label={t("library.search")} /></label></div><div className="library-filter-bar" aria-label={t("library.filters")}><select value={filter} onChange={(event)=>setFilter(event.target.value as Filter)} aria-label={t("library.status")}><option value="all">{t("library.all")}</option><option value="new">{t("library.new")}</option><option value="review">{t("library.due")}</option><option value="difficult">{t("library.difficult")}</option></select><select value={collection} onChange={(event)=>setCollection(event.target.value)} aria-label={t("library.collection")}><option value="">{t("library.allCollections")}</option>{collections.map((option)=><option key={option.slug} value={option.slug}>{option.title}</option>)}</select><button className={favoritesOnly?"active":""} aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly((value)=>!value)}><span className="material-symbols-outlined">{favoritesOnly?"bookmark":"bookmark_border"}</span>{t("library.favorites")}</button></div></header>
    {error ? <div className="empty-message"><strong>{t("library.databaseError")}</strong><p>{error}</p></div> : <><div className="library-table"><table><thead><tr><th>{column("lemma",t("library.word"))}</th><th>{column("meaning",t("library.meaning"))}</th><th>{column("status",t("library.status"))}</th><th>{column("due",t("library.reviewDate"))}</th><th><span className="material-symbols-outlined favorite-column" title={t("library.favorite")}>bookmark</span></th></tr></thead><tbody>{items.map((item) => {
      const status = item.lapses > 0 ? "difficult" : item.dueAt ? "learned" : "new";
      const statusText = status === "learned" ? t("library.learned") : status === "difficult" ? t("library.difficult") : t("library.new");
      return <tr key={item.id}><td><Link href={`/learn/${item.collectionId}?item=${item.id}`}><strong>{item.lemma}</strong></Link><small className="cell-meta">{translatePartOfSpeech(language,item.partOfSpeech)}</small></td><td>{item.meaningChinese ?? t("library.pending")}</td><td><span className={`word-status ${status}`}><span className="material-symbols-outlined">{status === "learned" ? "check_circle" : status === "difficult" ? "warning" : "fiber_new"}</span>{statusText}</span></td><td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString(language === "zh" ? "zh-CN" : language === "fr" ? "fr-CA" : "en-CA") : "–"}</td><td><span className={`material-symbols-outlined row-favorite ${item.bookmarked?"active":""}`} aria-label={item.bookmarked?t("library.favorite"):undefined}>{item.bookmarked?"bookmark":"bookmark_border"}</span></td></tr>;
    })}</tbody></table></div>{!loading && items.length===0 && <p className="empty-message">{t("library.empty")}</p>}{cursor && <button className="secondary-button load-more" onClick={() => void load(true,cursor)} disabled={loading}>{loading?t("library.loading"):t("library.loadMore")}</button>}</>}
  </section>;
}
