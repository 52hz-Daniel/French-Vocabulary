import { NextResponse } from "next/server";
import { nextReviewQuestion } from "@/db/review-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  try { return NextResponse.json({ question: await nextReviewQuestion(sessionId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load review question" }, { status: 503 }); }
}
