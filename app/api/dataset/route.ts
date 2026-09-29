import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "The full-dataset endpoint was retired. Use /api/library and /api/study-items/:id." }, { status: 410 });
}
