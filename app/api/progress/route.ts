import { NextResponse } from "next/server";
import { getProgress } from "@/db/catalog-repository";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getProgress()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Progress query failed" }, { status: 503 }); }
}
