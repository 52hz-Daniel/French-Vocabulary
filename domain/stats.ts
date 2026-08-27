export interface StudyStats {
  itemsStudied: number;
  newItems: number;
  reviews: number;
  correct: number;
  incorrect: number;
  studySeconds: number;
  studiedLexemeIds: string[];
  itemStats: Record<string, ItemStudyStats>;
}

export interface ItemStudyStats {
  attempts: number;
  correct: number;
  incorrect: number;
  lastCorrect?: boolean;
  lastStudiedAt?: string;
}

const emptyStats = (): StudyStats => ({ itemsStudied: 0, newItems: 0, reviews: 0, correct: 0, incorrect: 0, studySeconds: 0, studiedLexemeIds: [], itemStats: {} });

export function readStudyStats(storage: Pick<Storage, "getItem">, collectionId: string): StudyStats {
  try {
    const parsed = JSON.parse(storage.getItem(`tcf-lab:stats:${collectionId}`) ?? "{}") as Partial<StudyStats>;
    return { ...emptyStats(), ...parsed, studiedLexemeIds: parsed.studiedLexemeIds ?? [], itemStats: parsed.itemStats ?? {} };
  } catch {
    return emptyStats();
  }
}

export function recordStudyResult(storage: Pick<Storage, "getItem" | "setItem">, collectionId: string, lexemeId: string, correct: boolean, elapsedSeconds: number): StudyStats {
  const key = `tcf-lab:stats:${collectionId}`;
  const current = readStudyStats(storage, collectionId);
  const isNew = !current.studiedLexemeIds.includes(lexemeId);
  const previousItem = current.itemStats[lexemeId] ?? { attempts: 0, correct: 0, incorrect: 0 };
  const next: StudyStats = {
    ...current,
    itemsStudied: current.itemsStudied + 1,
    newItems: current.newItems + (isNew ? 1 : 0),
    reviews: current.reviews + (isNew ? 0 : 1),
    correct: current.correct + (correct ? 1 : 0),
    incorrect: current.incorrect + (correct ? 0 : 1),
    studySeconds: current.studySeconds + Math.max(0, Math.round(elapsedSeconds)),
    studiedLexemeIds: isNew ? [...current.studiedLexemeIds, lexemeId] : current.studiedLexemeIds,
    itemStats: {
      ...current.itemStats,
      [lexemeId]: {
        attempts: previousItem.attempts + 1,
        correct: previousItem.correct + (correct ? 1 : 0),
        incorrect: previousItem.incorrect + (correct ? 0 : 1),
        lastCorrect: correct,
        lastStudiedAt: new Date().toISOString(),
      },
    },
  };
  storage.setItem(key, JSON.stringify(next));
  return next;
}
