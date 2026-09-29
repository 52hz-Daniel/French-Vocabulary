import { NextResponse } from "next/server";
import { createReviewSession } from "@/db/review-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { collectionId?: string };
    return NextResponse.json(await createReviewSession(body.collectionId), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create review session" }, { status: 503 });
  }
}
