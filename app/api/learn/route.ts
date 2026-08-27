import { NextResponse } from "next/server";
import { loadDataset } from "@/data/load-dataset";
import { assembleLearningEntry, getStudyReadyEntries } from "@/domain/study-ready";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const collectionId = new URL(request.url).searchParams.get("collectionId");
  const dataset = await loadDataset();
  const entries = getStudyReadyEntries(dataset)
    .filter((entry) => !collectionId || entry.collectionIds.includes(collectionId))
    .map((entry) => assembleLearningEntry(entry, dataset));
  return NextResponse.json({ schemaVersion: dataset.schemaVersion ?? 1, entries });
}