import { describe, expect, it } from "vitest";
import { scheduleReview } from "@/domain/scheduler";

describe("FSRS scheduling", () => {
  const reviewedAt = new Date("2026-08-27T12:00:00.000Z");

  it("creates deterministic state for a first correct answer", () => {
    const first = scheduleReview(undefined, true, reviewedAt);
    const second = scheduleReview(undefined, true, reviewedAt);
    expect(first.card.due.toISOString()).toBe(second.card.due.toISOString());
    expect(first.card.reps).toBe(1);
    expect(first.card.due.getTime()).toBeGreaterThan(reviewedAt.getTime());
  });

  it("records a lapse when a review card is answered incorrectly", () => {
    const learned = scheduleReview(undefined, true, reviewedAt).card;
    const failed = scheduleReview({
      due_at: learned.due,
      stability: learned.stability,
      difficulty: learned.difficulty,
      elapsed_days: learned.elapsed_days,
      scheduled_days: learned.scheduled_days,
      learning_steps: learned.learning_steps,
      repetitions: learned.reps,
      lapses: learned.lapses,
      state: "review",
      last_reviewed_at: reviewedAt,
    }, false, new Date("2026-09-01T12:00:00.000Z"));
    expect(failed.card.lapses).toBeGreaterThanOrEqual(1);
    expect(failed.card.reps).toBe(2);
  });
});
