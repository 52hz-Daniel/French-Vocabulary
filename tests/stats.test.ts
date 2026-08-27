import { beforeEach, expect, it } from "vitest";
import { recordStudyResult } from "@/domain/stats";

beforeEach(() => localStorage.clear());

it("tracks new items, reviews, accuracy inputs, time, and collection progress", () => {
  const first = recordStudyResult(localStorage, "listening", "courrier", true, 12.4);
  const review = recordStudyResult(localStorage, "listening", "courrier", false, 4.6);
  expect(first).toMatchObject({ itemsStudied: 1, newItems: 1, reviews: 0, correct: 1, studySeconds: 12 });
  expect(review).toMatchObject({ itemsStudied: 2, newItems: 1, reviews: 1, correct: 1, incorrect: 1, studySeconds: 17, studiedLexemeIds: ["courrier"] });
});
