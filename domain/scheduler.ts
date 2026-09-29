import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";

export const SCHEDULER_VERSION = "ts-fsrs-5.4.1";

export interface StoredReviewCard {
  due_at: string | Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  repetitions: number;
  lapses: number;
  state: string;
  last_reviewed_at?: string | Date | null;
}

export function toFsrsCard(row?: StoredReviewCard): Card {
  if (!row) return createEmptyCard(new Date());
  return { due: new Date(row.due_at), stability: Number(row.stability), difficulty: Number(row.difficulty), elapsed_days: Number(row.elapsed_days), scheduled_days: Number(row.scheduled_days), learning_steps: Number(row.learning_steps), reps: Number(row.repetitions), lapses: Number(row.lapses), state: ({new:State.New,learning:State.Learning,review:State.Review,relearning:State.Relearning}[row.state] ?? State.New), last_review: row.last_reviewed_at ? new Date(row.last_reviewed_at) : undefined };
}

export function stateName(state: State): "new"|"learning"|"review"|"relearning" {
  return ({[State.New]:"new",[State.Learning]:"learning",[State.Review]:"review",[State.Relearning]:"relearning"}[state] ?? "new") as "new"|"learning"|"review"|"relearning";
}

export function scheduleReview(row: StoredReviewCard|undefined, correct: boolean, reviewedAt: Date, desiredRetention=0.9) {
  const next=fsrs({request_retention:desiredRetention}).next(toFsrsCard(row),reviewedAt,correct?Rating.Good:Rating.Again).card;
  return { card:next, rating:correct?Rating.Good:Rating.Again, state:stateName(next.state) };
}
