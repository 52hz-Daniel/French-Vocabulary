import { NextResponse } from "next/server";
import { answerReviewQuestion } from "@/db/review-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null) as null | { questionId?: string; selectedSenseId?: string; idempotencyKey?: string; responseMs?: number };
  if (!body?.questionId || !body.selectedSenseId || !body.idempotencyKey) return NextResponse.json({ error: "questionId, selectedSenseId and idempotencyKey are required" }, { status: 400 });
  try { return NextResponse.json(await answerReviewQuestion({ sessionId: (await params).id, questionId: body.questionId, selectedSenseId: body.selectedSenseId, idempotencyKey: body.idempotencyKey, responseMs: body.responseMs ?? 0 })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record answer" }, { status: 503 }); }
}
